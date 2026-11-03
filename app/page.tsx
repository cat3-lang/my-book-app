"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Search, ChevronRight, ChevronDown, Trash2, BookOpen, Layers, Edit3, Heart, Plus, Settings } from "lucide-react";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.0.39";

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

const SEION_TABS = ["すべて", "あ行", "か行", "さ行", "た行", "な行", "は行", "ま行", "や行", "ら行", "わ行", "英数字", "その他"];

export default function HomePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("すべて");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [expandedTitle, setExpandedTitle] = useState<string | null>(null);
  const [expandedBookIds, setExpandedBookIds] = useState<{ [key: string]: boolean }>({});

  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Book>>({});

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
    if (!window.confirm(`「${title}${volStr}」を削除してもよろしいですか？`)) return;

    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) {
      alert("削除に失敗しました: " + error.message);
    } else {
      setBooks(books.filter((b) => b.id !== id));
      if (editingBookId === id) setEditingBookId(null);
    }
  };

  const toggleBookDetail = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedBookIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const startEditing = (book: Book, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBookId(book.id);
    setEditForm({ ...book });
  };

  const handleSaveInline = async (id: string) => {
    if (!window.confirm("変更内容を保存しますか？")) return;

    const updateData = {
      title: editForm.title || "",
      sort_title: editForm.sort_title || editForm.title || "",
      volume: editForm.volume || null,
      authors: editForm.authors || null,
      publisher: editForm.publisher || null,
      isbn: editForm.isbn || null,
      release_date: editForm.release_date || null,
      summary: editForm.summary || null,
      memo: editForm.memo || null,
    };

    const { error } = await supabase
      .from("books")
      .update(updateData)
      .eq("id", id);

    if (error) {
      alert("保存に失敗しました: " + error.message);
    } else {
      setBooks(books.map((b) => (b.id === id ? { ...b, ...updateData } : b)));
      setEditingBookId(null);
    }
  };

  const filteredBooks = books.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    const seion = getSeionGroup(b.sort_title || b.title);

    if (selectedTab !== "すべて" && seion !== selectedTab) {
      return false;
    }

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
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-28 relative">
      <div className="absolute top-1 right-2 z-20 text-[9px] text-paper-text-sub font-mono">
        {APP_VERSION}
      </div>

      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-paper-card/95 backdrop-blur-md border-b border-paper-border px-4 py-3 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold tracking-wider text-paper-text-main flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-paper-caramel" /> 本棚
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="bg-paper-sub hover:bg-paper-border border border-paper-border text-paper-text-main text-xs px-3 py-1.5 rounded-none flex items-center gap-1.5 transition cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>検索</span>
            </button>
            <div className="text-xs font-mono text-paper-text-main font-bold px-3 py-1.5 bg-paper-sub border border-paper-border shrink-0 shadow-xs">
              計 {filteredBooks.length}/{books.length}冊
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-2 md:px-8 py-6 space-y-4">
        {/* 五十音タブ */}
        <div className="bg-paper-card border border-paper-border p-2.5 rounded-none shadow-sm">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {SEION_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`px-3 py-1.5 rounded-none text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedTab === tab
                    ? "bg-paper-caramel text-white font-bold shadow-sm"
                    : "bg-paper-sub text-paper-text-body hover:bg-paper-border hover:text-paper-text-main border border-paper-border"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* 検索パネル */}
        {isSearchOpen && (
          <div className="bg-paper-card border border-paper-border p-3 rounded-none space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-paper-text-muted absolute left-3 top-3" />
              <input
                type="text"
                placeholder="タイトル、ふりがな、著者、メモ等で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-paper-inner border border-paper-border pl-9 pr-3 py-2.5 text-sm text-paper-text-main placeholder-paper-text-muted focus:outline-none focus:border-paper-caramel rounded-none"
              />
            </div>
          </div>
        )}

        {/* リスト一覧 */}
        {loading ? (
          <p className="text-center text-paper-text-muted py-10 text-sm">読み込み中...</p>
        ) : groupedBooksList.length === 0 ? (
          <div className="text-center py-16 space-y-3 bg-paper-card border border-paper-border rounded-none">
            <p className="text-sm text-paper-text-sub">登録されている本はありません</p>
            <Link
              href="/add"
              className="inline-block text-sm font-bold text-white bg-paper-caramel px-5 py-2.5 rounded-none hover:opacity-90 transition"
            >
              最初の本を登録する
            </Link>
          </div>
        ) : (
          <div className="bg-paper-card border border-paper-border rounded-none overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <tbody className="divide-y divide-paper-border text-paper-text-body text-sm">
                {groupedBooksList.map((group) => {
                  const isExpanded = expandedTitle === group.title;
                  const currentSeion = group.seionGroup;
                  const showSeionHeader = currentSeion !== lastSeionGroup;
                  lastSeionGroup = currentSeion;

                  return (
                    <React.Fragment key={group.title}>
                      {showSeionHeader && (
                        <tr className="bg-[#D9CFAF] border-t-4 border-paper-border-dark">
                          <td colSpan={3} className="px-3.5 py-2.5 text-xs font-extrabold text-paper-text-main tracking-wider">
                            【 {currentSeion} 】
                          </td>
                        </tr>
                      )}

                      {/* タイトル行 */}
                      <tr 
                        className="hover:bg-paper-sub/60 transition cursor-pointer border-t border-paper-border"
                        onClick={() => setExpandedTitle(isExpanded ? null : group.title)}
                      >
                        <td className="p-3.5 font-bold text-paper-text-main max-w-[220px] md:max-w-none flex items-center gap-2.5">
                          <span className="text-paper-caramel shrink-0">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </span>
                          <div className="truncate text-sm md:text-base">{group.title}</div>
                        </td>
                        <td className="p-3.5 font-mono text-paper-text-body whitespace-nowrap">
                          <span className="bg-paper-sub text-paper-text-main px-3 py-1.5 rounded-none text-xs border border-paper-border font-bold shadow-2xs">
                            全 {group.books.length} 冊
                          </span>
                        </td>
                        <td className="p-3.5 text-right text-xs text-paper-text-sub whitespace-nowrap">
                          {group.books[0]?.series ? `シリーズ: ${group.books[0].series}` : ""}
                        </td>
                      </tr>

                      {/* 巻一覧展開エリア */}
                      {isExpanded && (
                        <tr className="bg-paper-inner/95 border-b-2 border-paper-border-dark">
                          <td colSpan={3} className="p-3 md:p-5 space-y-3">
                            <div className="space-y-3">
                              {group.books.map((book) => {
                                const isBookExpanded = !!expandedBookIds[book.id];
                                const isEditing = editingBookId === book.id;

                                return (
                                  <div 
                                    key={book.id} 
                                    className="bg-paper-card border border-paper-border rounded-none p-3.5 space-y-3 text-sm"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 flex-wrap">
                                        <button
                                          type="button"
                                          onClick={(e) => toggleBookDetail(book.id, e)}
                                          className="text-paper-text-main flex items-center gap-1.5 bg-paper-sub hover:bg-paper-border border border-paper-border px-3.5 py-1.5 rounded-none font-bold text-sm cursor-pointer shadow-2xs transition"
                                        >
                                          {isBookExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                          <span>{book.volume ? `${book.volume}巻` : "詳細"}</span>
                                        </button>
                                        <span className="text-paper-text-body text-xs md:text-sm">
                                          著者: <strong className="text-paper-text-main">{book.authors || "ー"}</strong>
                                        </span>
                                        <span className="text-paper-text-sub text-xs">
                                          登録日: {book.created_at ? book.created_at.split("T")[0] : "ー"}
                                        </span>
                                      </div>
                                    </div>

                                    {(isBookExpanded || isEditing) && (
                                      <div className="mt-2 pt-3 border-t border-paper-border space-y-3 text-xs md:text-sm text-paper-text-body bg-paper-inner p-3.5 rounded-none">
                                        {isEditing ? (
                                          <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-2.5">
                                              <div>
                                                <label className="text-xs text-paper-text-sub block mb-1 font-bold">タイトル</label>
                                                <input
                                                  type="text"
                                                  value={editForm.title || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                  className="bg-white border border-paper-border px-2.5 py-1.5 text-sm text-paper-text-main rounded-none w-full"
                                                />
                                              </div>
                                              <div>
                                                <label className="text-xs text-paper-text-sub block mb-1 font-bold">フリガナ</label>
                                                <input
                                                  type="text"
                                                  value={editForm.sort_title || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, sort_title: e.target.value })}
                                                  className="bg-white border border-paper-border px-2.5 py-1.5 text-sm text-paper-text-main rounded-none w-full"
                                                />
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2.5">
                                              <div>
                                                <label className="text-xs text-paper-text-sub block mb-1 font-bold">巻数</label>
                                                <input
                                                  type="text"
                                                  value={editForm.volume || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, volume: e.target.value })}
                                                  className="bg-white border border-paper-border px-2.5 py-1.5 text-sm text-paper-text-main rounded-none w-full font-mono"
                                                />
                                              </div>
                                              <div>
                                                <label className="text-xs text-paper-text-sub block mb-1 font-bold">著者</label>
                                                <input
                                                  type="text"
                                                  value={editForm.authors || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, authors: e.target.value })}
                                                  className="bg-white border border-paper-border px-2.5 py-1.5 text-sm text-paper-text-main rounded-none w-full"
                                                />
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2.5">
                                              <div>
                                                <label className="text-xs text-paper-text-sub block mb-1 font-bold">出版社</label>
                                                <input
                                                  type="text"
                                                  value={editForm.publisher || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, publisher: e.target.value })}
                                                  className="bg-white border border-paper-border px-2.5 py-1.5 text-sm text-paper-text-main rounded-none w-full"
                                                />
                                              </div>
                                              <div>
                                                <label className="text-xs text-paper-text-sub block mb-1 font-bold">発売日</label>
                                                <input
                                                  type="date"
                                                  value={editForm.release_date || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, release_date: e.target.value })}
                                                  className="bg-white border border-paper-border px-2.5 py-1.5 text-sm text-paper-text-main rounded-none w-full font-mono"
                                                />
                                              </div>
                                            </div>

                                            <div>
                                              <label className="text-xs text-paper-text-sub block mb-1 font-bold">ISBN</label>
                                              <input
                                                type="text"
                                                value={editForm.isbn || ""}
                                                onChange={(e) => setEditForm({ ...editForm, isbn: e.target.value })}
                                                className="bg-white border border-paper-border px-2.5 py-1.5 text-sm text-paper-text-main rounded-none w-full font-mono"
                                              />
                                            </div>

                                            <div>
                                              <label className="text-xs text-paper-text-sub block mb-1 font-bold">あらすじ</label>
                                              <textarea
                                                rows={2}
                                                value={editForm.summary || ""}
                                                onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                                                className="bg-white border border-paper-border p-2 text-sm text-paper-text-main rounded-none w-full"
                                              />
                                            </div>

                                            <div>
                                              <label className="text-xs text-paper-text-sub block mb-1 font-bold">メモ</label>
                                              <textarea
                                                rows={2}
                                                value={editForm.memo || ""}
                                                onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                                                className="bg-white border border-paper-border p-2 text-sm text-paper-text-main rounded-none w-full"
                                              />
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-paper-border">
                                              <button
                                                type="button"
                                                onClick={() => handleDelete(book.id, book.title, book.volume)}
                                                className="px-3 py-2 bg-paper-danger hover:opacity-90 text-white rounded-none text-xs flex items-center gap-1 transition cursor-pointer font-bold"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                                <span>削除</span>
                                              </button>

                                              <div className="flex gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => setEditingBookId(null)}
                                                  className="px-3.5 py-2 bg-paper-sub hover:bg-paper-border text-paper-text-main rounded-none text-xs transition cursor-pointer border border-paper-border font-bold"
                                                >
                                                  キャンセル
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleSaveInline(book.id)}
                                                  className="px-4 py-2 bg-paper-caramel hover:opacity-90 text-white rounded-none text-xs font-bold transition cursor-pointer"
                                                >
                                                  変更を保存
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="space-y-2.5 text-paper-text-body">
                                            <div className="grid grid-cols-2 gap-2 pb-2 border-b border-paper-border items-center">
                                              <div>
                                                <span className="text-paper-text-sub block text-xs font-bold">出版社</span>
                                                <span className="text-paper-text-main font-semibold text-sm">{book.publisher || "ー"}</span>
                                              </div>
                                              <div className="text-right">
                                                <button
                                                  type="button"
                                                  onClick={(e) => startEditing(book, e)}
                                                  className="px-3 py-1.5 bg-paper-sub hover:bg-paper-border border border-paper-border text-paper-text-main rounded-none text-xs transition inline-flex items-center gap-1 cursor-pointer font-bold shadow-2xs"
                                                >
                                                  <Edit3 className="w-3.5 h-3.5 text-paper-caramel" />
                                                  <span>編集</span>
                                                </button>
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pb-1">
                                              <div>
                                                <span className="text-paper-text-sub block text-xs font-bold">ISBN</span>
                                                <span className="font-mono text-paper-text-main text-xs">{book.isbn || "ー"}</span>
                                              </div>
                                              <div>
                                                <span className="text-paper-text-sub block text-xs font-bold">発売日</span>
                                                <span className="font-mono text-paper-text-main text-xs">{book.release_date || "ー"}</span>
                                              </div>
                                            </div>

                                            <div>
                                              <span className="text-paper-text-sub block text-xs mb-1 font-bold">あらすじ</span>
                                              <p className="text-paper-text-body leading-relaxed bg-paper-card p-2.5 rounded-none border border-paper-border text-xs md:text-sm">
                                                {book.summary || "あらすじがありません"}
                                              </p>
                                            </div>

                                            <div>
                                              <span className="text-paper-text-sub block text-xs mb-1 font-bold">メモ</span>
                                              <p className="text-paper-text-body italic bg-paper-card p-2.5 rounded-none border border-paper-border text-xs md:text-sm">
                                                {book.memo || "メモがありません"}
                                              </p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 共通フッターナビゲーション */}
      <FooterNav />
    </div>
  );
}