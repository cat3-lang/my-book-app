"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Search, BookOpen, Check, X, Calendar, Layers } from "lucide-react";

type ExistingBookInfo = {
  title: string;
  created_at: string;
  status: string;
  memo: string | null;
};

// 簡易的なカタカナ変換（ひらがな→カタカナ）
function toKatakana(str: string) {
  return str.replace(/[\u3041-\u3096]/g, function (match) {
    var chr = match.charCodeAt(0) + 0x60;
    return String.fromCharCode(chr);
  });
}

export default function AddBookPage() {
  const router = useRouter();

  // フォーム入力の状態
  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [sortTitle, setSortTitle] = useState("");
  const [series, setSeries] = useState("");
  const [authors, setAuthors] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [imageLink, setImageLink] = useState("");
  const [status, setStatus] = useState<"持っている" | "欲しい">("持っている");
  
  // 登録日（クライアントサイドで安全に今日の日付を設定）
  const [registeredDate, setRegisteredDate] = useState("");

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    setRegisteredDate(todayStr);
  }, []);

  const [memo, setMemo] = useState("");

  const [loading, setLoading] = useState(false);
  const [fetchingApi, setFetchingApi] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [existingBook, setExistingBook] = useState<ExistingBookInfo | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const handleTitleChange = (val: string) => {
    setTitle(val);
    setSortTitle(toKatakana(val));
  };

  const handleFetchByIsbn = async () => {
    const cleanIsbn = isbn.trim();
    if (!cleanIsbn) {
      setErrorMessage("ISBNを入力してください。");
      return;
    }

    setFetchingApi(true);
    setErrorMessage("");
    setExistingBook(null);

    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
      const data = await res.json();

      if (data.totalItems === 0 || !data.items) {
        setErrorMessage("該当する書籍が見つかりませんでした。");
      } else {
        const volumeInfo = data.items[0].volumeInfo;
        const fetchedTitle = volumeInfo.title || "";
        setTitle(fetchedTitle);
        setSortTitle(toKatakana(fetchedTitle));
        setAuthors(volumeInfo.authors ? volumeInfo.authors.join(", ") : "");
        setPublisher(volumeInfo.publisher || "");
        setPublishedDate(volumeInfo.publishedDate || "");
        setImageLink(volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || "");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("情報の取得に失敗しました。");
    } finally {
      setFetchingApi(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("タイトルは必須です。");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setExistingBook(null);

    const cleanIsbn = isbn.trim();

    if (cleanIsbn) {
      const { data: foundData } = await supabase
        .from("books")
        .select("title, created_at, status, memo")
        .eq("isbn", cleanIsbn)
        .single();

      if (foundData) {
        setExistingBook(foundData);
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase.from("books").insert([
      {
        title: title.trim(),
        sort_title: sortTitle.trim() || title.trim(),
        series: series.trim() || null,
        authors: authors.trim() || null,
        publisher: publisher.trim() || null,
        published_date: publishedDate.trim() || null,
        image_link: imageLink.trim() || null,
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
      setSuccessMessage("登録が完了しました");
      setTimeout(() => {
        router.push(status === "持っている" ? "/" : "/wants");
      }, 800);
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
          <h1 className="text-base font-bold tracking-wider text-neutral-100">本を登録する</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 md:px-8">
        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-950 border border-emerald-800 text-emerald-200 text-sm flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {existingBook && (
          <div className="mb-8 p-5 bg-neutral-900 border border-neutral-700 text-neutral-200">
            <h2 className="font-bold text-base mb-2 text-neutral-100 flex items-center gap-2">
              ⚠️ すでに登録されている本です
            </h2>
            <div className="bg-neutral-950 p-3 border border-neutral-800 text-xs space-y-1 text-neutral-300 mt-2">
              <p><strong className="text-neutral-100">タイトル:</strong> {existingBook.title}</p>
              <p><strong className="text-neutral-100">ステータス:</strong> {existingBook.status}</p>
              <p><strong className="text-neutral-100">登録日:</strong> {new Date(existingBook.created_at).toLocaleDateString()}</p>
              {existingBook.memo && <p><strong className="text-neutral-100">メモ:</strong> {existingBook.memo}</p>}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-neutral-900 border border-red-500/50 text-red-300 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 p-5 space-y-3">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" /> ISBN
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="9784..."
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
              />
              <button
                type="button"
                onClick={handleFetchByIsbn}
                disabled={fetchingApi}
                className="px-4 py-2 bg-neutral-100 text-neutral-900 text-sm font-semibold hover:bg-neutral-300 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <span>{fetchingApi ? "取得中..." : "自動取得"}</span>
              </button>
            </div>
          </div>

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
              <label className="block text-xs font-medium text-neutral-400 mb-1">タイトル *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">フリガナ（並び替え用）</label>
                <input
                  type="text"
                  value={sortTitle}
                  onChange={(e) => setSortTitle(e.target.value)}
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
              <label className="block text-xs font-medium text-neutral-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> 登録日
              </label>
              <input
                type="date"
                value={registeredDate}
                onChange={(e) => setRegisteredDate(e.target.value)}
                className="w-full md:w-auto bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">表紙画像URL</label>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-20 h-28 bg-neutral-950 border border-neutral-800 flex items-center justify-center overflow-hidden shrink-0">
                  {imageLink ? (
                    <img src={imageLink} alt="表紙" className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="w-6 h-6 text-neutral-700" />
                  )}
                </div>

                <div className="flex-1 space-y-2 w-full">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={imageLink}
                      onChange={(e) => setImageLink(e.target.value)}
                      className="flex-1 bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-500"
                    />
                    {imageLink && (
                      <button
                        type="button"
                        onClick={() => setImageLink("")}
                        className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> クリア
                      </button>
                    )}
                  </div>
                </div>
              </div>
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-neutral-100 text-neutral-900 font-bold text-sm hover:bg-neutral-300 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? "登録中..." : "本棚に登録する"}
          </button>
        </form>
      </main>
    </div>
  );
}