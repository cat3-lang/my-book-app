"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BookOpen, Search, ArrowLeft, Check, AlertCircle, Loader2, Camera } from "lucide-react";

export default function AddBookPage() {
  const router = useRouter();

  // フォームの状態
  const [title, setTitle] = useState("");
  const [sortTitle, setSortTitle] = useState("");
  const [volume, setVolume] = useState("");
  const [series, setSeries] = useState("");
  const [authors, setAuthors] = useState("");
  const [publisher, setPublisher] = useState("");
  const [isbn, setIsbn] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [summary, setSummary] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<"持っている" | "欲しい">("持っている");

  // 自動取得の状態
  const [isbnInput, setIsbnInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ISBN自動取得ハンドラー（サーバーAPI経由でCORS回避）
  const handleAutoFetch = async () => {
    const cleanIsbn = isbnInput.replace(/[^0-9X]/gi, "").trim();
    if (!cleanIsbn || (cleanIsbn.length !== 10 && cleanIsbn.length !== 13)) {
      setFetchMsg({ type: "error", text: "有効なISBNを入力してください。" });
      return;
    }

    setFetching(true);
    setFetchMsg(null);

    try {
      const res = await fetch(`/api/book-fetch?isbn=${cleanIsbn}`);
      const data = await res.json();

      if (data && data.success) {
        if (data.title) setTitle(data.title);
        if (data.authors) setAuthors(data.authors);
        if (data.publisher) setPublisher(data.publisher);
        if (data.releaseDate) setReleaseDate(data.releaseDate);
        if (data.summary) setSummary(data.summary);
        setIsbn(cleanIsbn);

        setFetchMsg({
          type: "success",
          text: "書籍情報を自動取得しました！",
        });
      } else {
        setFetchMsg({
          type: "error",
          text: "該当する書籍が見つかりませんでした。",
        });
      }
    } catch (err) {
      console.error(err);
      setFetchMsg({ type: "error", text: "取得に失敗しました。" });
    } finally {
      setFetching(false);
    }
  };

  // DB保存処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("タイトルを入力してください。");
      return;
    }

    setSubmitting(true);

    const newBook = {
      title: title.trim(),
      sort_title: sortTitle.trim() || title.trim(),
      volume: volume.trim() || null,
      series: series.trim() || null,
      authors: authors.trim() || null,
      publisher: publisher.trim() || null,
      isbn: isbn.trim() || null,
      release_date: releaseDate || null,
      summary: summary.trim() || null,
      memo: memo.trim() || null,
      status: status,
    };

    const { error } = await supabase.from("books").insert([newBook]);

    if (error) {
      alert("登録に失敗しました: " + error.message);
      setSubmitting(false);
    } else {
      alert(`「${title}」を登録しました！`);
      if (status === "欲しい") {
        router.push("/wants");
      } else {
        router.push("/");
      }
    }
  };

  return (
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-28">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-paper-card/95 backdrop-blur-md border-b border-paper-border px-4 py-3 md:px-8">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-bold text-paper-text-main flex items-center gap-1 bg-paper-sub px-3 py-1.5 border border-paper-border hover:bg-paper-border transition"
          >
            <ArrowLeft className="w-4 h-4" /> 戻る
          </Link>
          <h1 className="text-sm font-bold tracking-wider text-paper-text-main flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-paper-caramel" /> 本の新規登録
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* ISBN自動取得エリア */}
        <div className="bg-paper-card border border-paper-border p-4 md:p-5 rounded-none space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-paper-border pb-2">
            <h2 className="text-xs font-bold text-paper-text-main flex items-center gap-1.5">
              <Search className="w-4 h-4 text-paper-caramel" /> ISBN自動取得
            </h2>
            {/* カメラ読み取り機能へのダミー/導線 */}
            <button
              type="button"
              onClick={() => alert("カメラによるバーコード読み取り機能は準備中です")}
              className="text-xs text-paper-caramel flex items-center gap-1 bg-paper-sub px-2.5 py-1 border border-paper-border hover:bg-paper-border font-bold cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" /> カメラ読取
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="例: 9784041109229"
              value={isbnInput}
              onChange={(e) => setIsbnInput(e.target.value)}
              className="flex-1 bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main placeholder-paper-text-muted focus:outline-none focus:border-paper-caramel font-mono"
            />
            <button
              type="button"
              onClick={handleAutoFetch}
              disabled={fetching}
              className="bg-paper-caramel hover:opacity-90 text-white px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>{fetching ? "取得中..." : "自動取得"}</span>
            </button>
          </div>

          {fetchMsg && (
            <div
              className={`p-3 text-xs flex items-center gap-2 border ${
                fetchMsg.type === "success"
                  ? "bg-[#E6F4EA] border-[#A8DADC] text-[#1D3557]"
                  : "bg-[#F8D7DA] border-[#F5C6CB] text-[#721C24]"
              }`}
            >
              {fetchMsg.type === "success" ? (
                <Check className="w-4 h-4 shrink-0 text-[#2A9D8F]" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{fetchMsg.text}</span>
            </div>
          )}
        </div>

        {/* 登録フォーム */}
        <form onSubmit={handleSubmit} className="bg-paper-card border border-paper-border p-4 md:p-6 space-y-4 shadow-sm">
          <div className="border-b border-paper-border pb-2">
            <h2 className="text-xs font-bold text-paper-text-main">登録情報</h2>
          </div>

          {/* 登録先（シンプル表示） */}
          <div>
            <label className="text-xs text-paper-text-sub block mb-1 font-bold">保存先</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-paper-text-main cursor-pointer font-bold">
                <input
                  type="radio"
                  name="status"
                  value="持っている"
                  checked={status === "持っている"}
                  onChange={() => setStatus("持っている")}
                  className="accent-[#8C5E3C]"
                />
                本棚
              </label>
              <label className="flex items-center gap-2 text-sm text-paper-text-main cursor-pointer font-bold">
                <input
                  type="radio"
                  name="status"
                  value="欲しい"
                  checked={status === "欲しい"}
                  onChange={() => setStatus("欲しい")}
                  className="accent-[#8C5E3C]"
                />
                欲しい本
              </label>
            </div>
          </div>

          {/* タイトル ＆ フリガナ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-paper-text-sub block mb-1 font-bold">
                タイトル <span className="text-paper-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 君の名は。"
                className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel"
              />
            </div>
            <div>
              <label className="text-xs text-paper-text-sub block mb-1 font-bold">フリガナ</label>
              <input
                type="text"
                value={sortTitle}
                onChange={(e) => setSortTitle(e.target.value)}
                placeholder="例: きみのなは"
                className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel"
              />
            </div>
          </div>

          {/* 巻数 ＆ シリーズ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-paper-text-sub block mb-1 font-bold">巻数</label>
              <input
                type="text"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder="例: 1"
                className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-paper-text-sub block mb-1 font-bold">シリーズ</label>
              <input
                type="text"
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                placeholder="例: 角川文庫"
                className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel"
              />
            </div>
          </div>

          {/* 著者 ＆ 出版社 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-paper-text-sub block mb-1 font-bold">著者</label>
              <input
                type="text"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="例: 新海誠"
                className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel"
              />
            </div>
            <div>
              <label className="text-xs text-paper-text-sub block mb-1 font-bold">出版社</label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="例: KADOKAWA"
                className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel"
              />
            </div>
          </div>

          {/* ISBN ＆ 発売日 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-paper-text-sub block mb-1 font-bold">ISBN</label>
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="例: 9784041109229"
                className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-paper-text-sub block mb-1 font-bold">発売日</label>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel font-mono"
              />
            </div>
          </div>

          {/* あらすじ */}
          <div>
            <label className="text-xs text-paper-text-sub block mb-1 font-bold">あらすじ</label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="あらすじ"
              className="w-full bg-paper-inner border border-paper-border p-2.5 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel leading-relaxed"
            />
          </div>

          {/* メモ */}
          <div>
            <label className="text-xs text-paper-text-sub block mb-1 font-bold">メモ</label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="メモ"
              className="w-full bg-paper-inner border border-paper-border p-2.5 text-sm text-paper-text-main focus:outline-none focus:border-paper-caramel leading-relaxed"
            />
          </div>

          {/* 送信ボタン */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-paper-caramel hover:opacity-90 text-white font-bold py-3 text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {submitting ? "登録中..." : "登録する"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}