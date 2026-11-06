"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Plus, ChevronDown, ChevronRight, Trash2, Edit3, User, Image as ImageIcon, X, ArrowUpDown, Camera, Save } from "lucide-react";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.0.76";

type WantBook = {
  id: string;
  title: string;
  authors: string | null;
  publisher: string | null;
  isbn: string | null;
  status: string;
  st_status: string | null;
  requester: string | null;
  memo: string | null;
  image_url: string | null;
  created_at: string;
};

export default function WantBookPage() {
  const [books, setBooks] = useState<WantBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"date" | "status">("date");
  const [expandedIds, setExpandedIds] = useState<{ [key: string]: boolean }>({});
  
  // フォームの表示/非表示（アコーディオン）
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    authors: "",
    publisher: "",
    isbn: "",
    st_status: "",
    requester: "",
    memo: "",
    image_url: "",
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchWantBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("status", "欲しい")
      .order("created_at", { ascending: false });

    if (!error) {
      setBooks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWantBooks();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenAddForm = () => {
    setEditingId(null);
    setForm({
      title: "",
      authors: "",
      publisher: "",
      isbn: "",
      st_status: "",
      requester: "",
      memo: "",
      image_url: "",
    });
    setShowAddForm(true);
  };

  const handleOpenEditModal = (book: WantBook, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(book.id);
    setForm({
      title: book.title || "",
      authors: book.authors || "",
      publisher: book.publisher || "",
      isbn: book.isbn || "",
      st_status: book.st_status || "",
      requester: book.requester || "",
      memo: book.memo || "",
      image_url: book.image_url || "",
    });
    setShowAddForm(true);
    // 画面上部のフォームへスクロール
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 写真選択（ローカルファイル・カメラ撮影）
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setForm(prev => ({ ...prev, image_url: uploadEvent.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // 💡 タイトルが空欄でも写真か何かあれば「（無題）」で登録可能
    const finalTitle = form.title.trim() || (form.image_url ? "（写真のみ）" : "（無題）");

    const payload = {
      title: finalTitle,
      authors: form.authors.trim() || null,
      publisher: form.publisher.trim() || null,
      isbn: form.isbn.trim() || null,
      status: "欲しい",
      st_status: form.st_status.trim() || null,
      requester: form.requester.trim() || null,
      memo: form.memo.trim() || null,
      image_url: form.image_url.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase.from("books").update(payload).eq("id", editingId);
      if (error) alert("更新失敗: " + error.message);
    } else {
      const { error } = await supabase.from("books").insert([{ ...payload, created_at: new Date().toISOString() }]);
      if (error) alert("登録失敗: " + error.message);
    }

    setShowAddForm(false);
    fetchWantBooks();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("この本を削除しますか？")) return;
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (!error) {
      setBooks(books.filter(b => b.id !== id));
    }
  };

  const sortedBooks = [...books].sort((a, b) => {
    if (sortBy === "status") return (a.st_status || "").localeCompare(b.st_status || "", "ja");
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-32 relative">
      <header className="sticky top-0 z-10 bg-paper-card/95 backdrop-blur-md border-b border-paper-border px-3 py-2.5 md:px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1 text-xs font-bold text-paper-text-main bg-paper-sub px-2.5 py-1.5 border border-paper-border hover:bg-paper-border transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>本棚</span>
          </Link>
          <h1 className="text-sm font-bold text-paper-text-main">
            欲しい本
          </h1>
          <button
            type="button"
            onClick={() => {
              if (showAddForm) {
                setShowAddForm(false);
              } else {
                handleOpenAddForm();
              }
            }}
            className="bg-paper-caramel text-white text-xs px-3 py-1.5 font-bold flex items-center gap-1 hover:opacity-90 transition cursor-pointer shadow-xs"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showAddForm ? "閉じる" : "追加"}</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-2 md:px-6 py-4 space-y-4">
        
        {/* 📥 1. ページ直接埋め込み型 入力・撮影フォーム（すっきりデザイン） */}
        {showAddForm && (
          <div className="bg-paper-card border-2 border-paper-caramel p-4 shadow-md rounded-xs space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-paper-border pb-2">
              <h2 className="text-xs font-bold text-paper-text-main uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-paper-caramel" />
                {editingId ? "欲しい本を編集" : "新しい欲しい本を登録"}
              </h2>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-paper-text-sub hover:text-paper-text-main cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              
              {/* 📷 カメラ起動・写真エリア */}
              <div className="border border-paper-border bg-paper-inner p-3 rounded-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-paper-text-main text-xs flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-paper-caramel" />
                    表紙やメモの写真（写真だけでも登録OK）
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-paper-caramel text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer hover:opacity-90"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>カメラ / 写真選択</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                </div>

                {/* 撮影画像のプレビュー */}
                {form.image_url && (
                  <div className="relative w-28 h-28 border border-paper-border overflow-hidden bg-white mt-2">
                    <img src={form.image_url} alt="プレビュー" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, image_url: "" })}
                      className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-full cursor-pointer"
                      title="写真を削除"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* タイトル（必須ではなく任意入力） */}
              <div>
                <label className="block font-bold text-paper-text-sub mb-1">タイトル（空欄でも写真だけで保存可能）</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main"
                  placeholder="本のタイトル（省略可）"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-paper-text-sub mb-1">状態</label>
                  <input
                    type="text"
                    value={form.st_status}
                    onChange={(e) => setForm({ ...form, st_status: e.target.value })}
                    className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main font-bold"
                    placeholder="例: 予約中、発売待ち"
                  />
                </div>
                <div>
                  <label className="block font-bold text-paper-text-sub mb-1">希望者</label>
                  <input
                    type="text"
                    value={form.requester}
                    onChange={(e) => setForm({ ...form, requester: e.target.value })}
                    className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main"
                    placeholder="希望者の名前"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-paper-text-sub mb-1">著者</label>
                  <input
                    type="text"
                    value={form.authors}
                    onChange={(e) => setForm({ ...form, authors: e.target.value })}
                    className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main"
                  />
                </div>
                <div>
                  <label className="block font-bold text-paper-text-sub mb-1">発行所</label>
                  <input
                    type="text"
                    value={form.publisher}
                    onChange={(e) => setForm({ ...form, publisher: e.target.value })}
                    className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-paper-text-sub mb-1">メモ</label>
                <textarea
                  rows={2}
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  className="w-full bg-paper-inner border border-paper-border p-2 text-paper-text-main"
                  placeholder="メモなど"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-paper-border">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-paper-sub border border-paper-border font-bold text-paper-text-main cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-paper-caramel text-white font-bold cursor-pointer shadow-xs hover:opacity-95 flex items-center gap-1"
                >
                  <Save className="w-4 h-4" />
                  <span>登録する</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 📋 2. リスト件数・並び替えコントロール */}
        <div className="bg-paper-card border border-paper-border p-2.5 flex items-center justify-between shadow-2xs">
          <div className="text-xs font-bold text-paper-text-sub font-mono">
            {books.length} 冊
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-paper-text-sub" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-paper-sub border border-paper-border text-xs text-paper-text-main px-2 py-1 focus:outline-none cursor-pointer font-bold"
            >
              <option value="date">登録日順</option>
              <option value="status">状態順</option>
            </select>
          </div>
        </div>

        {/* 📚 3. 欲しい本一覧 */}
        {loading ? (
          <p className="text-center text-paper-text-sub py-12 text-xs">読み込み中...</p>
        ) : sortedBooks.length === 0 ? (
          <div className="text-center py-16 bg-paper-card border border-paper-border space-y-3">
            <p className="text-xs text-paper-text-sub">欲しい本が登録されていません</p>
            <button
              type="button"
              onClick={handleOpenAddForm}
              className="inline-block text-xs font-bold text-white bg-paper-caramel px-4 py-2 hover:opacity-90 transition cursor-pointer"
            >
              本を追加する
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedBooks.map((book) => {
              const isExpanded = !!expandedIds[book.id];
              const dateStr = book.created_at ? book.created_at.split("T")[0] : "";

              return (
                <div
                  key={book.id}
                  onClick={() => toggleExpand(book.id)}
                  className="bg-paper-card border border-paper-border p-3 shadow-xs transition hover:bg-paper-sub/40 cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-paper-caramel shrink-0">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </span>
                      <span className="text-[11px] font-mono text-paper-text-sub shrink-0">{dateStr}</span>
                      <div className="font-bold text-paper-text-main text-sm truncate">
                        {book.title}
                      </div>
                    </div>
                    {book.st_status && (
                      <span className="bg-[#EAE2B7] text-[#593922] text-[11px] font-extrabold px-2 py-0.5 border border-[#D9CFAF] shrink-0">
                        {book.st_status}
                      </span>
                    )}
                  </div>

                  {book.requester && (
                    <div className="flex items-center justify-end pl-6 text-xs text-paper-text-sub">
                      <div className="flex items-center gap-1 font-bold text-paper-text-main bg-paper-sub px-2 py-0.5 border border-paper-border">
                        <User className="w-3 h-3 text-paper-caramel" />
                        <span>{book.requester}</span>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-paper-border bg-paper-inner p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-paper-card border border-paper-border h-36 flex items-center justify-center overflow-hidden">
                          {book.image_url ? (
                            <img src={book.image_url} alt={book.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-center text-paper-text-sub space-y-1">
                              <ImageIcon className="w-6 h-6 mx-auto opacity-40" />
                              <span className="text-[10px]">写真なし</span>
                            </div>
                          )}
                        </div>

                        <div className="md:col-span-2 space-y-2 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] font-bold text-paper-text-sub block">著者</span>
                              <span className="font-semibold text-paper-text-main">{book.authors || "ー"}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-paper-text-sub block">発行所</span>
                              <span className="font-semibold text-paper-text-main">{book.publisher || "ー"}</span>
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-paper-text-sub block">ISBN</span>
                            <span className="font-mono text-paper-text-main">{book.isbn || "ー"}</span>
                          </div>
                          {book.memo && (
                            <div>
                              <span className="text-[10px] font-bold text-paper-text-sub block">メモ</span>
                              <p className="bg-paper-card p-2 border border-paper-border text-paper-text-body break-words">
                                {book.memo}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-paper-border">
                        <button
                          type="button"
                          onClick={(e) => handleDelete(book.id, e)}
                          className="px-3 py-1.5 bg-paper-danger text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> <span>削除</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditModal(book, e)}
                          className="px-4 py-1.5 bg-paper-sub hover:bg-paper-border border border-paper-border text-paper-text-main text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-paper-caramel" /> <span>編集</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <FooterNav />
    </div>
  );
}