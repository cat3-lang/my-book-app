"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, BookOpen, Check, Calendar, Layers, Camera, X, RefreshCw, Search, Loader2, AlertCircle, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

const APP_VERSION = "v1.0.54";

type ExistingBookInfo = {
  id: string;
  title: string;
  sub_title?: string | null;
  sort_title: string | null;
  created_at: string;
  status: "持っている" | "欲しい";
  memo: string | null;
  volume?: string | null;
  series?: string | null;
  authors?: string | null;
  publisher?: string | null;
  release_date?: string | null;
};

export default function AddBookPage() {
  const router = useRouter();

  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [subTitle, setSubTitle] = useState("");
  const [sortTitle, setSortTitle] = useState("");
  const [volume, setVolume] = useState("");
  const [series, setSeries] = useState("");
  const [authors, setAuthors] = useState("");
  const [publisher, setPublisher] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [status, setStatus] = useState<"持っている" | "欲しい">("持っている");
  const [memo, setMemo] = useState("");
  const [registeredDate, setRegisteredDate] = useState("");

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    setRegisteredDate(todayStr);
  }, []);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [existingBook, setExistingBook] = useState<ExistingBookInfo | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const clearForm = () => {
    setIsbn("");
    setTitle("");
    setSubTitle("");
    setSortTitle("");
    setVolume("");
    setSeries("");
    setAuthors("");
    setPublisher("");
    setReleaseDate("");
    setMemo("");
    setExistingBook(null);
    setCheckMessage(null);
    setSuccessMessage("");
    setErrorMessage("");
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!sortTitle) setSortTitle(val);
  };

  const handleAutoFetchAndCheck = async (targetIsbn?: string) => {
    const cleanIsbn = (targetIsbn !== undefined ? targetIsbn : isbn).trim();
    if (!cleanIsbn) {
      setCheckMessage("ISBNを入力してください。");
      setExistingBook(null);
      return;
    }

    clearForm();
    setIsbn(cleanIsbn);
    setFetching(true);
    setErrorMessage("");
    setCheckMessage(null);

    try {
      const { data: foundData } = await supabase
        .from("books")
        .select("id, title, sub_title, sort_title, created_at, status, memo, volume, series, authors, publisher, release_date")
        .eq("isbn", cleanIsbn)
        .single();

      if (foundData) {
        setExistingBook(foundData);
        setTitle(foundData.title || "");
        setSubTitle(foundData.sub_title || "");
        setSortTitle(foundData.sort_title || foundData.title || "");
        setStatus(foundData.status || "持っている");
        setMemo(foundData.memo || "");
        if (foundData.volume) setVolume(foundData.volume);
        if (foundData.series) setSeries(foundData.series);
        if (foundData.authors) setAuthors(foundData.authors);
        if (foundData.publisher) setPublisher(foundData.publisher);
        if (foundData.release_date) setReleaseDate(foundData.release_date);

        setCheckMessage("⚠️ すでに登録されています。");
        setFetching(false);
        return;
      }

      const res = await fetch(`/api/book-fetch?isbn=${cleanIsbn}`);
      const data = await res.json();

      if (data && data.success) {
        if (data.title) setTitle(data.title);
        if (data.subTitle) setSubTitle(data.subTitle);
        if (data.sortTitle) setSortTitle(data.sortTitle);
        if (data.volume) setVolume(data.volume);
        if (data.series) setSeries(data.series);
        if (data.authors) setAuthors(data.authors);
        if (data.publisher) setPublisher(data.publisher);
        if (data.releaseDate) setReleaseDate(data.releaseDate);
        
        setExistingBook(null);
        setCheckMessage("✅ 国立国会図書館から情報を取得しました（未登録）");
      } else {
        setExistingBook(null);
        setCheckMessage("✅ 未登録です（該当データなしのため手動入力してください）");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("情報の取得中にエラーが発生しました。");
    } finally {
      setFetching(false);
    }
  };

  const handleDeleteExistingBook = async () => {
    if (!existingBook) return;
    setLoading(true);
    const { error } = await supabase.from("books").delete().eq("id", existingBook.id);
    setLoading(false);

    if (error) {
      setErrorMessage(`削除に失敗しました: ${error.message}`);
    } else {
      setSuccessMessage("データベースから本のデータを削除しました。");
      clearForm();
    }
  };

  const startScanner = async () => {
    clearForm();
    setIsScanning(true);
    setErrorMessage("");
    setCheckMessage(null);

    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 100 },
          },
          (decodedText) => {
            if (decodedText.startsWith("978") || decodedText.startsWith("979")) {
              setIsbn(decodedText);
              stopScanner();
              handleAutoFetchAndCheck(decodedText);
            }
          },
          () => {}
        );
      } catch (err) {
        console.error("Camera start error:", err);
        setErrorMessage("カメラを起動できませんでした。");
        setIsScanning(false);
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("タイトルは必須です。");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const cleanIsbn = isbn.trim();

    if (existingBook) {
      const { error } = await supabase
        .from("books")
        .update({
          title: title.trim(),
          sub_title: subTitle.trim() || null,
          sort_title: sortTitle.trim() || title.trim(),
          volume: volume.trim() || null,
          series: series.trim() || null,
          authors: authors.trim() || null,
          publisher: publisher.trim() || null,
          release_date: releaseDate.trim() || null,
          status: status,
          memo: memo.trim() || null,
        })
        .eq("id", existingBook.id);

      if (error) {
        setErrorMessage(`更新に失敗しました: ${error.message}`);
      } else {
        setSuccessMessage("既存のデータを更新しました！");
      }
    } else {
      const { error } = await supabase.from("books").insert([
        {
          title: title.trim(),
          sub_title: subTitle.trim() || null,
          sort_title: sortTitle.trim() || title.trim(),
          volume: volume.trim() || null,
          series: series.trim() || null,
          authors: authors.trim() || null,
          publisher: publisher.trim() || null,
          release_date: releaseDate.trim() || null,
          isbn: cleanIsbn || null,
          status: status,
          created_at: registeredDate ? new Date(registeredDate).toISOString() : new Date().toISOString(),
          memo: memo.trim() || null,
        },
      ]);

      if (error) {
        if (error.code === "23505") {
          setErrorMessage("このISBNの本はすでに登録されています。");
        } else {
          setErrorMessage(`登録に失敗しました: ${error.message}`);
        }
      } else {
        setSuccessMessage("本を登録しました！");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-32 relative">
      <header className="sticky top-0 z-10 bg-paper-card/95 backdrop-blur-md border-b border-paper-border px-4 py-3 md:px-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold text-paper-text-main bg-paper-sub px-3 py-1.5 border border-paper-border hover:bg-paper-border transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>本棚に戻る</span>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-wider text-paper-text-main">本を登録する</h1>
            <span className="text-[10px] bg-paper-sub text-paper-text-sub px-1.5 py-0.5 font-mono border border-paper-border">
              {APP_VERSION}
            </span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-paper-card border border-paper-border p-4 rounded-none relative shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-paper-text-main">バーコードを枠内に合わせてください</h2>
              <button
                type="button"
                onClick={stopScanner}
                className="p-1 text-paper-text-sub hover:text-paper-text-main bg-paper-sub border border-paper-border"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div id="reader" className="w-full overflow-hidden rounded-none bg-black"></div>
            <p className="text-xs text-paper-text-sub text-center mt-3">
              本の裏表紙にあるバーコードをスキャンします
            </p>
          </div>
        </div>
      )}

      <div className="fixed right-4 bottom-28 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => window.scrollBy({ top: -300, behavior: "smooth" })}
          className="w-10 h-10 bg-paper-card border border-paper-border text-paper-text-main shadow-md flex items-center justify-center hover:bg-paper-sub transition cursor-pointer"
          title="上へ"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => window.scrollBy({ top: 300, behavior: "smooth" })}
          className="w-10 h-10 bg-paper-card border border-paper-border text-paper-text-main shadow-md flex items-center justify-center hover:bg-paper-sub transition cursor-pointer"
          title="下へ"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8 md:px-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-paper-card border border-paper-border p-5 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold text-paper-text-main uppercase tracking-wider flex items-center gap-1.5 border-b border-paper-border pb-2">
              <BookOpen className="w-3.5 h-3.5 text-paper-caramel" /> 書籍詳細
            </h2>

            {/* 1. ステータス */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus("持っている")}
                className={`py-2 text-xs font-bold border transition cursor-pointer ${
                  status === "持っている"
                    ? "bg-paper-caramel text-white border-paper-caramel shadow-2xs"
                    : "bg-paper-sub text-paper-text-body border-paper-border hover:bg-paper-border"
                }`}
              >
                持っている本
              </button>
              <button
                type="button"
                onClick={() => setStatus("欲しい")}
                className={`py-2 text-xs font-bold border transition cursor-pointer ${
                  status === "欲しい"
                    ? "bg-paper-caramel text-white border-paper-caramel shadow-2xs"
                    : "bg-paper-sub text-paper-text-body border-paper-border hover:bg-paper-border"
                }`}
              >
                欲しい本
              </button>
            </div>

            {/* 2. 登録日 */}
            <div>
              <label className="block text-xs font-bold text-paper-text-sub mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-paper-caramel" /> 登録日
              </label>
              <input
                type="date"
                value={registeredDate}
                onChange={(e) => setRegisteredDate(e.target.value)}
                className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main focus:outline-none focus:border-paper-caramel font-mono"
              />
            </div>

            {/* 3. ISBN ＆ 読み取り ＆ 自動取得ボタン */}
            <div>
              <label className="block text-xs font-bold text-paper-text-sub mb-1">ISBN</label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder=""
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  className="flex-1 bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main placeholder-paper-text-muted focus:outline-none focus:border-paper-caramel font-mono"
                />
                <button
                  type="button"
                  onClick={startScanner}
                  className="cursor-pointer text-xs text-paper-text-main bg-paper-sub hover:bg-paper-border px-4 py-2 border border-paper-border flex items-center gap-1.5 transition font-bold shadow-2xs whitespace-nowrap"
                >
                  <Camera className="w-3.5 h-3.5 text-paper-caramel" />
                  <span>読み取り</span>
                </button>
              </div>

              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => handleAutoFetchAndCheck()}
                  disabled={fetching}
                  className="w-full py-2.5 bg-paper-sub hover:bg-paper-border text-paper-text-main text-xs font-bold transition flex items-center justify-center gap-1.5 border border-paper-border cursor-pointer shadow-2xs"
                >
                  {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 text-paper-caramel" />}
                  <span>{fetching ? "取得中..." : "自動取得"}</span>
                </button>
              </div>

              {checkMessage && (
                <div className={`mt-2 p-2.5 text-xs border flex items-center justify-between ${
                  existingBook 
                    ? "bg-[#FFF3CD] border-[#FFEEBA] text-[#856404]" 
                    : "bg-[#D4EDDA] border-[#C3E6CB] text-[#155724]"
                }`}>
                  <div>
                    <span>{checkMessage}</span>
                    {existingBook && (
                      <p className="mt-0.5 text-[11px]">
                        （登録日: {new Date(existingBook.created_at).toLocaleDateString()} / ステータス: {existingBook.status}）
                      </p>
                    )}
                  </div>
                  {existingBook && (
                    <button
                      type="button"
                      onClick={handleDeleteExistingBook}
                      className="text-[11px] bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>データを削除する</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* タイトル ＆ フリガナ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-paper-border">
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">
                  タイトル <span className="text-paper-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">フリガナ（並び替え用）</label>
                <input
                  type="text"
                  value={sortTitle}
                  onChange={(e) => setSortTitle(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main focus:outline-none focus:border-paper-caramel"
                />
              </div>
            </div>

            {/* サブタイトル ＆ 巻数 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-paper-text-sub mb-1">サブタイトル</label>
                <input
                  type="text"
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main focus:outline-none focus:border-paper-caramel"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">巻数</label>
                <input
                  type="text"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel font-mono"
                />
              </div>
            </div>

            {/* 著者名 ＆ 発行者 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">著者名</label>
                <input
                  type="text"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">発行者</label>
                <input
                  type="text"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel"
                />
              </div>
            </div>

            {/* 発行日（テキスト入力に変更し、年月にも対応） ＆ シリーズ名 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-paper-caramel" /> 発行日
                </label>
                <input
                  type="text"
                  placeholder="2017-07 または 2017-07-01 等"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main focus:outline-none focus:border-paper-caramel font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-paper-caramel" /> シリーズ名
                </label>
                <input
                  type="text"
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main focus:outline-none focus:border-paper-caramel"
                />
              </div>
            </div>

            {/* メモ欄（一番下） */}
            <div>
              <label className="block text-xs font-bold text-paper-text-sub mb-1">メモ</label>
              <textarea
                rows={2}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel leading-relaxed"
              />
            </div>

            {successMessage && (
              <div className="p-3 bg-[#E6F4EA] border border-[#A8DADC] text-[#1D3557] text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-[#2A9D8F]" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-[#F8D7DA] border border-[#F5C6CB] text-[#721C24] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 font-bold text-base transition cursor-pointer disabled:opacity-50 shadow-sm flex items-center justify-center gap-2 bg-paper-caramel text-white hover:opacity-95 rounded-none"
              >
                {existingBook ? <RefreshCw className="w-5 h-5" /> : null}
                {loading ? "処理中..." : existingBook ? "この内容で上書きする" : "本を登録"}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}