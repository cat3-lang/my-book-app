"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Search, ChevronRight, ChevronDown, Trash2, BookOpen, Layers, Edit3, Heart, Plus, Settings } from "lucide-react";

const APP_VERSION = "v1.0.35";

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
    <div className="min-h-screen bg-[#2D241E] text-[#2C1D11] font-sans pb-28 relative">
      <div className="absolute top-1 right-2 z-20 text-[9px] text-[#A68A78] font-mono">
        {APP_VERSION}
      </div>

      {/* ヘッダー（検索ボタンの横にヒット件数カウンターを配置） */}
      <header className="sticky top-0 z-10 bg-[#42352B]/95 backdrop-blur-md border-b border-[#5C4A3D] px-4 py-3 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold tracking-wider text-[#F5EBE6] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#D97706]" /> 本棚
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* 検索ボタンのすぐ横に配置したヒット件数カウンター */}
            <div className="text-[11px] font-mono text-[#F3C68F] px-2.5 py-1.5 bg-[#4E3E32] border border-[#6E5A4B] shrink-0">
              該当: <strong className="text-[#FFFBEB]">{filteredBooks.length}</strong> 冊
            </div>
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="bg-[#4E3E32] hover:bg-[#5C4A3D] border border-[#6E5A4B] text-[#F5EBE6] text-xs px-3 py-1.5 rounded-none flex items-center gap-1.5 transition cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>検索</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-2 md:px-8 py-6 space-y-4">
        {/* 五十音タブ */}
        <div className="bg-[#3D3027] border border-[#5C4A3D] p-2.5 rounded-none shadow-sm">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {SEION_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`px-2.5 py-1 rounded-none text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedTab === tab
                    ? "bg-[#D97706] text-[#FFFBEB] font-bold shadow-sm"
                    : "bg-[#4A3B30] text-[#D4C4B7] hover:bg-[#5C4A3D] hover:text-[#F5EBE6] border border-[#6E5A4B]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* 検索パネル */}
        {isSearchOpen && (
          <div className="bg-[#3D3027] border border-[#5C4A3D] p-3 rounded-none space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-[#A68A78] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="タイトル、ふりがな、著者、メモ等で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#2D241E] border border-[#6E5A4B] pl-9 pr-3 py-2 text-xs text-[#F5EBE6] placeholder-[#A68A78] focus:outline-none focus:border-[#D97706] rounded-none"
              />
            </div>
          </div>
        )}

        {/* リスト一覧 */}
        {loading ? (
          <p className="text-center text-[#A68A78] py-10 text-xs">読み込み中...</p>
        ) : groupedBooksList.length === 0 ? (
          <div className="text-center py-16 space-y-3 bg-[#3D3027] border border-[#5C4A3D] rounded-none">
            <p className="text-xs text-[#D4C4B7]">登録されている本はありません</p>
            <Link
              href="/add"
              className="inline-block text-xs font-bold text-[#2D241E] bg-[#F5EBE6] px-4 py-2 rounded-none hover:bg-[#E2D2C8] transition"
            >
              最初の本を登録する
            </Link>
          </div>
        ) : (
          <div className="bg-[#3D3027] border border-[#5C4A3D] rounded-none overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <tbody className="divide-y divide-[#5C4A3D] text-[#3E2723]">
                {groupedBooksList.map((group) => {
                  const isExpanded = expandedTitle === group.title;
                  const currentSeion = group.seionGroup;
                  const showSeionHeader = currentSeion !== lastSeionGroup;
                  lastSeionGroup = currentSeion;

                  return (
                    <React.Fragment key={group.title}>
                      {showSeionHeader && (
                        <tr className="bg-[#241C17] border-t-4 border-[#6E5A4B]">
                          <td colSpan={3} className="px-3 py-2 text-xs font-extrabold text-[#F3C68F] tracking-wider">
                            【 {currentSeion} 】
                          </td>
                        </tr>
                      )}

                      {/* タイトル行 */}
                      <tr 
                        className="hover:bg-[#4E3E32]/50 transition cursor-pointer border-t border-[#5C4A3D]"
                        onClick={() => setExpandedTitle(isExpanded ? null : group.title)}
                      >
                        <td className="p-3 font-medium text-[#F5EBE6] max-w-[220px] md:max-w-none flex items-center gap-2">
                          <span className="text-[#D97706] shrink-0">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </span>
                          <div className="truncate">{group.title}</div>
                        </td>
                        <td className="p-3 font-mono text-[#E2D2C8] whitespace-nowrap">
                          <span className="bg-[#4E3E32] text-[#F5EBE6] px-2.5 py-1 rounded-none text-[11px] border border-[#6E5A4B] font-bold">
                            全 {group.books.length} 冊
                          </span>
                        </td>
                        <td className="p-3 text-right text-[11px] text-[#D4C4B7] whitespace-nowrap">
                          {group.books[0]?.series ? `シリーズ: ${group.books[0].series}` : ""}
                        </td>
                      </tr>

                      {/* 巻一覧展開エリア */}
                      {isExpanded && (
                        <tr className="bg-[#2A211B]/95 border-b-2 border-[#6E5A4B]">
                          <td colSpan={3} className="p-3 md:p-4 space-y-3">
                            <div className="space-y-2">
                              {group.books.map((book) => {
                                const isBookExpanded = !!expandedBookIds[book.id];
                                const isEditing = editingBookId === book.id;

                                return (
                                  <div 
                                    key={book.id} 
                                    className="bg-[#3D3027] border border-[#5C4A3D] rounded-none p-3 space-y-2 text-xs"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                          type="button"
                                          onClick={(e) => toggleBookDetail(book.id, e)}
                                          className="text-[#F3C68F] flex items-center gap-1 bg-[#4E3E32] border border-[#6E5A4B] px-2 py-0.5 rounded-none font-bold cursor-pointer"
                                        >
                                          {isBookExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                          <span>{book.volume ? `${book.volume}巻` : "ー"}</span>
                                        </button>
                                        <span className="text-[#E2D2C8] text-[11px]">
                                          著者: <strong className="text-[#F5EBE6]">{book.authors || "ー"}</strong>
                                        </span>
                                        <span className="text-[#D4C4B7] text-[11px]">
                                          登録日: {book.created_at ? book.created_at.split("T")[0] : "ー"}
                                        </span>
                                      </div>
                                    </div>

                                    {(isBookExpanded || isEditing) && (
                                      <div className="mt-2 pt-2 border-t border-[#5C4A3D] space-y-2 text-[11px] text-[#3E2723] bg-[#F5EBE6] p-3 rounded-none">
                                        {isEditing ? (
                                          /* 編集モード */
                                          <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <label className="text-[10px] text-[#6E5A4B] block mb-0.5 font-bold">タイトル</label>
                                                <input
                                                  type="text"
                                                  value={editForm.title || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                  className="bg-white border border-[#A68A78] px-2 py-1 text-xs text-[#2C1D11] rounded-none w-full"
                                                />
                                              </div>
                                              <div>
                                                <label className="text-[10px] text-[#6E5A4B] block mb-0.5 font-bold">フリガナ</label>
                                                <input
                                                  type="text"
                                                  value={editForm.sort_title || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, sort_title: e.target.value })}
                                                  className="bg-white border border-[#A68A78] px-2 py-1 text-xs text-[#2C1D11] rounded-none w-full"
                                                />
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <label className="text-[10px] text-[#6E5A4B] block mb-0.5 font-bold">巻数</label>
                                                <input
                                                  type="text"
                                                  value={editForm.volume || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, volume: e.target.value })}
                                                  className="bg-white border border-[#A68A78] px-2 py-1 text-xs text-[#2C1D11] rounded-none w-full font-mono"
                                                />
                                              </div>
                                              <div>
                                                <label className="text-[10px] text-[#6E5A4B] block mb-0.5 font-bold">著者</label>
                                                <input
                                                  type="text"
                                                  value={editForm.authors || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, authors: e.target.value })}
                                                  className="bg-white border border-[#A68A78] px-2 py-1 text-xs text-[#2C1D11] rounded-none w-full"
                                                />
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <label className="text-[10px] text-[#6E5A4B] block mb-0.5 font-bold">出版社</label>
                                                <input
                                                  type="text"
                                                  value={editForm.publisher || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, publisher: e.target.value })}
                                                  className="bg-white border border-[#A68A78] px-2 py-1 text-xs text-[#2C1D11] rounded-none w-full"
                                                />
                                              </div>
                                              <div>
                                                <label className="text-[10px] text-[#6E5A4B] block mb-0.5 font-bold">発売日</label>
                                                <input
                                                  type="date"
                                                  value={editForm.release_date || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, release_date: e.target.value })}
                                                  className="bg-white border border-[#A68A78] px-2 py-1 text-xs text-[#2C1D11] rounded-none w-full font-mono"
                                                />
                                              </div>
                                            </div>

                                            <div>
                                              <label className="text-[10px] text-[#6E5A4B] block mb-0.5 font-bold">ISBN</label>
                                              <input
                                                type="text"
                                                value={editForm.isbn || ""}
                                                onChange={(e) => setEditForm({ ...editForm, isbn: e.target.value })}
                                                className="bg-white border border-[#A68A78] px-2 py-1 text-xs text-[#2C1D11] rounded-none w-full font-mono"
                                              />
                                            </div>

                                            <div>
                                              <label className="text-[10px] text-[#6E5A4B] block mb-0.5 font-bold">あらすじ</label>
                                              <textarea
                                                rows={2}
                                                value={editForm.summary || ""}
                                                onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                                                className="bg-white border border-[#A68A78] p-1.5 text-xs text-[#2C1D11] rounded-none w-full"
                                              />
                                            </div>

                                            <div>
                                              <label className="text-[10px] text-[#6E5A4B] block mb-0.5 font-bold">メモ</label>
                                              <textarea
                                                rows={2}
                                                value={editForm.memo || ""}
                                                onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                                                className="bg-white border border-[#A68A78] p-1.5 text-xs text-[#2C1D11] rounded-none w-full"
                                              />
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-[#D4C4B7]">
                                              <button
                                                type="button"
                                                onClick={() => handleDelete(book.id, book.title, book.volume)}
                                                className="px-2.5 py-1.5 bg-[#5C2323] hover:bg-[#7F2D2D] border border-[#7F2D2D] text-[#FEE2E2] rounded-none text-xs flex items-center gap-1 transition cursor-pointer font-bold"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span>削除</span>
                                              </button>

                                              <div className="flex gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => setEditingBookId(null)}
                                                  className="px-3 py-1.5 bg-[#E2D2C8] hover:bg-[#D4C4B7] text-[#2C1D11] rounded-none text-xs transition cursor-pointer border border-[#A68A78] font-bold"
                                                >
                                                  キャンセル
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleSaveInline(book.id)}
                                                  className="px-3 py-1.5 bg-[#B45309] hover:bg-[#D97706] text-white rounded-none text-xs font-bold transition cursor-pointer"
                                                >
                                                  変更を保存
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          /* 通常表示モード */
                                          <div className="space-y-2 text-[#3E2723]">
                                            <div className="grid grid-cols-2 gap-2 pb-1 border-b border-[#D4C4B7] items-center">
                                              <div>
                                                <span className="text-[#6E5A4B] block text-[10px] font-bold">出版社</span>
                                                <span className="text-[#2C1D11] font-semibold">{book.publisher || "ー"}</span>
                                              </div>
                                              <div className="text-right">
                                                <button
                                                  type="button"
                                                  onClick={(e) => startEditing(book, e)}
                                                  className="px-2.5 py-1 bg-[#E2D2C8] hover:bg-[#D4C4B7] border border-[#A68A78] text-[#2C1D11] rounded-none text-[11px] transition inline-flex items-center gap-1 cursor-pointer font-bold"
                                                >
                                                  <Edit3 className="w-3 h-3 text-[#B45309]" />
                                                  <span>編集</span>
                                                </button>
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pb-1">
                                              <div>
                                                <span className="text-[#6E5A4B] block text-[10px] font-bold">ISBN</span>
                                                <span className="font-mono text-[#2C1D11]">{book.isbn || "ー"}</span>
                                              </div>
                                              <div>
                                                <span className="text-[#6E5A4B] block text-[10px] font-bold">発売日</span>
                                                <span className="font-mono text-[#2C1D11]">{book.release_date || "ー"}</span>
                                              </div>
                                            </div>

                                            <div>
                                              <span className="text-[#6E5A4B] block text-[10px] mb-0.5 font-bold">あらすじ</span>
                                              <p className="text-[#3E2723] leading-relaxed bg-[#EFECE6] p-2 rounded-none border border-[#D4C4B7]">
                                                {book.summary || "あらすじがありません"}
                                              </p>
                                            </div>

                                            <div>
                                              <span className="text-[#6E5A4B] block text-[10px] mb-0.5 font-bold">メモ</span>
                                              <p className="text-[#3E2723] italic bg-[#EFECE6] p-2 rounded-none border border-[#D4C4B7]">
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

      {/* 固定ボトムナビゲーション */}
      <nav aria-label="メインナビゲーション" className="fixed bottom-0 left-0 right-0 z-30 bg-[#42352B]/95 backdrop-blur-md border-t border-[#5C4A3D] px-2 py-2">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1 text-center">
          <Link
            href="/"
            className="flex flex-col items-center justify-center py-1 text-[#F3C68F] hover:text-[#FFFBEB] transition"
          >
            <BookOpen className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-bold">本棚</span>
          </Link>
          <Link
            href="/wants"
            className="flex flex-col items-center justify-center py-1 text-[#D4C4B7] hover:text-[#F5EBE6] transition"
          >
            <Heart className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">欲しい本</span>
          </Link>
          <Link
            href="/add"
            className="flex flex-col items-center justify-center py-1 text-[#D4C4B7] hover:text-[#F5EBE6] transition"
          >
            <Plus className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">登録</span>
          </Link>
          <Link
            href="/settings"
            className="flex flex-col items-center justify-center py-1 text-[#D4C4B7] hover:text-[#F5EBE6] transition"
          >
            <Settings className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">設定・CSV</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}