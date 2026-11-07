"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Search, ChevronRight, ChevronDown, Trash2, BookOpen, Edit3, Star, ArrowUp, ArrowDown, ArrowUpDown, MapPin, ZoomIn, X } from "lucide-react";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.0.70";

type Book = {
  id: string;
  title: string;
  sub_title: string | null;
  sort_title: string | null;
  volume: string | null;
  series: string | null;
  authors: string | null;
  publisher: string | null;
  isbn: string | null;
  status: "持っている" | "欲しい";
  memo: string | null;
  release_date: string | null;
  created_at: string;
  rating?: number | null;
  location?: string | null;
  image_url?: string | null;
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
  if (/^[あ-おア-オ]/.test(char)) return "あ行";
  if (/^[か-こが-ごカ-コガ-ゴ]/.test(char)) return "か行";
  if (/^[さ-そざ-ぞサ-ソザ-ゾ]/.test(char)) return "さ行";
  if (/^[た-とだ-どタ-トダ-ド]/.test(char)) return "た行";
  if (/^[な-のナ-ノ]/.test(char)) return "な行";
  if (/^[は-ほば-ぼぱ-ぽハ-ホバ-ボパ-ポ]/.test(char)) return "は行";
  if (/^[ま-もマ-モ]/.test(char)) return "ま行";
  if (/^[や-よヤ-ヨ]/.test(char)) return "や行";
  if (/^[ら-ろラ-ロ]/.test(char)) return "ら行";
  if (/^[わをんワヲン]/.test(char)) return "わ行";
  if (/^[A-Za-z0-9Ａ-Ｚａ-ｚ０-９]/.test(char)) return "英数字";
  return "その他";
}

const SEION_TABS = ["すべて", "★", "あ行", "か行", "さ行", "た行", "な行", "は行", "ま行", "や行", "ら行", "わ行", "英数字", "その他"];

export default function HomePage() {
  const [authChecking, setAuthChecking] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("すべて");
  const [sortOrder, setSortOrder] = useState<"title" | "date_desc" | "date_asc">("title");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [expandedTitle, setExpandedTitle] = useState<string | null>(null);
  const [expandedBookIds, setExpandedBookIds] = useState<{ [key: string]: boolean }>({});
  const [expandedSubTitles, setExpandedSubTitles] = useState<{ [key: string]: boolean }>({});

  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Book>>({});

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
      } else {
        setAuthChecking(false);
      }
    };
    checkUser();
  }, []);

  const fetchBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("status", "持っている");

    if (error) {
      console.error("Error fetching books:", error);
    } else {
      setBooks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authChecking) {
      fetchBooks();
    }
  }, [authChecking]);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-paper-bg flex items-center justify-center text-xs text-paper-text-sub font-mono">
        認証確認中...
      </div>
    );
  }

  const existingLocations = Array.from(new Set(books.map(b => b.location).filter(Boolean))) as string[];

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

  const toggleSubTitle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubTitles((prev) => ({ ...prev, [id]: !prev[id] }));
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
      sub_title: editForm.sub_title || null,
      sort_title: editForm.sort_title || editForm.title || "",
      volume: editForm.volume || null,
      series: editForm.series || null,
      authors: editForm.authors || null,
      publisher: editForm.publisher || null,
      isbn: editForm.isbn || null,
      release_date: editForm.release_date || null,
      memo: editForm.memo || null,
      rating: editForm.rating || 0,
      location: editForm.location || null,
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

  const handleRatingChange = async (book: Book, newRating: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedRating = book.rating === newRating ? 0 : newRating;
    const { error } = await supabase
      .from("books")
      .update({ rating: updatedRating })
      .eq("id", book.id);

    if (!error) {
      setBooks(books.map((b) => (b.id === book.id ? { ...b, rating: updatedRating } : b)));
    }
  };

  const filteredBooks = books.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    const seion = getSeionGroup(b.sort_title || b.title);

    if (selectedTab === "★") {
      if (!b.rating || b.rating === 0) return false;
    } else if (selectedTab !== "すべて" && seion !== selectedTab) {
      return false;
    }

    if (!q) return true;

    return (
      b.title.toLowerCase().includes(q) ||
      (b.sub_title && b.sub_title.toLowerCase().includes(q)) ||
      (b.sort_title && b.sort_title.toLowerCase().includes(q)) ||
      (b.series && b.series.toLowerCase().includes(q)) ||
      (b.authors && b.authors.toLowerCase().includes(q)) ||
      (b.publisher && b.publisher.toLowerCase().includes(q)) ||
      (b.memo && b.memo.toLowerCase().includes(q)) ||
      (b.isbn && b.isbn.toLowerCase().includes(q)) ||
      (b.location && b.location.toLowerCase().includes(q))
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

  let groupedBooksList = Object.values(groupedBooksMap);

  if (sortOrder === "title") {
    groupedBooksList.sort((a, b) => a.sort_title.localeCompare(b.sort_title, "ja"));
  } else if (sortOrder === "date_desc") {
    groupedBooksList.sort((a, b) => {
      const latestA = Math.max(...a.books.map(bk => new Date(bk.created_at || 0).getTime()));
      const latestB = Math.max(...b.books.map(bk => new Date(bk.created_at || 0).getTime()));
      return latestB - latestA;
    });
  } else if (sortOrder === "date_asc") {
    groupedBooksList.sort((a, b) => {
      const oldestA = Math.min(...a.books.map(bk => new Date(bk.created_at || 0).getTime()));
      const oldestB = Math.min(...b.books.map(bk => new Date(bk.created_at || 0).getTime()));
      return oldestA - oldestB;
    });
  }

  let lastSeionGroup = "";

  return (
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-32 relative overflow-x-hidden">
      <div className="absolute top-1 right-2 z-20 text-[9px] text-paper-text-sub font-mono">
        {APP_VERSION}
      </div>

      <header className="sticky top-0 z-10 bg-paper-card/95 backdrop-blur-md border-b border-paper-border px-3 py-2.5 md:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-sm font-bold text-paper-text-main flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-paper-caramel" /> 本棚
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="bg-paper-sub hover:bg-paper-border border border-paper-border text-paper-text-main text-xs px-2.5 py-1 flex items-center gap-1 transition cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>検索</span>
            </button>
            <div className="text-xs font-mono text-paper-text-main font-bold px-2 py-1 bg-paper-sub border border-paper-border shrink-0">
              {filteredBooks.length}/{books.length}冊
            </div>
          </div>
        </div>
      </header>

      {/* 右下の上下スクロールボタン */}
      <div className="fixed right-3 bottom-20 z-20 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => window.scrollBy({ top: -400, behavior: "smooth" })}
          className="w-9 h-9 bg-paper-card border border-paper-border text-paper-text-main shadow-md flex items-center justify-center hover:bg-paper-sub transition cursor-pointer"
          title="上へ"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => window.scrollBy({ top: 400, behavior: "smooth" })}
          className="w-9 h-9 bg-paper-card border border-paper-border text-paper-text-main shadow-md flex items-center justify-center hover:bg-paper-sub transition cursor-pointer"
          title="下へ"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      </div>

      <main className="max-w-4xl mx-auto px-2 md:px-6 py-4 space-y-3">
        <div className="bg-paper-card border border-paper-border p-2 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none flex-1">
              {SEION_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSelectedTab(tab)}
                  className={`px-2.5 py-1 text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    selectedTab === tab
                      ? "bg-paper-caramel text-white font-bold shadow-xs"
                      : "bg-paper-sub text-paper-text-body hover:bg-paper-border border border-paper-border"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-paper-text-sub" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="bg-paper-sub border border-paper-border text-xs text-paper-text-main px-2 py-1 focus:outline-none cursor-pointer font-bold"
              >
                <option value="title">五十音</option>
                <option value="date_desc">登録日 (新)</option>
                <option value="date_asc">登録日 (古)</option>
              </select>
            </div>
          </div>
        </div>

        {isSearchOpen && (
          <div className="bg-paper-card border border-paper-border p-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-paper-text-sub absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="タイトル、ふりがな、著者、置き場所等で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-paper-inner border border-paper-border pl-9 pr-3 py-1.5 text-xs text-paper-text-main focus:outline-none focus:border-paper-caramel"
              />
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center text-paper-text-sub py-8 text-xs">読み込み中...</p>
        ) : groupedBooksList.length === 0 ? (
          <div className="text-center py-12 space-y-3 bg-paper-card border border-paper-border">
            <p className="text-xs text-paper-text-sub">該当する本がありません</p>
            <Link
              href="/add"
              className="inline-block text-xs font-bold text-white bg-paper-caramel px-4 py-2 hover:opacity-90 transition"
            >
              本を登録する
            </Link>
          </div>
        ) : (
          <div className="bg-paper-card border border-paper-border shadow-xs overflow-hidden">
            <div className="divide-y divide-paper-border">
              {groupedBooksList.map((group) => {
                const isExpanded = expandedTitle === group.title;
                const currentSeion = group.seionGroup;
                const showSeionHeader = currentSeion !== lastSeionGroup && sortOrder === "title";
                lastSeionGroup = currentSeion;

                return (
                  <React.Fragment key={group.title}>
                    {showSeionHeader && selectedTab !== "★" && (
                      <div className="bg-[#D9CFAF] border-t border-paper-border-dark px-3 py-1.5 text-xs font-extrabold text-paper-text-main">
                        【 {currentSeion} 】
                      </div>
                    )}

                    <div
                      className="p-3 hover:bg-paper-sub/60 transition cursor-pointer flex items-center justify-between gap-2 border-t border-paper-border"
                      onClick={() => setExpandedTitle(isExpanded ? null : group.title)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-paper-caramel shrink-0">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                        <div className={`font-bold text-paper-text-main text-sm ${isExpanded ? "whitespace-normal break-words" : "truncate"}`}>
                          {group.title}
                        </div>
                      </div>

                      <span className="bg-paper-sub text-paper-text-main px-2 py-0.5 text-xs border border-paper-border font-bold shrink-0">
                        全 {group.books.length} 冊
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="bg-paper-inner/90 p-2 md:p-3 space-y-2 border-b border-paper-border-dark">
                        {group.books.map((book) => {
                          const isBookExpanded = !!expandedBookIds[book.id];
                          const isSubExpanded = !!expandedSubTitles[book.id];
                          const isEditing = editingBookId === book.id;

                          return (
                            <div
                              key={book.id}
                              className="bg-paper-card border border-paper-border p-2.5 space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={(e) => toggleBookDetail(book.id, e)}
                                    className="w-20 text-paper-text-main flex items-center justify-center gap-1 bg-paper-sub hover:bg-paper-border border border-paper-border py-1 font-bold text-xs shrink-0 cursor-pointer"
                                  >
                                    {isBookExpanded ? <ChevronDown className="w-3.5 h-3.5 text-paper-caramel" /> : <ChevronRight className="w-3.5 h-3.5 text-paper-caramel" />}
                                    <span>{book.volume ? `${book.volume}巻` : "1(単)"}</span>
                                  </button>

                                  {book.sub_title && (
                                    <div
                                      onClick={(e) => toggleSubTitle(book.id, e)}
                                      className={`text-paper-text-sub text-xs cursor-pointer ${isSubExpanded ? "whitespace-normal break-words" : "truncate"}`}
                                      title="クリックで全文表示/折りたたみ"
                                    >
                                      {book.sub_title}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="flex items-center">
                                    {[1, 2, 3].map((star) => (
                                      <button
                                        key={star}
                                        type="button"
                                        onClick={(e) => handleRatingChange(book, star, e)}
                                        className="p-0.5 hover:scale-110 transition cursor-pointer"
                                        title={`${star}つ星`}
                                      >
                                        <Star
                                          className={`w-3.5 h-3.5 ${
                                            (book.rating || 0) >= star ? "fill-amber-400 text-amber-500" : "text-gray-400/70"
                                          }`}
                                        />
                                      </button>
                                    ))}
                                  </div>

                                  <span className="text-paper-text-sub text-[11px] font-mono">
                                    {book.created_at ? book.created_at.split("T")[0] : ""}
                                  </span>

                                  {/* 🔍 画像の有無に関わらずプレビューボタン用の領域を固定し、バランスを統一 */}
                                  <div className="w-6 flex items-center justify-center">
                                    {book.image_url ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPreviewImageUrl(book.image_url ?? null);
                                        }}
                                        className="p-1 bg-paper-sub hover:bg-paper-border border border-paper-border text-paper-text-main cursor-pointer rounded"
                                        title="画像プレビュー"
                                      >
                                        <ZoomIn className="w-3.5 h-3.5 text-paper-caramel" />
                                      </button>
                                    ) : (
                                      <div className="w-5" />
                                    )}
                                  </div>
                                </div>
                              </div>

                              {(isBookExpanded || isEditing) && (
                                <div className="mt-2 pt-2 border-t border-paper-border space-y-2 bg-paper-inner p-2.5">
                                  {isEditing ? (
                                    <div className="space-y-2.5">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[10px] text-paper-text-sub block font-bold">タイトル</label>
                                          <input
                                            type="text"
                                            value={editForm.title || ""}
                                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-paper-text-sub block font-bold">フリガナ</label>
                                          <input
                                            type="text"
                                            value={editForm.sort_title || ""}
                                            onChange={(e) => setEditForm({ ...editForm, sort_title: e.target.value })}
                                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full"
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[10px] text-paper-text-sub block font-bold">サブタイトル</label>
                                          <input
                                            type="text"
                                            value={editForm.sub_title || ""}
                                            onChange={(e) => setEditForm({ ...editForm, sub_title: e.target.value })}
                                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-paper-text-sub block font-bold">巻数</label>
                                          <input
                                            type="text"
                                            value={editForm.volume || ""}
                                            onChange={(e) => setEditForm({ ...editForm, volume: e.target.value })}
                                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full font-mono"
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[10px] text-paper-text-sub block font-bold">著者</label>
                                          <input
                                            type="text"
                                            value={editForm.authors || ""}
                                            onChange={(e) => setEditForm({ ...editForm, authors: e.target.value })}
                                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-paper-text-sub block font-bold">発行所</label>
                                          <input
                                            type="text"
                                            value={editForm.publisher || ""}
                                            onChange={(e) => setEditForm({ ...editForm, publisher: e.target.value })}
                                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full"
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[10px] text-paper-text-sub block font-bold">発行月</label>
                                          <input
                                            type="month"
                                            value={editForm.release_date || ""}
                                            onChange={(e) => setEditForm({ ...editForm, release_date: e.target.value })}
                                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full font-mono"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-paper-text-sub block font-bold">ISBN</label>
                                          <input
                                            type="text"
                                            value={editForm.isbn || ""}
                                            onChange={(e) => setEditForm({ ...editForm, isbn: e.target.value })}
                                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full font-mono"
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[10px] text-paper-text-sub block font-bold">シリーズ名</label>
                                          <input
                                            type="text"
                                            value={editForm.series || ""}
                                            onChange={(e) => setEditForm({ ...editForm, series: e.target.value })}
                                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-paper-text-sub block font-bold">置き場所</label>
                                          <input
                                            type="text"
                                            list="edit-location-list"
                                            value={editForm.location || ""}
                                            onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                                            placeholder="選択または自由入力"
                                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full"
                                          />
                                          <datalist id="edit-location-list">
                                            {existingLocations.map((loc) => (
                                              <option key={loc} value={loc} />
                                            ))}
                                          </datalist>
                                        </div>
                                      </div>

                                      <div>
                                        <label className="text-[10px] text-paper-text-sub block font-bold">メモ</label>
                                        <textarea
                                          rows={2}
                                          value={editForm.memo || ""}
                                          onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                                          className="bg-white border border-paper-border p-1.5 text-xs text-paper-text-main w-full"
                                        />
                                      </div>

                                      <div className="flex items-center justify-between pt-1 border-t border-paper-border">
                                        <button
                                          type="button"
                                          onClick={() => handleDelete(book.id, book.title, book.volume)}
                                          className="px-2.5 py-1 bg-paper-danger text-white text-xs flex items-center gap-1 font-bold cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>削除</span>
                                        </button>
                                        <div className="flex gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => setEditingBookId(null)}
                                            className="px-3 py-1 bg-paper-sub border border-paper-border text-paper-text-main text-xs font-bold cursor-pointer"
                                          >
                                            キャンセル
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSaveInline(book.id)}
                                            className="px-3 py-1 bg-paper-caramel text-white text-xs font-bold cursor-pointer"
                                          >
                                            保存
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2 text-xs">
                                      <div className="grid grid-cols-2 gap-2 items-center">
                                        <div>
                                          <span className="text-paper-text-sub block font-bold text-[10px]">著者</span>
                                          <span className="text-paper-text-main font-semibold break-words block">
                                            {book.authors || "ー"}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-paper-text-sub block font-bold text-[10px]">発行所</span>
                                          <span className="text-paper-text-main font-semibold break-words block">
                                            {book.publisher || "ー"}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2 items-center pt-1 border-t border-paper-border/50">
                                        <div>
                                          <span className="text-paper-text-sub block font-bold text-[10px]">発行月</span>
                                          <span className="font-mono text-paper-text-main text-xs block">
                                            {book.release_date || "ー"}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-paper-text-sub block font-bold text-[10px]">ISBN</span>
                                          <span className="font-mono text-paper-text-main text-xs block">
                                            {book.isbn || "ー"}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between pt-2 border-t border-paper-border">
                                        <button
                                          type="button"
                                          onClick={(e) => handleDelete(book.id, book.title, book.volume)}
                                          className="px-2.5 py-1 bg-paper-danger text-white text-xs flex items-center gap-1 font-bold cursor-pointer rounded"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>削除</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={(e) => startEditing(book, e)}
                                          className="px-3 py-1 bg-paper-sub hover:bg-paper-border border border-paper-border text-paper-text-main text-xs font-bold flex items-center gap-1 cursor-pointer rounded"
                                        >
                                          <Edit3 className="w-3.5 h-3.5 text-paper-caramel" />
                                          <span>編集</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {previewImageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out" 
          onClick={() => setPreviewImageUrl(null)}
        >
          <div 
            className="relative max-w-xl w-full bg-paper-card p-3 rounded-lg border border-paper-border space-y-2 shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-bold text-paper-text-main">表紙画像プレビュー</h3>
              <button 
                type="button" 
                onClick={() => setPreviewImageUrl(null)} 
                className="p-1 text-paper-text-sub hover:text-paper-text-main cursor-pointer bg-paper-sub rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full max-h-[75vh] overflow-hidden flex items-center justify-center bg-black rounded">
              <img 
                src={previewImageUrl} 
                alt="全画面プレビュー" 
                className="max-w-full max-h-[75vh] object-contain" 
              />
            </div>
          </div>
        </div>
      )}

      <FooterNav />
    </div>
  );
}