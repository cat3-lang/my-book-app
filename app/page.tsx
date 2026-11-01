"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Plus, Search, ChevronDown, ChevronUp, Trash2, BookOpen, Layers } from "lucide-react";

const APP_VERSION = "v1.0.20";

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

type GroupedBook = {
  title: string;
  sort_title: string;
  seionGroup: string;
  books: Book[];
};

function getSeionGroup(sortTitle: string): string {
  if (!sortTitle) return "その他";
  const char = sortTitle.charAt(0);
  if (/^[あ-お]/.test(char)) return "あ行";
  if (/^[か-こが-ご]/.test(char)) return "か行";
  if (/^[さ-そざ-ぞ]/.test(char)) return "さ行";
  if (/^[た-とだ-ど]/.test(char)) return "た行";
  if (/^[な-の]/.test(char)) return "な行";
  if (/^[は-ほば-ぼぱ-ぽ]/.test(char)) return "は行";
  if (/^[ま-も]/.test(char)) return "ま行";
  if (/^[や-よ]/.test(char)) return "や行";
  if (/^[ら-ろ]/.test(char)) return "ら行";
  if (/^[わをん]/.test(char)) return "わ行";
  if (/^[A-Za-z0-9]/.test(char)) return "英数字";
  return "その他";
}

export default function HomePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [expandedTitle, setExpandedTitle] = useState<string | null>(null);
  const [expandedBookIds, setExpandedBookIds] = useState<{ [key: string]: boolean }>({});

  const fetchBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("status", "持っている")
      .order("sort_title", { ascending: true });

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
    const volStr = volume ? ` (${volume}巻)` : "";
    if (!confirm(`「${title}${volStr}」を削除してもよろしいですか？`)) return;

    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) {
      alert("削除に失敗しました: " + error.message);
    } else {
      setBooks(books.filter((b) => b.id !== id));
    }
  };

  const toggleBookDetail = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedBookIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // 検索フィルター
  const filteredBooks = books.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    return (
      b.title.toLowerCase().includes(q) ||
      (b.sort_title && b.sort_title.toLowerCase().includes(q)) ||
      (b.series && b.series.toLowerCase().includes(q)) ||
      (b.authors && b.authors.toLowerCase().includes(q)) ||
      (b.publisher && b.publisher.toLowerCase().includes(q)) ||
      (b.memo && b.memo.toLowerCase().includes(q)) ||
      (b.summary && b.summary.toLowerCase().includes(q)) ||
      (b.isbn && b.isbn.toLowerCase().includes(q))
    );
  });

  const groupedBooksMap: { [key: string]: GroupedBook } = {};
  filteredBooks.forEach((book) => {
    const key = book.title;
    const sortVal = book.sort_title || book.title;
    if (!groupedBooksMap[key]) {
      groupedBooksMap[key] = {
        title: book.title,
        sort_title: sortVal,
        seionGroup: getSeionGroup(sortVal),
        books: [],
      };
    }
    groupedBooksMap[key].books.push(book);
  });

  Object.values(groupedBooksMap).forEach((group) => {
    group.books.sort((a, b) => {
      const vA = parseInt(a.volume || "0", 10);
      const vB = parseInt(b.volume || "0", 10);
      return vA - vB;
    });
  });

  const groupedBooksList = Object.values(groupedBooksMap).sort((a, b) =>
    a.sort_title.localeCompare(b.sort_title, "ja")
  );

  let lastSeionGroup = "";

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-20 relative">
      {/* バージョン表記（一番端っこに小さく配置） */}
      <div className="absolute top-1 right-2 z-20 text-[9px] text-neutral-600 font-mono">
        {APP_VERSION}
      </div>

      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800 px-4 py-3 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold tracking-wider text-neutral-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" /> 本棚
            </h1>
            <Link
              href="/wants"
              className="text-xs text-neutral-400 hover:text-neutral-200 underline transition"
            >
              欲しい本リスト
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs px-2.5 py-1.5 rounded flex items-center gap-1 transition cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>検索</span>
            </button>
            <Link
              href="/add"
              className="bg-neutral-100 hover:bg-neutral-300 text-neutral-950 text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 transition"
            >
              <Plus className="w-4 h-4" />
              <span>登録</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-2 md:px-8 py-6 space-y-4">
        {/* 検索パネル */}
        {isSearchOpen && (
          <div className="bg-neutral-900 border border-neutral-800 p-3 rounded space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="タイトル、ひらがな、著者、メモ等で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 pl-9 pr-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-500 rounded"
              />
            </div>
          </div>
        )}

        {/* テーブル一覧 */}
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
                <tr className="bg-neutral-900 border-b border-neutral-700 text-neutral-400 font-semibold uppercase tracking-wider">
                  <th className="p-3 w-7/12 md:w-6/12">タイトル</th>
                  <th className="p-3 w-3/12 md:w-3/12">総数</th>
                  <th className="p-3 text-right w-2/12 md:w-3/12">詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 text-neutral-200">
                {groupedBooksList.map((group) => {
                  const isExpanded = expandedTitle === group.title;
                  const currentSeion = group.seionGroup;
                  const showSeionHeader = currentSeion !== lastSeionGroup;
                  lastSeionGroup = currentSeion;

                  return (
                    <>
                      {/* 五十音の小見出しセクションと見やすい区切り線 */}
                      {showSeionHeader && (
                        <tr key={`seion-${currentSeion}`} className="bg-neutral-950 border-t-4 border-neutral-700">
                          <td colSpan={3} className="px-3 py-2 text-xs font-extrabold text-neutral-300 tracking-wider">
                            【 {currentSeion} 】
                          </td>
                        </tr>
                      )}

                      <tr 
                        key={group.title} 
                        className="hover:bg-neutral-800/50 transition cursor-pointer border-t border-neutral-800"
                        onClick={() => setExpandedTitle(isExpanded ? null : group.title)}
                      >
                        <td className="p-3 font-medium text-neutral-100 truncate max-w-[180px] md:max-w-none">
                          <div className="truncate">{group.title}</div>
                          {group.books[0]?.series && (
                            <div className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5 truncate">
                              <Layers className="w-3 h-3 shrink-0" /> シリーズ: {group.books[0].series}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-neutral-300 whitespace-nowrap">
                          <span className="bg-neutral-800 text-neutral-200 px-2.5 py-1 rounded text-[11px] border border-neutral-700 font-bold">
                            全 {group.books.length} 冊
                          </span>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setExpandedTitle(isExpanded ? null : group.title)}
                            className="px-2.5 py-1 rounded text-[11px] font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>詳細</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* タイトルごとの詳細エリア */}
                      {isExpanded && (
                        <tr key={`${group.title}-detail`} className="bg-neutral-950/90 border-b-2 border-neutral-700">
                          <td colSpan={3} className="p-3 md:p-4 space-y-3">
                            <div className="space-y-2">
                              <span className="text-neutral-400 text-[11px] font-bold block border-b border-neutral-800 pb-1">
                                詳細・情報
                              </span>
                              
                              <div className="space-y-2">
                                {group.books.map((book) => {
                                  const isBookExpanded = !!expandedBookIds[book.id];
                                  return (
                                    <div 
                                      key={book.id} 
                                      className="bg-neutral-900 border border-neutral-800 rounded p-3 space-y-2 text-xs"
                                    >
                                      {/* 巻ごとの簡易バー */}
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-mono bg-neutral-800 text-amber-300 px-2 py-0.5 rounded text-[11px] font-bold">
                                            {book.volume ? `${book.volume}巻` : "ー"}
                                          </span>
                                          <span className="text-neutral-300 text-[11px]">
                                            著者: {book.authors || "ー"}
                                          </span>
                                          <span className="text-neutral-400 text-[11px]">
                                            登録日: {book.created_at ? book.created_at.split("T")[0] : "ー"}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={(e) => toggleBookDetail(book.id, e)}
                                            className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[11px] inline-flex items-center gap-1 transition cursor-pointer"
                                          >
                                            <span>情報</span>
                                            {isBookExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                          </button>
                                          <Link
                                            href={`/add?id=${book.id}`}
                                            className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[11px] transition"
                                          >
                                            編集
                                          </Link>
                                          <button
                                            type="button"
                                            onClick={() => handleDelete(book.id, book.title, book.volume)}
                                            className="p-1 bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-400 rounded transition"
                                            title="削除"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* 巻ごとの個別情報（開閉式） */}
                                      {isBookExpanded && (
                                        <div className="mt-2 pt-2 border-t border-neutral-800 space-y-2 text-[11px] text-neutral-300 bg-neutral-950 p-2.5 rounded">
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                            <div>出版社: <span className="text-neutral-200">{book.publisher || "ー"}</span></div>
                                            <div>ISBN: <span className="font-mono text-neutral-200">{book.isbn || "ー"}</span></div>
                                            <div>発売日: <span className="font-mono text-neutral-200">{book.release_date || "ー"}</span></div>
                                          </div>
                                          {book.summary && (
                                            <div>
                                              <span className="text-neutral-500 block text-[10px] mb-0.5 font-semibold">あらすじ</span>
                                              <p className="text-neutral-300 leading-relaxed bg-neutral-900 p-2 rounded border border-neutral-800">
                                                {book.summary}
                                              </p>
                                            </div>
                                          )}
                                          {book.memo && (
                                            <div>
                                              <span className="text-neutral-500 block text-[10px] mb-0.5 font-semibold">メモ</span>
                                              <p className="text-neutral-300 italic bg-neutral-900 p-2 rounded border border-neutral-800">
                                                {book.memo}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
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