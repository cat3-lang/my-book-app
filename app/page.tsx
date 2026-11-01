"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Plus, Search, ChevronDown, ChevronUp, Edit3, Trash2, BookOpen, Eye, EyeOff } from "lucide-react";

type Book = {
  id: string;
  title: string;
  sort_title: string | null;
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

export default function HomePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false); // 検索エリアの開閉
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc"); // あいうえお順
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null); // 行ごとの詳細展開用ID

  const fetchBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("status", "持っている")
      .order("sort_title", { ascending: sortOrder === "asc" });

    if (error) {
      console.error("Error fetching books:", error);
    } else {
      setBooks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBooks();
  }, [sortOrder]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`「${title}」を削除してもよろしいですか？`)) return;

    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) {
      alert("削除に失敗しました: " + error.message);
    } else {
      setBooks(books.filter((b) => b.id !== id));
    }
  };

  // 検索フィルター（タイトル、シリーズ、著者、出版社、メモ、あらすじ、ISBNをすべて対象に検索）
  const filteredBooks = books.filter((b) => {
    const q = searchQuery.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      (b.series && b.series.toLowerCase().includes(q)) ||
      (b.authors && b.authors.toLowerCase().includes(q)) ||
      (b.publisher && b.publisher.toLowerCase().includes(q)) ||
      (b.memo && b.memo.toLowerCase().includes(q)) ||
      (b.summary && b.summary.toLowerCase().includes(q)) ||
      (b.isbn && b.isbn.toLowerCase().includes(q))
    );
  });

  const toggleRowExpand = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-20">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-neutral-950/85 backdrop-blur-md border-b border-neutral-800 px-4 py-4 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold tracking-wider text-neutral-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" /> 本棚（持っている本）
            </h1>
            <Link
              href="/wants"
              className="text-xs text-neutral-400 hover:text-neutral-200 underline transition"
            >
              欲しい本リストへ
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs px-3 py-2 rounded flex items-center gap-1.5 transition cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>検索・並び替え</span>
              {isSearchOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <Link
              href="/add"
              className="bg-neutral-100 hover:bg-neutral-300 text-neutral-950 text-xs font-bold px-3 py-2 rounded flex items-center gap-1 transition"
            >
              <Plus className="w-4 h-4" />
              <span>本を登録</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 md:px-8 space-y-4">
        {/* 開閉可能な検索・並び替えパネル */}
        {isSearchOpen && (
          <div className="bg-neutral-900 border border-neutral-800 p-4 rounded space-y-3 transition-all">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-2/3">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="タイトル、著者、シリーズ、メモ、あらすじ、ISBNなどでキーワード検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 pl-9 pr-4 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 rounded"
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <span className="text-xs text-neutral-400">あいうえお順:</span>
                <button
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs px-3 py-1.5 rounded hover:bg-neutral-800 transition cursor-pointer"
                >
                  {sortOrder === "asc" ? "昇順 (あ→わ)" : "降順 (わ→あ)"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* すっきりとしたエクセル風テーブルレイアウト */}
        {loading ? (
          <p className="text-center text-neutral-500 py-10 text-xs">読み込み中...</p>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-16 space-y-3 bg-neutral-900/50 border border-neutral-800 rounded">
            <p className="text-xs text-neutral-400">登録されている本はありません</p>
            <Link
              href="/add"
              className="inline-block text-xs font-bold text-neutral-950 bg-neutral-100 px-4 py-2 rounded hover:bg-neutral-300 transition"
            >
              最初の本を登録する
            </Link>
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-950/70 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider">
                  <th className="p-3">タイトル</th>
                  <th className="p-3 w-20 text-center">巻数</th>
                  <th className="p-3 w-28">登録日</th>
                  <th className="p-3 text-right w-32">詳細・操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 text-neutral-200">
                {filteredBooks.map((book) => {
                  const isExpanded = expandedRowId === book.id;
                  return (
                    <>
                      <tr 
                        key={book.id} 
                        className="hover:bg-neutral-800/40 transition cursor-pointer"
                        onClick={() => toggleRowExpand(book.id)}
                      >
                        <td className="p-3 font-medium text-neutral-100">
                          {book.title}
                        </td>
                        <td className="p-3 font-mono text-center text-neutral-300">
                          {book.volume || "—"}
                        </td>
                        <td className="p-3 font-mono text-neutral-400">
                          {book.created_at ? book.created_at.split("T")[0] : "—"}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => toggleRowExpand(book.id)}
                              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                                isExpanded 
                                  ? "bg-neutral-700 text-neutral-100" 
                                  : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                              }`}
                            >
                              {isExpanded ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              <span>{isExpanded ? "閉じる" : "詳細"}</span>
                            </button>
                            <Link
                              href={`/add?id=${book.id}`}
                              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition"
                              title="編集"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              onClick={() => handleDelete(book.id, book.title)}
                              className="p-1.5 bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-400 rounded transition"
                              title="削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* 行をクリックまたは「詳細」ボタンで展開される詳細情報エリア */}
                      {isExpanded && (
                        <tr key={`${book.id}-detail`} className="bg-neutral-950/60 border-b border-neutral-800">
                          <td colSpan={4} className="p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              <div>
                                <span className="text-neutral-500 block text-[10px]">シリーズ名</span>
                                <span className="text-neutral-200">{book.series || "—"}</span>
                              </div>
                              <div>
                                <span className="text-neutral-500 block text-[10px]">著者名</span>
                                <span className="text-neutral-200">{book.authors || "—"}</span>
                              </div>
                              <div>
                                <span className="text-neutral-500 block text-[10px]">出版社</span>
                                <span className="text-neutral-200">{book.publisher || "—"}</span>
                              </div>
                              <div>
                                <span className="text-neutral-500 block text-[10px]">発売日</span>
                                <span className="text-neutral-200 font-mono">{book.release_date || "—"}</span>
                              </div>
                              <div>
                                <span className="text-neutral-500 block text-[10px]">ISBN</span>
                                <span className="text-neutral-200 font-mono">{book.isbn || "—"}</span>
                              </div>
                            </div>

                            {book.summary && (
                              <div className="pt-1">
                                <span className="text-neutral-500 block text-[10px] mb-0.5">あらすじ</span>
                                <p className="text-xs text-neutral-300 bg-neutral-900 p-2.5 rounded border border-neutral-800 leading-relaxed">
                                  {book.summary}
                                </p>
                              </div>
                            )}

                            {book.memo && (
                              <div className="pt-1">
                                <span className="text-neutral-500 block text-[10px] mb-0.5">メモ</span>
                                <p className="text-xs text-neutral-300 bg-neutral-900 p-2.5 rounded border border-neutral-800 italic">
                                  {book.memo}
                                </p>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}