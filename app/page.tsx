"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Search, Plus, Bookmark, SlidersHorizontal, BookOpen } from "lucide-react";

type Book = {
  id: string;
  title: string;
  authors: string | null;
  publisher: string | null;
  image_link: string | null;
  isbn: string | null;
  location: string | null;
  created_at: string;
};

export default function HomePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "title" | "author">("newest");

  // 1. Supabaseから「持っている」本を取得
  useEffect(() => {
    async function fetchBooks() {
      setLoading(true);
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("status", "持っている")
        .eq("is_sold", false);

      if (error) {
        console.error("データ取得エラー:", error.message);
      } else {
        setBooks(data || []);
      }
      setLoading(false);
    }

    fetchBooks();
  }, []);

  // 2. 検索・ソート処理のメモ化
  const filteredAndSortedBooks = useMemo(() => {
    let result = [...books];

    // 検索フィルタ（タイトル、著者、保管場所）
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.authors && b.authors.toLowerCase().includes(q)) ||
          (b.location && b.location.toLowerCase().includes(q))
      );
    }

    // ソート処理
    result.sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title, "ja");
      } else if (sortBy === "author") {
        return (a.authors || "").localeCompare(b.authors || "", "ja");
      } else {
        // newest (登録日の降順)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [books, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-20">
      {/* ── ヘッダー ── */}
      <header className="sticky top-0 z-10 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800 px-4 py-4 md:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-neutral-100" />
            <h1 className="text-xl font-bold tracking-wider text-neutral-100">
              ファミリー本棚
            </h1>
          </div>

          {/* 遷移ボタン群 */}
          <div className="flex items-center gap-2">
            <Link
              href="/wants"
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 transition text-neutral-300 font-medium"
            >
              <Bookmark className="w-4 h-4 text-neutral-400" />
              <span>欲しい本</span>
            </Link>
            <Link
              href="/add"
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-neutral-100 text-neutral-900 font-semibold hover:bg-neutral-300 transition"
            >
              <Plus className="w-4 h-4" />
              <span>本を登録</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 md:px-8">
        {/* ── 検索・ソートコントロールバー ── */}
        <section className="mb-8 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* 検索バー */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="タイトル・著者名・保管場所で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 pl-10 pr-4 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition"
            />
          </div>

          {/* ソート切り替え */}
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400">
            <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500" />
            <span>並び替え:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "title" | "author")}
              className="bg-transparent text-neutral-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="newest" className="bg-neutral-900 text-neutral-200">登録が新しい順</option>
              <option value="title" className="bg-neutral-900 text-neutral-200">タイトル順 (あかさたな)</option>
              <option value="author" className="bg-neutral-900 text-neutral-200">著者順</option>
            </select>
          </div>
        </section>

        {/* ── 本棚グリッド表示 ── */}
        {loading ? (
          <div className="text-center py-20 text-neutral-500 text-sm">
            読み込み中...
          </div>
        ) : filteredAndSortedBooks.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-neutral-800">
            <p className="text-neutral-500 text-sm mb-4">
              {searchQuery ? "条件に一致する本が見つかりませんでした。" : "まだ本が登録されていません。"}
            </p>
            {!searchQuery && (
              <Link
                href="/add"
                className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-900 text-sm font-semibold hover:bg-neutral-300 transition"
              >
                <Plus className="w-4 h-4" /> 最初の本を登録する
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {filteredAndSortedBooks.map((book) => (
              <div
                key={book.id}
                className="group relative bg-neutral-900 border border-neutral-800 hover:border-neutral-600 transition flex flex-col overflow-hidden"
              >
                {/* 表紙画像エリア */}
                <div className="aspect-[2/3] w-full bg-neutral-950 overflow-hidden relative border-b border-neutral-800 flex items-center justify-center">
                  {book.image_link ? (
                    <img
                      src={book.image_link}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="p-4 text-center">
                      <BookOpen className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                      <span className="text-xs text-neutral-600 line-clamp-2">画像なし</span>
                    </div>
                  )}
                  {/* 場所タグ */}
                  {book.location && (
                    <span className="absolute bottom-2 left-2 bg-neutral-950/90 text-neutral-300 border border-neutral-700 text-[10px] px-1.5 py-0.5 font-mono">
                      {book.location}
                    </span>
                  )}
                </div>

                {/* 書籍情報エリア */}
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-neutral-100 line-clamp-2 leading-snug mb-1 group-hover:text-white">
                      {book.title}
                    </h2>
                    <p className="text-xs text-neutral-400 line-clamp-1">
                      {book.authors || "著者不明"}
                    </p>
                  </div>
                  {book.publisher && (
                    <p className="text-[11px] text-neutral-500 mt-2 line-clamp-1">
                      {book.publisher}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}