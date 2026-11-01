"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Search, BookOpen, Camera, Check } from "lucide-react";

type ExistingBookInfo = {
  title: string;
  created_at: string;
  location: string | null;
  status: string;
};

export default function AddBookPage() {
  const router = useRouter();

  // フォーム入力の状態
  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [imageLink, setImageLink] = useState("");
  const [status, setStatus] = useState<"持っている" | "欲しい">("持っている");
  const [location, setLocation] = useState("");
  const [memo, setMemo] = useState("");

  // ローディング・エラー・成功メッセージ
  const [loading, setLoading] = useState(false);
  const [fetchingApi, setFetchingApi] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [existingBook, setExistingBook] = useState<ExistingBookInfo | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  // 1. Google Books APIでISBNから自動取得
  const handleFetchByIsbn = async () => {
    if (!isbn.trim()) {
      alert("ISBNを入力してください");
      return;
    }

    setFetchingApi(true);
    setErrorMessage("");
    setExistingBook(null);

    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn.trim()}`);
      const data = await res.json();

      if (data.totalItems === 0 || !data.items) {
        setErrorMessage("Google Books APIに該当する書籍が見つかりませんでした。手動で入力してください。");
      } else {
        const volumeInfo = data.items[0].volumeInfo;
        setTitle(volumeInfo.title || "");
        setAuthors(volumeInfo.authors ? volumeInfo.authors.join(", ") : "");
        setPublisher(volumeInfo.publisher || "");
        setPublishedDate(volumeInfo.publishedDate || "");
        setImageLink(volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || "");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("情報の取得に失敗しました。ネットワーク状況を確認してください。");
    } finally {
      setFetchingApi(false);
    }
  };

  // 2. スマホカメラ等で画像ファイルをアップロード（Supabase Storageを使用しない場合の手軽なDataURL変換）
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

    // 既に同じISBNが登録されているかチェック（ISBNがある場合のみ）
    if (isbn.trim()) {
      const { data: foundData } = await supabase
        .from("books")
        .select("title, created_at, location, status")
        .eq("isbn", isbn.trim())
        .single();

      if (foundData) {
        setExistingBook(foundData);
        setLoading(false);
        return; // 重複がある場合は登録をストップして過去情報を表示
      }
    }

    // 登録実行
    const { error } = await supabase.from("books").insert([
      {
        title: title.trim(),
        authors: authors.trim() || null,
        publisher: publisher.trim() || null,
        published_date: publishedDate.trim() || null,
        image_link: imageLink.trim() || null,
        isbn: isbn.trim() || null,
        status: status,
        location: location.trim() || null,
        memo: memo.trim() || null,
      },
    ]);

    if (error) {
      console.error(error);
      if (error.code === "23505") {
        // 万が一の重複エラーコード
        setErrorMessage("このISBNの本はすでに登録されています。");
      } else {
        setErrorMessage(`登録に失敗しました: ${error.message}`);
      }
      setLoading(false);
    } else {
      setSuccessMessage("登録が完了しました！");
      setTimeout(() => {
        router.push(status === "持っている" ? "/" : "/wants");
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-20">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800 px-4 py-4 md:px-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>本棚に戻る</span>
          </Link>
          <h1 className="text-base font-bold tracking-wider text-neutral-100">本を登録する</h1>
          <div className="w-16" /> {/* バランス用 */}
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
          <div className="mb-8 p-5 bg-amber-950/60 border border-amber-700/80 text-amber-200">
            <h2 className="font-bold text-base mb-2 flex items-center gap-2">
              ⚠️ すでに登録されている本です
            </h2>
            <p className="text-sm mb-3">
              入力されたISBNの本は、すでに家族の本棚に登録されています。
            </p>
            <div className="bg-neutral-900/90 p-3 border border-amber-800/50 text-xs space-y-1 text-neutral-300">
              <p><strong className="text-neutral-100">タイトル:</strong> {existingBook.title}</p>
              <p><strong className="text-neutral-100">ステータス:</strong> {existingBook.status}</p>
              <p><strong className="text-neutral-100">保管場所:</strong> {existingBook.location || "未設定"}</p>
              <p><strong className="text-neutral-100">登録日:</strong> {new Date(existingBook.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        )}

        {/* エラーメッセージ */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-950 border border-red-800 text-red-200 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── 1. ISBN検索エリア ── */}
          <div className="bg-neutral-900 border border-neutral-800 p-5 space-y-4">
            <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wider">
              ISBN（バーコード数字）から自動取得
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
                <Search className="w-4 h-4" />
                <span>{fetchingApi ? "取得中..." : "自動取得"}</span>
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              ※裏表紙のバーコード上にある13桁の数字を入力すると、タイトルや表紙が自動で入力されます。
            </p>
          </div>

          {/* ── 2. 詳細情報入力エリア ── */}
          <div className="bg-neutral-900 border border-neutral-800 p-5 space-y-4">
            <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wider">
              書籍詳細（手動修正・入力）
            </h2>

            {/* ステータス選択 */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">登録ステータス</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="持っている"
                    checked={status === "持っている"}
                    onChange={() => setStatus("持っている")}
                    className="accent-neutral-100"
                  />
                  持っている本
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="欲しい"
                    checked={status === "欲しい"}
                    onChange={() => setStatus("欲しい")}
                    className="accent-neutral-100"
                  />
                  欲しい本（ウィッシュリスト）
                </label>
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
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
              />
            </div>

            {/* 著者名 */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">著者名</label>
              <input
                type="text"
                placeholder="著者名（複数いる場合はカンマ区切り）"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 出版社 */}
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">出版社</label>
                <input
                  type="text"
                  placeholder="出版社名"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
                />
              </div>

              {/* 保管場所 */}
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">保管場所（自由入力）</label>
                <input
                  type="text"
                  placeholder="例: リビングの棚、自分の部屋 など"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
                />
              </div>
            </div>

            {/* 表紙画像URL ＆ カメラ撮影アップロード */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">表紙画像（自動取得 または カメラ撮影）</label>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                {/* プレビュー画像 */}
                <div className="w-20 h-28 bg-neutral-950 border border-neutral-800 flex items-center justify-center overflow-hidden shrink-0">
                  {imageLink ? (
                    <img src={imageLink} alt="表紙プレビュー" className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="w-6 h-6 text-neutral-700" />
                  )}
                </div>

                <div className="flex-1 space-y-2 w-full">
                  <input
                    type="url"
                    placeholder="画像のURL（自動入力されます）"
                    value={imageLink}
                    onChange={(e) => setImageLink(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
                  />
                  {/* スマホカメラ・ファイル選択 */}
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
                    <p className="text-[11px] text-neutral-500 mt-1">
                      ※古い本や画像がない本は、カメラで表紙を撮影して登録できます。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* メモ */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">メモ</label>
              <textarea
                rows={2}
                placeholder="家族へのコメントや感想など..."
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