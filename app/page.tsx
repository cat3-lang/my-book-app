"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Search, ChevronRight, ChevronDown, Trash2, BookOpen, Layers, Edit3, Heart, Plus, Settings } from "lucide-react";

const APP_VERSION = "v1.0.37";

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
    <div className="min-h-screen bg-[#1F1915] text-[#FFFDF9] font-sans pb-28 relative">
      <div className="absolute top-1 right-2 z-20 text-[9px] text-[#A39283] font-mono">
        {APP_VERSION}
      </div>

      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-[#2D241E]/95 backdrop-blur-md border-b border-[#4A3B30] px-4 py-3 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold tracking-wider text-[#FFFFFF] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#F59E0B]" /> 本棚
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* 検索ボタンの横の件数表示：明るい白みのあるテキスト */}
            <div className="text-[11px] font-mono text-[#FFFDF9] font-bold px-2.5 py-1.5 bg-[#4A3B30] border border-[#6B5747] shrink-0">
              計 {filteredBooks.length}/{books.length}冊
            </div>
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="bg-[#4A3B30] hover:bg-[#5C483B] border border-[#6B5747] text-[#FFFFFF] text-xs px-3 py-1.5 rounded-none flex items-center gap-1.5 transition cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>検索</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-2 md:px-8 py-6 space-y-4">
        {/* 五十音タブ */}
        <div className="bg-[#2D241E] border border-[#4A3B30] p-2.5 rounded-none shadow-sm">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {SEION_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`px-2.5 py-1 rounded-none text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedTab === tab
                    ? "bg-[#D97706] text-[#FFFFFF] font-bold shadow-sm"
                    : "bg-[#3A2F27] text-[#E2D6CB] hover:bg-[#4A3B30] hover:text-[#FFFFFF] border border-[#5C483B]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* 検索パネル */}
        {isSearchOpen && (
          <div className="bg-[#2D241E] border border-[#4A3B30] p-3 rounded-none space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-[#A39283] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="タイトル、ふりがな、著者、メモ等で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1F1915] border border-[#6B5747] pl-9 pr-3 py-2 text-xs text-[#FFFFFF] placeholder-[#A39283] focus:outline-none focus:border-[#D97706] rounded-none"
              />
            </div>
          </div>
        )}

        {/* リスト一覧 */}
        {loading ? (
          <p className="text-center text-[#A39283] py-10 text-xs">読み込み中...</p>
        ) : groupedBooksList.length === 0 ? (
          <div className="text-center py-16 space-y-3 bg-[#2D241E] border border-[#4A3B30] rounded-none">
            <p className="text-xs text-[#E2D6CB]">登録されている本はありません</p>
            <Link
              href="/add"
              className="inline-block text-xs font-bold text-[#1F1915] bg-[#FFFFFF] px-4 py-2 rounded-none hover:bg-[#E2D6CB] transition"
            >
              最初の本を登録する
            </Link>
          </div>
        ) : (
          <div className="bg-[#2D241E] border border-[#4A3B30] rounded-none overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <tbody className="divide-y divide-[#4A3B30] text-[#FFFDF9]">
                {groupedBooksList.map((group) => {
                  const isExpanded = expandedTitle === group.title;
                  const currentSeion = group.seionGroup;
                  const showSeionHeader = currentSeion !== lastSeionGroup;
                  lastSeionGroup = currentSeion;

                  return (
                    <React.Fragment key={group.title}>
                      {showSeionHeader && (
                        <tr className="bg-[#17120F] border-t-4 border-[#6B5747]">
                          <td colSpan={3} className="px-3 py-2 text-xs font-extrabold text-[#FBBF24] tracking-wider">
                            【 {currentSeion} 】
                          </td>
                        </tr>
                      )}

                      {/* タイトル行 */}
                      <tr 
                        className="hover:bg-[#3A2F27]/60 transition cursor-pointer border-t border-[#4A3B30]"
                        onClick={() => setExpandedTitle(isExpanded ? null : group.title)}
                      >
                        <td className="p-3 font-medium text-[#FFFFFF] max-w-[220px] md:max-w-none flex items-center gap-2">
                          <span className="text-[#F59E0B] shrink-0">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </span>
                          <div className="truncate">{group.title}</div>
                        </td>
                        <td className="p-3 font-mono text-[#E2D6CB] whitespace-nowrap">
                          <span className="bg-[#3A2F27] text-[#FFFFFF] px-2.5 py-1 rounded-none text-[11px] border border-[#5C483B] font-bold">
                            全 {group.books.length} 冊
                          </span>
                        </td>
                        <td className="p-3 text-right text-[11px] text-[#D1C3B6] whitespace-nowrap">
                          {group.books[0]?.series ? `シリーズ: ${group.books[0].series}` : ""}
                        </td>
                      </tr>

                      {/* 巻一覧展開エリア */}
                      {isExpanded && (
                        <tr className="bg-[#241D17]/95 border-b-2 border-[#6B5747]">
                          <td colSpan={3} className="p-3 md:p-4 space-y-3">
                            <div className="space-y-2">
                              {group.books.map((book) => {
                                const isBookExpanded = !!expandedBookIds[book.id];
                                const isEditing = editingBookId === book.id;

                                return (
                                  <div 
                                    key={book.id} 
                                    className="bg-[#2D241E] border border-[#4A3B30] rounded-none p-3 space-y-2 text-xs"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                          type="button"
                                          onClick={(e) => toggleBookDetail(book.id, e)}
                                          className="text-[#FBBF24] flex items-center gap-1 bg-[#3A2F27] border border-[#5C483B] px-2 py-0.5 rounded-none font-bold cursor-pointer"
                                        >
                                          {isBookExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                          <span>{book.volume ? `${book.volume}巻` : "ー"}</span>
                                        </button>
                                        <span className="text-[#E2D6CB] text-[11px]">
                                          著者: <strong className="text-[#FFFFFF]">{book.authors || "ー"}</strong>
                                        </span>
                                        <span className="text-[#D1C3B6] text-[11px]">
                                          登録日: {book.created_at ? book.created_at.split("T")[0] : "ー"}
                                        </span>
                                      </div>
                                    </div>

                                    {(isBookExpanded || isEditing) && (
                                      <div className="mt-2 pt-2 border-t border-[#4A3B30] space-y-2 text-[11px] text-[#FFFDF9] bg-[#241D17] p-3 rounded-none">
                                        {isEditing ? (
                                          /* 編集モード */
                                          <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <label className="text-[10px] text-[#D1C3B6] block mb-0.5 font-bold">タイトル</label>
                                                <input
                                                  type="text"
                                                  value={editForm.title || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                  className="bg-[#1F1915] border border-[#6B5747] px-2 py-1 text-xs text-[#FFFFFF] rounded-none w-full"
                                                />
                                              </div>
                                              <div>
                                                <label className="text-[10px] text-[#D1C3B6] block mb-0.5 font-bold">フリガナ</label>
                                                <input
                                                  type="text"
                                                  value={editForm.sort_title || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, sort_title: e.target.value })}
                                                  className="bg-[#1F1915] border border-[#6B5747] px-2 py-1 text-xs text-[#FFFFFF] rounded-none w-full"
                                                />
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <label className="text-[10px] text-[#D1C3B6] block mb-0.5 font-bold">巻数</label>
                                                <input
                                                  type="text"
                                                  value={editForm.volume || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, volume: e.target.value })}
                                                  className="bg-[#1F1915] border border-[#6B5747] px-2 py-1 text-xs text-[#FFFFFF] rounded-none w-full font-mono"
                                                />
                                              </div>
                                              <div>
                                                <label className="text-[10px] text-[#D1C3B6] block mb-0.5 font-bold">著者</label>
                                                <input
                                                  type="text"
                                                  value={editForm.authors || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, authors: e.target.value })}
                                                  className="bg-[#1F1915] border border-[#6B5747] px-2 py-1 text-xs text-[#FFFFFF] rounded-none w-full"
                                                />
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <label className="text-[10px] text-[#D1C3B6] block mb-0.5 font-bold">出版社</label>
                                                <input
                                                  type="text"
                                                  value={editForm.publisher || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, publisher: e.target.value })}
                                                  className="bg-[#1F1915] border border-[#6B5747] px-2 py-1 text-xs text-[#FFFFFF] rounded-none w-full"
                                                />
                                              </div>
                                              <div>
                                                <label className="text-[10px] text-[#D1C3B6] block mb-0.5 font-bold">発売日</label>
                                                <input
                                                  type="date"
                                                  value={editForm.release_date || ""}
                                                  onChange={(e) => setEditForm({ ...editForm, release_date: e.target.value })}
                                                  className="bg-[#1F1915] border border-[#6B5747] px-2 py-1 text-xs text-[#FFFFFF] rounded-none w-full font-mono"
                                                />
                                              </div>
                                            </div>

                                            <div>
                                              <label className="text-[10px] text-[#D1C3B6] block mb-0.5 font-bold">ISBN</label>
                                              <input
                                                type="text"
                                                value={editForm.isbn || ""}
                                                onChange={(e) => setEditForm({ ...editForm, isbn: e.target.value })}
                                                className="bg-[#1F1915] border border-[#6B5747] px-2 py-1 text-xs text-[#FFFFFF] rounded-none w-full font-mono"
                                              />
                                            </div>

                                            <div>
                                              <label className="text-[10px] text-[#D1C3B6] block mb-0.5 font-bold">あらすじ</label>
                                              <textarea
                                                rows={2}
                                                value={editForm.summary || ""}
                                                onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                                                className="bg-[#1F1915] border border-[#6B5747] p-1.5 text-xs text-[#FFFFFF] rounded-none w-full"
                                              />
                                            </div>

                                            <div>
                                              <label className="text-[10px] text-[#D1C3B6] block mb-0.5 font-bold">メモ</label>
                                              <textarea
                                                rows={2}
                                                value={editForm.memo || ""}
                                                onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                                                className="bg-[#1F1915] border border-[#6B5747] p-1.5 text-xs text-[#FFFFFF] rounded-none w-full"
                                              />
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-[#4A3B30]">
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
                                                  className="px-3 py-1.5 bg-[#3A2F27] hover:bg-[#4A3B30] text-[#FFFFFF] rounded-none text-xs transition cursor-pointer border border-[#6B5747] font-bold"
                                                >
                                                  キャンセル
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleSaveInline(book.id)}
                                                  className="px-3 py-1.5 bg-[#D97706] hover:bg-[#F59E0B] text-white rounded-none text-xs font-bold transition cursor-pointer"
                                                >
                                                  変更を保存
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          /* 通常表示モード（すっきり明るい白みの文字） */
                                          <div className="space-y-2 text-[#FFFDF9]">
                                            <div className="grid grid-cols-2 gap-2 pb-1 border-b border-[#4A3B30] items-center">
                                              <div>
                                                <span className="text-[#D1C3B6] block text-[10px] font-bold">出版社</span>
                                                <span className="text-[#FFFFFF] font-semibold">{book.publisher || "ー"}</span>
                                              </div>
                                              <div className="text-right">
                                                <button
                                                  type="button"
                                                  onClick={(e) => startEditing(book, e)}
                                                  className="px-2.5 py-1 bg-[#3A2F27] hover:bg-[#4A3B30] border border-[#6B5747] text-[#FFFFFF] rounded-none text-[11px] transition inline-flex items-center gap-1 cursor-pointer font-bold"
                                                >
                                                  <Edit3 className="w-3 h-3 text-[#FBBF24]" />
                                                  <span>編集</span>
                                                </button>
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pb-1">
                                              <div>
                                                <span className="text-[#D1C3B6] block text-[10px] font-bold">ISBN</span>
                                                <span className="font-mono text-[#FFFFFF]">{book.isbn || "ー"}</span>
                                              </div>
                                              <div>
                                                <span className="text-[#D1C3B6] block text-[10px] font-bold">発売日</span>
                                                <span className="font-mono text-[#FFFFFF]">{book.release_date || "ー"}</span>
                                              </div>
                                            </div>

                                            <div>
                                              <span className="text-[#D1C3B6] block text-[10px] mb-0.5 font-bold">あらすじ</span>
                                              <p className="text-[#FFFDF9] leading-relaxed bg-[#1F1915] p-2 rounded-none border border-[#4A3B30]">
                                                {book.summary || "あらすじがありません"}
                                              </p>
                                            </div>

                                            <div>
                                              <span className="text-[#D1C3B6] block text-[10px] mb-0.5 font-bold">メモ</span>
                                              <p className="text-[#FFFDF9] italic bg-[#1F1915] p-2 rounded-none border border-[#4A3B30]">
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
      <nav aria-label="メインナビゲーション" className="fixed bottom-0 left-0 right-0 z-30 bg-[#2D241E]/95 backdrop-blur-md border-t border-[#4A3B30] px-2 py-2">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1 text-center">
          <Link
            href="/"
            className="flex flex-col items-center justify-center py-1 text-[#FBBF24] hover:text-[#FFFFFF] transition"
          >
            <BookOpen className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-bold">本棚</span>
          </Link>
          <Link
            href="/wants"
            className="flex flex-col items-center justify-center py-1 text-[#D1C3B6] hover:text-[#FFFFFF] transition"
          >
            <Heart className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">欲しい本</span>
          </Link>
          <Link
            href="/add"
            className="flex flex-col items-center justify-center py-1 text-[#D1C3B6] hover:text-[#FFFFFF] transition"
          >
            <Plus className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">登録</span>
          </Link>
          <Link
            href="/settings"
            className="flex flex-col items-center justify-center py-1 text-[#D1C3B6] hover:text-[#FFFFFF] transition"
          >
            <Settings className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">設定・CSV</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}