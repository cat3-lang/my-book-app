"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { BookOpen, Plus, Search, Trash2, ArrowLeft } from "lucide-react";

type Book = {
  id: string;
  title: string;
  volume: string | null;
  series: string | null;
  authors: string | null;
  publisher: string | null;
  isbn: string | null;
  status: "持っている" | "欲しい";
  summary: string | null;
  memo: string | null;
  release_date: string | null;
  created_at: string;
};

export default function WantsPage() {

// ログインしていない場合は強制的に /login へ飛ばす処理
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
      }
    };
    checkUser();
  }, []);  

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("status", "欲しい")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching books:", error);
    } else {
      setBooks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`「${title}」を削除してもよろしいですか？`)) return;

    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) {
      alert("削除に失敗しました: " + error.message);
    } else {
      setBooks(books.filter((b) => b.id !== id));
    }
  };

  const filteredBooks = books.filter((b) => {
    const q = searchQuery.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      (b.authors && b.authors.toLowerCase().includes(q)) ||
      (b.series && b.series.toLowerCase().includes(q)) ||
      (b.memo && b.memo.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-20">
      <header className="sticky top-0 z-10 bg-neutral-950/85 backdrop-blur-md border-b border-neutral-800 px-4 py-4 md:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-100 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>持っている本へ</span>
            </Link>
            <h1 className="text-base font-bold tracking-wider text-neutral-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" /> 欲しい本リスト
            </h1>
          </div>
          <Link
            href="/add"
            className="bg-neutral-100 hover:bg-neutral-300 text-neutral-950 text-xs font-bold px-3 py-2 rounded flex items-center gap-1 transition"
          >
            <Plus className="w-4 h-4" />
            <span>本を登録</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 md:px-8 space-y-6">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="タイトル、著者名、シリーズ名、メモで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 pl-9 pr-4 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 rounded"
          />
        </div>

        {loading ? (
          <p className="text-center text-neutral-500 py-10 text-sm">読み込み中...</p>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-16 space-y-3 bg-neutral-900/50 border border-neutral-800 rounded">
            <p className="text-sm text-neutral-400">欲しい本が登録されていません</p>
            <Link
              href="/add"
              className="inline-block text-xs font-bold text-neutral-950 bg-neutral-100 px-4 py-2 rounded hover:bg-neutral-300 transition"
            >
              欲しい本を登録する
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBooks.map((book) => (
              <div
                key={book.id}
                className="bg-neutral-900 border border-neutral-800 p-4 rounded flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-800 font-medium">
                      欲しい本
                    </span>
                    <button
                      onClick={() => handleDelete(book.id, book.title)}
                      className="text-neutral-500 hover:text-red-400 p-1 transition"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h2 className="text-sm font-bold text-neutral-100 mt-1">
                    {book.title} {book.volume ? `(${book.volume})` : ""}
                  </h2>
                  {book.series && (
                    <p className="text-xs text-neutral-400">シリーズ: {book.series}</p>
                  )}
                  {book.authors && (
                    <p className="text-xs text-neutral-400">著者: {book.authors}</p>
                  )}
                  {book.publisher && (
                    <p className="text-xs text-neutral-500">出版社: {book.publisher}</p>
                  )}
                  {book.release_date && (
                    <p className="text-xs text-neutral-400">発売日: {book.release_date}</p>
                  )}
                  {book.summary && (
                    <p className="text-xs text-neutral-300 bg-neutral-950 p-2 rounded mt-2 border border-neutral-800">
                      {book.summary}
                    </p>
                  )}
                  {book.memo && (
                    <p className="text-xs text-neutral-400 italic mt-1">メモ: {book.memo}</p>
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