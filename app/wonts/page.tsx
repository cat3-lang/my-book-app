"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, ChevronDown, ChevronRight, Trash2, Edit3, User, ImageIcon, X, ArrowUpDown, Camera, Save, Plus } from "lucide-react";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.0.80";

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
  
  // フォーム開閉状態（デフォルトで開いた状態、またはワンタップで切り替え）
  const [isFormOpen, setIsFormOpen] = useState(true);
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

  const handleEditBook = (book: WantBook, e: React.MouseEvent) => {
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
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
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
  };

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
      setEditingId(null);
    } else {
      const { error } = await supabase.from("books").insert([{ ...payload, created_at: new Date().toISOString() }]);
      if (error) alert("登録失敗: " + error.message);
    }

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
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-36 relative">
      
      {/* 🏷️ ヘッダー（右端に小さくバージョン表記） */}
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
            欲しい本リスト
          </h1>
          <span className="text-[10px] font-mono text-paper-text-sub opacity-60">
            {APP_VERSION}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 md:px-6 py-4 space-y-4">
        
        {/* 📥 ページ上部埋め込み・折りたたみ式入力フォーム */}
        <section className="bg-paper-card border border-paper-border shadow-xs rounded-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="w-full px-4 py-3 bg-paper-sub hover:bg-paper-border/50 transition flex items-center justify-between text-xs font-bold text-paper-text-main cursor-pointer"
          >
            <span className="flex items-center gap-2 text-paper-caramel">
              <Plus className="w-4 h-4" />
              <span>{editingId ? "欲しい本情報を編集中..." : "新しい本を登録・撮影する"}</span>
            </span>
            <span className="text-paper-text-sub text-[11px]">
              {isFormOpen ? "▲ 閉じる" : "▼ 開く"}
            </span>
          </button>

          {isFormOpen && (
            <div className="p-4 border-t border-paper-border space-y-3 bg-paper-card">
              <form onSubmit={handleSave} className="space-y-3 text-xs">
                
                {/* カメラ・写真選択セクション */}
                <div className="bg-paper-inner border border-paper-border p-3 rounded-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-paper-text-main flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-paper-caramel" />
                      写真（カメラ撮影・画像選択）
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-paper-caramel text-white font-bold text-xs shadow-xs hover:opacity-90 cursor-pointer flex items-center gap-1"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>ファイル選択 / カメラ</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </div>

                  {form.image_url && (
                    <div className="relative w-24 h-24 border border-paper-border overflow-hidden bg-white mt-2">
                      <img src={form.image_url} alt="プレビュー" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image_url: "" })}
                        className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-full cursor-pointer"
                        title="写真を削除"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

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
                      placeholder="例: パパ、子ども"
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
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-paper-sub border border-paper-border font-bold text-paper-text-main cursor-pointer"
                    >
                      キャンセル
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-6 py-2 bg-paper-caramel text-white font-bold cursor-pointer shadow-xs hover:opacity-95 flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingId ? "変更を保存する" : "この内容で登録する"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>

        {/* 📊 件数カウンターと並び替えバー */}
        <div className="bg-paper-card border border-paper-border p-3 flex items-center justify-between shadow-2xs">
          <div className="text-xs font-bold text-paper-text-sub font-mono">
            登録数：{books.length} 冊
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-paper-text-sub" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-paper-sub border border-paper-border text-xs text-paper-text-main px-2.5 py-1 focus:outline-none cursor-pointer font-bold"
            >
              <option value="date">登録日順</option>
              <option value="status">状態順</option>
            </select>
          </div>
        </div>

        {/* 📚 欲しい本リスト一覧 */}
        {loading ? (
          <p className="text-center text-paper-text-sub py-12 text-xs">読み込み中...</p>
        ) : sortedBooks.length === 0 ? (
          <div className="text-center py-16 bg-paper-card border border-paper-border space-y-2">
            <p className="text-xs text-paper-text-sub">欲しい本はまだ登録されていません</p>
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
                      <span className="bg-[#EAE2B7] text-[#593922] text-[11px] font-extrabold px-2.5 py-0.5 border border-[#D9CFAF] shrink-0">
                        {book.st_status}
                      </span>
                    )}
                  </div>

                  {book.requester && (
                    <div className="flex items-center justify-end pl-6 text-xs text-paper-text-sub">
                      <div className="flex items-center gap-1 font-bold text-paper-text-main bg-paper-sub px-2.5 py-0.5 border border-paper-border">
                        <User className="w-3 h-3 text-paper-caramel" />
                        <span>{book.requester}</span>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-paper-border bg-paper-inner p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-paper-card border border-paper-border h-40 flex items-center justify-center overflow-hidden">
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
                          onClick={(e) => handleEditBook(book, e)}
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
