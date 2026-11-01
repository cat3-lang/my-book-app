"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Search, BookOpen, Camera, Check, X, Calendar, Layers, Hash } from "lucide-react";

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
  const [sortTitle, setSortTitle] = useState(""); // フリガナ（並び替え用）
  const [series, setSeries] = useState(""); // シリーズ名
  const [authors, setAuthors] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [imageLink, setImageLink] = useState("");
  const [status, setStatus] = useState<"持っている" | "欲しい">("持っている");
  
  // 今日の日付を YYYY-MM-DD 形式で取得
  const todayStr = new Date().toISOString().split("T")[0];
  const [registeredDate, setRegisteredDate] = useState(todayStr);

  const [memo, setMemo] = useState("");

  // ローディング・エラー・成功メッセージ
  const [loading, setLoading] = useState(false);
  const [fetchingApi, setFetchingApi] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [existingBook, setExistingBook] = useState<ExistingBookInfo | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  // タイトル変更時にフリガナを自動生成
  const handleTitleChange = (val: string) => {
    setTitle(val);
    // 自動で簡易カタカナ化してソート用にセット（手動修正も可）
    setSortTitle(toKatakana(val));
  };

  // 1. Google Books APIでISBNから自動取得
  const handleFetchByIsbn = async () => {
    const cleanIsbn = isbn.trim();
    if (!cleanIsbn) {
      setErrorMessage("ISBN（バーコードの数字）を入力してください。");
      return;
    }

    setFetchingApi(true);
    setErrorMessage("");
    setExistingBook(null);

    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
      const data = await res.json();

      if (data.totalItems === 0 || !data.items) {
        setErrorMessage("該当する書籍が見つかりませんでした。手動で入力してください。");
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

  // 2. 画像ファイル選択・カメラ撮影
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageLink(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 3. データベースへ登録する処理（重複チェック含む）
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

    // 既に同じISBNが登録されているかチェック
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

    // 登録実行
    const { error } = await supabase.from("books").insert([
      {
        title: title.trim(),
        sort_title: sortTitle.trim() || title.trim(),
        series: series.trim() || null,
        authors: authors.trim() || null,
        publisher: publisher.trim() || null,
        published_date: publishedDate.trim() || null,
        image_link: image_link_sanitized(imageLink),
        isbn: cleanIsbn || null,
        status: status,
        created_at: new Date(registeredDate).toISOString(), // 選択された登録日を反映
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
      setTimeout(() => {
        router.push(status === "持っている" ? "/" : "/wants");
      }, 800);
    }
  };

  const image_link_sanitized = (link: string) => {
    return link.trim() || null;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-20">
      {/* ヘッダー */}
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
        {/* 成功メッセージ */}
        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-950 border border-emerald-800 text-emerald-200 text-sm flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 重複エラー時の過去情報表示 */}
        {existingBook && (
          <div className="mb-8 p-5 bg-neutral-900 border border-neutral-700 text-neutral-200">
            <h2 className="font-bold text-base mb-2 text-neutral-100 flex items-center gap-2">
              ⚠️ すでに登録されている本です
            </h2>
            <p className="text-sm mb-3 text-neutral-400">
              入力されたISBNの本は、すでに登録されています。
            </p>
            <div className="bg-neutral-950 p-3 border border-neutral-800 text-xs space-y-1 text-neutral-300">
              <p><strong className="text-neutral-100">タイトル:</strong> {existingBook.title}</p>
              <p><strong className="text-neutral-100">ステータス:</strong> {existingBook.status}</p>
              <p><strong className="text-neutral-100">登録日:</strong> {new Date(existingBook.created_at).toLocaleDateString()}</p>
              {existingBook.memo && <p><strong className="text-neutral-100">メモ:</strong> {existingBook.memo}</p>}
            </div>
          </div>
        )}

        {/* エラーメッセージ */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-neutral-900 border border-red-500/50 text-red-300 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── 1. ISBN検索エリア ── */}
          <div className="bg-neutral-900 border border-neutral-800 p-5 space-y-3">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" /> ISBN（バーコード数字）から自動取得
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="例: 9784101010011"
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
            <p className="text-[11px] text-neutral-500">
              ※バーコードの13桁を入力して自動取得できます。空欄のまま手入力も可能です。
            </p>
          </div>

          {/* ── 2. 詳細情報入力エリア ── */}
          <div className="bg-neutral-900 border border-neutral-800 p-5 space-y-4">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> 書籍詳細
            </h2>

            {/* ステータス選択（視認性を高めたモノトーンボタン） */}
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

            {/* タイトル */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">タイトル *</label>
              <input
                type="text"
                required
                placeholder="本のタイトル"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
              />
            </div>

            {/* フリガナ（あかさたな順ソート用） & シリーズ名 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">フリガナ（あかさたな順用）</label>
                <input
                  type="text"
                  placeholder="例: キドウセンシガンダム"
                  value={sortTitle}
                  onChange={(e) => setSortTitle(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> シリーズ名
                </label>
                <input
                  type="text"
                  placeholder="例: ハリーポッター"
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
                />
              </div>
            </div>

            {/* 著者名 */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">著者名</label>
              <input
                type="text"
                placeholder="著者名"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
              />
            </div>

            {/* 登録日（自動＆変更可） */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> 登録日（変更可能）
              </label>
              <input
                type="date"
                value={registeredDate}
                onChange={(e) => setRegisteredDate(e.target.value)}
                className="w-full md:w-auto bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-500"
              />
            </div>

            {/* 表紙画像 ＆ クリア ＆ カメラ撮影 */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">表紙画像</label>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-20 h-28 bg-neutral-950 border border-neutral-800 flex items-center justify-center overflow-hidden shrink-0 relative group">
                  {imageLink ? (
                    <>
                      <img src={imageLink} alt="表紙" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImageLink("")}
                        className="absolute inset-0 bg-neutral-950/80 text-white opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-[10px]"
                      >
                        <X className="w-4 h-4 mb-1" /> クリア
                      </button>
                    </>
                  ) : (
                    <BookOpen className="w-6 h-6 text-neutral-700" />
                  )}
                </div>

                <div className="flex-1 space-y-2 w-full">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="画像のURL"
                      value={imageLink}
                      onChange={(e) => setImageLink(e.target.value)}
                      className="flex-1 bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
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
                  <div>
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer transition">
                      <Camera className="w-4 h-4 text-neutral-400" />
                      <span>スマホで表紙を撮影 / 画像を選択</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* メモ */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">メモ（場所や家族へのコメントなど）</label>
              <textarea
                rows={2}
                placeholder="例: リビングの本棚下段、全巻揃ったなど..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
              />
            </div>
          </div>

          {/* 登録ボタン */}
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