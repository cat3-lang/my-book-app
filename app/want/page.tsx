"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, BookOpen, Plus, ChevronDown, ChevronRight, Trash2, Edit3, Heart, User, Calendar, Image as ImageIcon, X, ArrowUpDown } from "lucide-react";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.0.69";

type WantBook = {
  id: string;
  title: string;
  authors: string | null;
  publisher: string | null;
  isbn: string | null;
  status: string; // 【予約中】, 【発売待ち】, 【購入済み】, 【後日】 など自由
  rating: number; // 1〜5 (ハート用)
  requester: string | null; // 希望者 (パパ, ママ など)
  memo: string | null;
  image_url: string | null; // 写真のURL（Supabase Storage または 画像リンク）
  created_at: string;
};

export default function WantBookPage() {
  const [books, setBooks] = useState<WantBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"date" | "rating" | "status">("date");
  
  // 展開されているカードのID管理
  const [expandedIds, setExpandedIds] = useState<{ [key: string]: boolean }>({});
  
  // 新規追加 / 編集モーダルの状態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    authors: "",
    publisher: "",
    isbn: "",
    status: "【発売待ち】",
    rating: 5,
    requester: "パパ",
    memo: "",
    image_url: "",
  });

  const fetchWantBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("status", "欲しい") // もしくは欲しい本テーブルを分ける場合はそちらに調整
      .order("created_at", { ascending: false });

    // ※もし「status」カラムで「持っている」「欲しい」を管理している場合、
    // 希望者や細かな状態を柔軟に扱うために、専用のステータス管理に合わせられます。
    if (error) {
      console.error("Error:", error);
    } else {
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

  const handleOpenAddModal = () => {
    setEditingId(null);
    setForm({
      title: "",
      authors: "",
      publisher: "",
      isbn: "",
      status: "【発売待ち】",
      rating: 5,
      requester: "パパ",
      memo: "",
      image_url: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (book: WantBook, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(book.id);
    setForm({
      title: book.title || "",
      authors: book.authors || "",
      publisher: book.publisher || "",
      isbn: book.isbn || "",
      status: book.status || "【発売待ち】",
      rating: book.rating || 5,
      requester: book.requester || "パパ",
      memo: book.memo || "",
      image_url: book.image_url || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      alert("件名（タイトル）を入力してください。");
      return;
    }

    const payload = {
      title: form.title.trim(),
      authors: form.authors.trim() || null,
      publisher: form.publisher.trim() || null,
      isbn: form.isbn.trim() || null,
      status: form.status.trim() || "【発売待ち】",
      rating: form.rating,
      requester: form.requester.trim() || null,
      memo: form.memo.trim() || null,
      image_url: form.image_url.trim() || null,
      st_status: "欲しい" // 欲しい本フラグ
    };

    if (editingId) {
      const { error } = await supabase.from("books").update(payload).eq("id", editingId);
      if (error) alert("更新失敗: " + error.message);
    } else {
      const { error } = await supabase.from("books").insert([{ ...payload, created_at: new Date().toISOString() }]);
      if (error) alert("登録失敗: " + error.message);
    }

    setIsModalOpen(false);
    fetchWantBooks();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("この本をリストから削除しますか？")) return;
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (!error) {
      setBooks(books.filter(b => b.id !== id));
    }
  };

  // ソート処理
  const sortedBooks = [...books].sort((a, b) => {
    if (sortBy === "rating") {
      return (b.rating || 0) - (a.rating || 0);
    } else if (sortBy === "status") {
      return (a.status || "").localeCompare(b.status || "", "ja");
    } else {
      // date (新しい順)
      return new Date(b.created_at).getTime() - new Date(b.created_at).getTime();
    }
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
          <h1 className="text-sm font-bold text-paper-text-main flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-paper-caramel fill-paper-caramel" /> 欲しい本ボード
          </h1>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="bg-paper-caramel text-white text-xs px-3 py-1.5 font-bold flex items-center gap-1 hover:opacity-90 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" /> <span>追加</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-2 md:px-6 py-4 space-y-3">
        {/* ソートバー */}
        <div className="bg-paper-card border border-paper-border p-2.5 flex items-center justify-between shadow-2xs">
          <div className="text-xs font-bold text-paper-text-sub font-mono">
            全 {books.length} 冊
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-paper-text-sub" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-paper-sub border border-paper-border text-xs text-paper-text-main px-2 py-1 focus:outline-none cursor-pointer font-bold"
            >
              <option value="date">登録日順</option>
              <option value="rating">欲しい度順</option>
              <option value="status">状態順</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-paper-text-sub py-12 text-xs">読み込み中...</p>
        ) : sortedBooks.length === 0 ? (
          <div className="text-center py-16 bg-paper-card border border-paper-border space-y-3">
            <p className="text-xs text-paper-text-sub">欲しい本がまだ登録されていません</p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-block text-xs font-bold text-white bg-paper-caramel px-4 py-2 hover:opacity-90 transition cursor-pointer"
            >
              最初の本を追加する
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedBooks.map((book) => {
              const isExpanded = !!expandedIds[book.id];
              const dateStr = book.created_at ? book.created_at.split("T")[0] : "";
              const hearts = "❤️".repeat(book.rating || 3);

              return (
                <div
                  key={book.id}
                  onClick={() => toggleExpand(book.id)}
                  className="bg-paper-card border border-paper-border p-3 shadow-xs transition hover:bg-paper-sub/40 cursor-pointer space-y-2"
                >
                  {/* 1段目: 投稿日 ｜ 件名 ＆ 状態 */}
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
                    <span className="bg-[#EAE2B7] text-[#593922] text-[11px] font-extrabold px-2 py-0.5 border border-[#D9CFAF] shrink-0">
                      {book.status || "【発売待ち】"}
                    </span>
                  </div>

                  {/* 2段目: 欲しい度(ハート) ＆ 希望者 */}
                  <div className="flex items-center justify-between pl-6 text-xs text-paper-text-sub">
                    <div className="tracking-widest text-xs" title={`欲しい度: ${book.rating}/5`}>
                      {hearts}
                    </div>
                    <div className="flex items-center gap-1 font-bold text-paper-text-main bg-paper-sub px-2 py-0.5 border border-paper-border">
                      <User className="w-3 h-3 text-paper-caramel" />
                      <span>{book.requester || "家族"}</span>
                    </div>
                  </div>

                  {/* 折りたたみ詳細エリア */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-paper-border bg-paper-inner p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* 写真エリア */}
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

                        {/* 書籍データ */}
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
                          <div>
                            <span className="text-[10px] font-bold text-paper-text-sub block">メモ・コメント</span>
                            <p className="bg-paper-card p-2 border border-paper-border text-paper-text-body italic break-words">
                              {book.memo || "メモはありません"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* アクションボタン */}
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
                          <Edit3 className="w-3.5 h-3.5 text-paper-caramel" /> <span>編集する</span>
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

      {/* 登録・編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-paper-card border border-paper-border w-full max-w-lg p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-paper-border pb-2">
              <h2 className="text-xs font-bold text-paper-text-main uppercase tracking-wider">
                {editingId ? "欲しい本を編集" : "欲しい本を登録"}
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-1 text-paper-text-sub hover:text-paper-text-main">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-paper-text-sub mb-1">件名（タイトルなど） *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main"
                  placeholder="例:〇〇の冒険 新巻"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-paper-text-sub mb-1">状態（ステータス）</label>
                  <input
                    type="text"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main font-bold"
                    placeholder="【予約中】 【発売待ち】 等"
                  />
                </div>
                <div>
                  <label className="block font-bold text-paper-text-sub mb-1">希望者</label>
                  <input
                    type="text"
                    value={form.requester}
                    onChange={(e) => setForm({ ...form, requester: e.target.value })}
                    className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main"
                    placeholder="パパ、ママ、子ども 等"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-paper-text-sub mb-1">欲しい度（ハート数: 1〜5）</label>
                <div className="flex items-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setForm({ ...form, rating: num })}
                      className={`px-3 py-1 border text-xs font-bold transition cursor-pointer ${
                        form.rating === num ? "bg-paper-caramel text-white border-paper-caramel" : "bg-paper-sub text-paper-text-body border-paper-border"
                      }`}
                    >
                      {num}個 {"❤️".repeat(num)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-paper-text-sub mb-1">著者名</label>
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
                <label className="block font-bold text-paper-text-sub mb-1">写真画像URL（またはポップの写真等）</label>
                <input
                  type="text"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main font-mono"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block font-bold text-paper-text-sub mb-1">メモ・コメント</label>
                <textarea
                  rows={2}
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  className="w-full bg-paper-inner border border-paper-border p-2 text-paper-text-main"
                  placeholder="「図書館で予約済み」「来月発売」など"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-paper-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-paper-sub border border-paper-border font-bold text-paper-text-main cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-paper-caramel text-white font-bold cursor-pointer shadow-xs hover:opacity-95"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FooterNav />
    </div>
  );
}