"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, BookOpen, Check, Calendar, Layers, Camera, X, RefreshCw, Search } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

// 🔄 デプロイ確認用のバージョン番号
const APP_VERSION = "v1.0.9";

type ExistingBookInfo = {
  id: string;
  title: string;
  created_at: string;
  status: "持っている" | "欲しい";
  memo: string | null;
  volume?: string | null;
  series?: string | null;
  authors?: string | null;
  publisher?: string | null;
};

export default function AddBookPage() {
  const router = useRouter();

  // フォーム入力の状態
  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [volume, setVolume] = useState(""); 
  const [sortTitle, setSortTitle] = useState(""); 
  const [series, setSeries] = useState("");
  const [authors, setAuthors] = useState("");
  const [publisher, setPublisher] = useState(""); 
  const [status, setStatus] = useState<"持っている" | "欲しい">("持っている");
  
  const [registeredDate, setRegisteredDate] = useState("");

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    setRegisteredDate(todayStr);
  }, []);

  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [existingBook, setExistingBook] = useState<ExistingBookInfo | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [checkMessage, setCheckMessage] = useState<string | null>(null); // 確認ボタンの結果メッセージ

  // カメラ関連の状態
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // フォームクリア
  const clearForm = () => {
    setIsbn("");
    setTitle("");
    setVolume("");
    setSortTitle("");
    setSeries("");
    setAuthors("");
    setPublisher("");
    setMemo("");
    setExistingBook(null);
    setCheckMessage(null);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    setSortTitle(val);
  };

  // 🔍 重複確認（確認ボタンの処理）
  const handleCheckIsbn = async () => {
    const cleanIsbn = isbn.trim();
    if (!cleanIsbn) {
      setCheckMessage("ISBNを入力してください。");
      setExistingBook(null);
      return;
    }

    setErrorMessage("");
    const { data: foundData } = await supabase
      .from("books")
      .select("id, title, created_at, status, memo, volume, series, authors, publisher")
      .eq("isbn", cleanIsbn)
      .single();

    if (foundData) {
      // かぶっている場合：情報をフォームに自動反映
      setExistingBook(foundData);
      setTitle(foundData.title || "");
      setSortTitle(foundData.title || "");
      setStatus(foundData.status || "持っている");
      setMemo(foundData.memo || "");
      if (foundData.volume) setVolume(foundData.volume);
      if (foundData.series) setSeries(foundData.series);
      if (foundData.authors) setAuthors(foundData.authors);
      if (foundData.publisher) setPublisher(foundData.publisher);

      setCheckMessage("⚠️ すでに登録されています（情報をフォームに反映しました）");
    } else {
      // かぶっていない場合
      setExistingBook(null);
      setCheckMessage("✅ 未登録です（かぶりなし）");
    }
  };

  // カメラを起動してバーコード読み取りを開始する
  const startScanner = async () => {
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
            }
          },
          () => {}
        );
      } catch (err) {
        console.error("Camera start error:", err);
        setErrorMessage("カメラを起動できませんでした。権限が許可されているか確認してください。");
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

  // 登録または更新の実行
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("タイトルは必須です。");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const cleanIsbn = isbn.trim();

    if (existingBook) {
      const { error } = await supabase
        .from("books")
        .update({
          title: title.trim(),
          sort_title: sortTitle.trim() || title.trim(),
          volume: volume.trim() || null,
          series: series.trim() || null,
          authors: authors.trim() || null,
          publisher: publisher.trim() || null,
          status: status,
          memo: memo.trim() || null,
        })
        .eq("id", existingBook.id);

      if (error) {
        console.error(error);
        setErrorMessage(`更新に失敗しました: ${error.message}`);
        setLoading(false);
      } else {
        setSuccessMessage("既存のデータを更新しました！");
        clearForm();
        setTimeout(() => {
          router.push(status === "持っている" ? "/" : "/wants");
        }, 800);
      }
    } else {
      const { error } = await supabase.from("books").insert([
        {
          title: title.trim(),
          sort_title: sortTitle.trim() || title.trim(),
          volume: volume.trim() || null,
          series: series.trim() || null,
          authors: authors.trim() || null,
          publisher: publisher.trim() || null,
          image_link: null,
          isbn: cleanIsbn || null,
          status: status,
          created_at: registeredDate ? new Date(registeredDate).toISOString() : new Date().toISOString(),
          memo: memo.trim() || null,
        },
      ]);

      if (error) {
        console.error(error);
        if (error.code === "23505") {
          setErrorMessage("このISBNの本はすでに登録されています。");
        } else {
          setErrorMessage(`登録に失敗しました: ${error.message}`);
        }
        setLoading(false);
      } else {
        setSuccessMessage("登録が完了しました！");
        clearForm();
        setTimeout(() => {
          router.push(status === "持っている" ? "/" : "/wants");
        }, 800);
      }
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-20">
      <header className="sticky top-0 z-10 bg-neutral-950/85 backdrop-blur-md border-b border-neutral-800 px-4 py-4 md:px-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>本棚に戻る</span>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-wider text-neutral-100">本を登録する</h1>
            <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono">
              {APP_VERSION}
            </span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      {/* カメラ読み取りモーダル */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 p-4 rounded-lg relative">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-neutral-200">バーコードを枠内に合わせてください</h2>
              <button
                type="button"
                onClick={stopScanner}
                className="p-1 text-neutral-400 hover:text-neutral-100 bg-neutral-800 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div id="reader" className="w-full overflow-hidden rounded bg-black"></div>
            <p className="text-xs text-neutral-400 text-center mt-3">
              本の裏表紙にある「978」から始まるバーコードをスキャンします
            </p>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-8 md:px-8">
        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-950 border border-emerald-800 text-emerald-200 text-sm flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-neutral-900 border border-neutral-700 text-neutral-300 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 上部の登録/更新ボタン */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 font-bold text-sm transition cursor-pointer disabled:opacity-50 rounded shadow-md flex items-center justify-center gap-2 ${
              existingBook
                ? "bg-amber-500 text-neutral-950 hover:bg-amber-400"
                : "bg-neutral-100 text-neutral-900 hover:bg-neutral-300"
            }`}
          >
            {existingBook ? <RefreshCw className="w-4 h-4" /> : null}
            {loading ? "処理中..." : existingBook ? "この内容でデータを更新（上書き）する" : "本棚に登録する"}
          </button>

          <div className="bg-neutral-900 border border-neutral-800 p-5 space-y-4">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> 書籍詳細
            </h2>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">ステータス</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus("持っている")}
                  className={`py-2 text-xs font-bold border transition cursor-pointer ${
                    status === "持っている"
                      ? "bg-neutral-100 text-neutral-950 border-neutral-100"
                      : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  持っている本
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("欲しい")}
                  className={`py-2 text-xs font-bold border transition cursor-pointer ${
                    status === "欲しい"
                      ? "bg-neutral-100 text-neutral-950 border-neutral-100"
                      : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  欲しい本
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-neutral-400">ISBN</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={startScanner}
                    className="cursor-pointer text-xs text-neutral-200 bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded flex items-center gap-1.5 transition font-semibold"
                  >
                    <Camera className="w-3.5 h-3.5 text-neutral-300" />
                    <span>カメラでバーコード読み取り</span>
                  </button>
                </div>
              </div>

              {/* ISBN入力欄 ＋ 「確認ボタン」 ＋ 「自動更新ボタン（デザインのみ）」 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="9784..."
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  className="flex-1 bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleCheckIsbn}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition flex items-center gap-1 border border-neutral-700 cursor-pointer whitespace-nowrap"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>確認</span>
                </button>
                <button
                  type="button"
                  disabled
                  className="px-3 py-2 bg-neutral-900 text-neutral-600 text-xs font-bold border border-neutral-800 cursor-not-allowed whitespace-nowrap"
                  title="後日実装予定"
                >
                  自動更新
                </button>
              </div>

              {/* 確認ボタンの結果メッセージ */}
              {checkMessage && (
                <div className={`mt-2 p-2.5 text-xs rounded border ${
                  existingBook 
                    ? "bg-amber-950/70 border-amber-800 text-amber-200" 
                    : "bg-emerald-950/70 border-emerald-800 text-emerald-200"
                }`}>
                  {checkMessage}
                  {existingBook && (
                    <p className="mt-1 text-[11px] text-amber-300">
                      （登録日: {new Date(existingBook.created_at).toLocaleDateString()} / ステータス: {existingBook.status}）
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-neutral-400 mb-1">タイトル *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">巻数 (例: 20)</label>
                <input
                  type="text"
                  placeholder="空白可"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">フリガナ（並び替え用・ひらがな/カタカナ）</label>
                <input
                  type="text"
                  value={sortTitle}
                  onChange={(e) => setSortTitle(e.target.value)}
                  placeholder="例: じゅじゅつかいせん"
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> シリーズ名
                </label>
                <input
                  type="text"
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">著者名</label>
                <input
                  type="text"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">発行社</label>
                <input
                  type="text"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> 登録日
              </label>
              <input
                type="date"
                value={registeredDate}
                onChange={(e) => setRegisteredDate(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">メモ（キーワード検索に活用できます）</label>
              <textarea
                rows={2}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
              />
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}