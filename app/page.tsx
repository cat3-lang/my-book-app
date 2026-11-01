"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Plus, Search, Edit3, Trash2, BookOpen, Eye, EyeOff, Layers } from "lucide-react";

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

// タイトルごとにまとめたグループの型
type GroupedBook = {
  title: string;
  sort_title: string;
  series: string | null;
  authors: string | null;
  publisher: string | null;
  books: Book[]; // 所持している各巻
};

export default function HomePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false); // 検索エリアの開閉
  const [expandedTitle, setExpandedTitle] = useState<string | null>(null); // タイトルごとの詳細展開用

  const fetchBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("status", "持っている")
      .order("sort_title", { ascending: true }); // デフォルトであいうえお順

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

  const handleDelete = async (id: string, title: string, volume: string | null) => {
    const volStr = volume ? ` (${volume})` : "";
    if (!confirm(`「${title}${volStr}」を削除してもよろしいですか？`)) return;

    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) {
      alert("削除に失敗しました: " + error.message);
    } else {
      setBooks(books.filter((b) => b.id !== id));
    }
  };

  // 🔍 検索フィルター（ひらがな・カタカナ・漢字などを広くカバー）
  const filteredBooks = books.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const title = b.title.toLowerCase();
    const sortTitle = (b.sort_title || "").toLowerCase();
    const series = (b.series || "").toLowerCase();
    const authors = (b.authors || "").toLowerCase();
    const publisher = (b.publisher || "").toLowerCase();
    const memo = (b.memo || "").toLowerCase();
    const summary = (b.summary || "").toLowerCase();
    const isbn = (b.isbn || "").toLowerCase();

    return (
      title.includes(q) ||
      sortTitle.includes(q) ||
      series.includes(q) ||
      authors.includes(q) ||
      publisher.includes(q) ||
      memo.includes(q) ||
      summary.includes(q) ||
      isbn.includes(q)
    );
  });

  // タイトルごとにグループ化する処理
  const groupedBooksMap: { [key: string]: GroupedBook } = {};
  filteredBooks.forEach((book) => {
    const key = book.title;
    if (!groupedBooksMap[key]) {
      groupedBooksMap[key] = {
        title: book.title,
        sort_title: book.sort_title || book.title,
        series: book.series,
        authors: book.authors,
        publisher: book.publisher,
        books: [],
      };
    }
    groupedBooksMap[key].books.push(book);
  });

  // あいうえお順（sort_title）でグループをソート
  const groupedBooksList = Object.values(groupedBooksMap).sort((a, b) =>
    a.sort_title.localeCompare(b.sort_title, "ja")
  );

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
              <span>検索・絞り込み</span>
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
        {/* 開閉可能な検索パネル */}
        {isSearchOpen && (
          <div className="bg-neutral-900 border border-neutral-800 p-4 rounded space-y-3 transition-all">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="タイトル、ひらがな読み、著者、シリーズ、メモ、あらすじ等で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 pl-9 pr-4 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 rounded"
              />
            </div>
            <p className="text-[11px] text-neutral-500">
              ※ひらがな、カタカナ、漢字でのキーワード検索に対応しています。
            </p>
          </div>
        )}

        {/* テーブルレイアウト（タイトルごとにまとめる形式） */}
        {loading ? (
          <p className="text-center text-neutral-500 py-10 text-xs">読み込み中...</p>
        ) : groupedBooksList.length === 0 ? (
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
                  <th className="p-3 w-40">所持巻数一覧</th>
                  <th className="p-3 w-28">登録日</th>
                  <th className="p-3 text-right w-28">詳細・操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 text-neutral-200">
                {groupedBooksList.map((group) => {
                  const isExpanded = expandedTitle === group.title;
                  // 代表として最初の本、または最新の登録日を採用
                  const latestBook = group.books[0];

                  return (
                    <>
                      <tr 
                        key={group.title} 
                        className="hover:bg-neutral-800/40 transition cursor-pointer"
                        onClick={() => setExpandedTitle(isExpanded ? null : group.title)}
                      >
                        <td className="p-3 font-medium text-neutral-100">
                          <div>{group.title}</div>
                          {group.series && (
                            <div className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                              <Layers className="w-3 h-3" /> シリーズ: {group.series}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-neutral-300">
                          <div className="flex flex-wrap gap-1">
                            {group.books.map((b) => (
                              <span 
                                key={b.id} 
                                className="bg-neutral-800 text-neutral-200 px-2 py-0.5 rounded text-[11px] border border-neutral-700"
                              >
                                {b.volume ? `${b.volume}巻` : "単巻/全"}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-neutral-400">
                          {latestBook.created_at ? latestBook.created_at.split("T")[0] : "—"}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setExpandedTitle(isExpanded ? null : group.title)}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ml-auto ${
                              isExpanded 
                                ? "bg-neutral-700 text-neutral-100" 
                                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                            }`}
                          >
                            {isExpanded ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{isExpanded ? "閉じる" : "詳細"}</span>
                          </button>
                        </td>
                      </tr>

                      {/* 詳細展開エリア（巻ごとの編集・削除や、あらすじ・メモなど） */}
                      {isExpanded && (
                        <tr key={`${group.title}-detail`} className="bg-neutral-950/70 border-b border-neutral-800">
                          <td colSpan={4} className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs border-b border-neutral-800 pb-3">
                              <div>
                                <span className="text-neutral-500 block text-[10px]">著者名</span>
                                <span className="text-neutral-200">{group.authors || "—"}</span>
                              </div>
                              <div>
                                <span className="text-neutral-500 block text-[10px]">出版社</span>
                                <span className="text-neutral-200">{group.publisher || "—"}</span>
                              </div>
                              <div>
                                <span className="text-neutral-500 block text-[10px]">登録巻数 / 冊数</span>
                                <span className="text-neutral-200 font-mono">{group.books.length}冊登録中</span>
                              </div>
                            </div>

                            {/* 各巻ごとの個別詳細・操作リスト */}
                            <div className="space-y-2">
                              <span className="text-neutral-400 text-[11px] font-bold block">巻ごとの詳細・編集</span>
                              <div className="space-y-1.5">
                                {group.books.map((book) => (
                                  <div 
                                    key={book.id} 
                                    className="bg-neutral-900 border border-neutral-800 p-2.5 rounded flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="font-mono bg-neutral-800 text-amber-300 px-2 py-0.5 rounded text-[11px]">
                                        {book.volume ? `${book.volume}巻` : "単巻/本編"}
                                      </span>
                                      <span className="text-neutral-300 font-mono text-[11px]">
                                        ISBN: {book.isbn || "—"}
                                      </span>
                                      <span className="text-neutral-400 text-[11px]">
                                        発売日: {book.release_date || "—"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Link
                                        href={`/add?id=${book.id}`}
                                        className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[11px] flex items-center gap-1 transition"
                                        title="編集"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                        <span>編集</span>
                                      </Link>
                                      <button
                                        onClick={() => handleDelete(book.id, book.title, book.volume)}
                                        className="p-1 bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-400 rounded transition"
                                        title="削除"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* あらすじ */}
                            {latestBook.summary && (
                              <div className="pt-1">
                                <span className="text-neutral-500 block text-[10px] mb-1 font-semibold uppercase">あらすじ</span>
                                <p className="text-xs text-neutral-300 bg-neutral-900 p-3 rounded border border-neutral-800 leading-relaxed">
                                  {latestBook.summary}
                                </p>
                              </div>
                            )}

                            {/* メモ */}
                            {latestBook.memo && (
                              <div className="pt-1">
                                <span className="text-neutral-500 block text-[10px] mb-1 font-semibold uppercase">メモ</span>
                                <p className="text-xs text-neutral-300 bg-neutral-900 p-3 rounded border border-neutral-800 italic">
                                  {latestBook.memo}
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