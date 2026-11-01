"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Plus, Search, Edit3, Trash2, BookOpen, Eye, EyeOff, Layers, X, Save } from "lucide-react";

const APP_VERSION = "v1.0.19";

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

// ひらがなの頭文字から五十音グループを判定するヘルパー
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

  // 編集モーダル用の状態
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [saving, setSaving] = useState(false);

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

  // 編集モーダルを開く
  const handleOpenEdit = (book: Book) => {
    setEditingBook({ ...book });
  };

  // 編集内容を保存する
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook) return;

    setSaving(true);
    const updateData = {
      title: editingBook.title,
      sort_title: editingBook.sort_title || editingBook.title,
      volume: editingBook.volume,
      series: editingBook.series,
      authors: editingBook.authors,
      publisher: editingBook.publisher,
      isbn: editingBook.isbn,
      status: editingBook.status,
      summary: editingBook.summary,
      memo: editingBook.memo,
      release_date: editingBook.release_date,
    };

    const { error } = await supabase
      .from("books")
      .update(updateData)
      .eq("id", editingBook.id);

    if (error) {
      alert("更新に失敗しました: " + error.message);
    } else {
      setBooks(books.map((b) => (b.id === editingBook.id ? { ...b, ...updateData } : b)));
      setEditingBook(null);
    }
    setSaving(false);
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

  // タイトルごとにグループ化
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

  // 巻数順にソート（例: 1巻, 2巻...）
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

  // 五十音セクションごとにグループを追跡するための変数
  let lastSeionGroup = "";

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-20">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-neutral-950/85 backdrop-blur-md border-b border-neutral-800 px-4 py-4 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold tracking-wider text-neutral-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" /> 本棚（持っている本）
            </h1>
            <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono">
              {APP_VERSION}
            </span>
            <Link
              href="/wants"
              className="text-xs text-neutral-400 hover:text-neutral-200 underline transition ml-2"
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
        {/* 検索パネル */}
        {isSearchOpen && (
          <div className="bg-neutral-900 border border-neutral-800 p-4 rounded space-y-3 transition-all">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="タイトル、ひらがな、著者、シリーズ、メモ、あらすじ等で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 pl-9 pr-4 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 rounded"
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
                <tr className="bg-neutral-950/70 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider">
                  <th className="p-3">タイトル</th>
                  <th className="p-3 w-40">巻数一覧</th>
                  <th className="p-3 w-28">登録日</th>
                  <th className="p-3 text-right w-28">詳細・操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 text-neutral-200">
                {groupedBooksList.map((group) => {
                  const isExpanded = expandedTitle === group.title;
                  const latestBook = group.books[0];

                  // 五十音グループが変わった時に小さめの区切り線・見出しを挿入
                  const currentSeion = group.seionGroup;
                  const showSeionHeader = currentSeion !== lastSeionGroup;
                  lastSeionGroup = currentSeion;

                  return (
                    <>
                      {/* 五十音の小見出しセクション */}
                      {showSeionHeader && (
                        <tr key={`seion-${currentSeion}`} className="bg-neutral-950 border-t-2 border-neutral-800">
                          <td colSpan={4} className="px-3 py-1.5 text-[11px] font-bold text-neutral-400 tracking-wider">
                            — {currentSeion} —
                          </td>
                        </tr>
                      )}

                      <tr 
                        key={group.title} 
                        className="hover:bg-neutral-800/40 transition cursor-pointer border-t border-neutral-800/60"
                        onClick={() => setExpandedTitle(isExpanded ? null : group.title)}
                      >
                        <td className="p-3 font-medium text-neutral-100">
                          <div>{group.title}</div>
                          {latestBook.series && (
                            <div className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                              <Layers className="w-3 h-3" /> シリーズ: {latestBook.series}
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
                                {b.volume ? `${b.volume}巻` : "—"}
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
                            className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ml-auto cursor-pointer ${
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

                      {/* 詳細展開エリア：巻ごとに個別で情報を表示 */}
                      {isExpanded && (
                        <tr key={`${group.title}-detail`} className="bg-neutral-950/80 border-b border-neutral-800">
                          <td colSpan={4} className="p-4 space-y-4">
                            <div className="space-y-3">
                              <span className="text-neutral-400 text-[11px] font-bold block border-b border-neutral-800 pb-1">
                                📚 巻ごとの詳細・個別情報（あらすじ・メモなど）
                              </span>
                              
                              <div className="space-y-3">
                                {group.books.map((book) => (
                                  <div 
                                    key={book.id} 
                                    className="bg-neutral-900 border border-neutral-800 p-3.5 rounded space-y-2 text-xs"
                                  >
                                    <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                                      <div className="flex items-center gap-3">
                                        <span className="font-mono bg-neutral-800 text-amber-300 px-2 py-0.5 rounded text-[11px] font-bold">
                                          {book.volume ? `${book.volume}巻` : "—"}
                                        </span>
                                        <span className="text-neutral-300">
                                          著者: <strong className="text-neutral-100">{book.authors || "—"}</strong>
                                        </span>
                                        <span className="text-neutral-400">
                                          出版社: {book.publisher || "—"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleOpenEdit(book)}
                                          className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[11px] flex items-center gap-1 transition cursor-pointer"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                          <span>その場で編集</span>
                                        </button>
                                        <button
                                          onClick={() => handleDelete(book.id, book.title, book.volume)}
                                          className="p-1 bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-400 rounded transition cursor-pointer"
                                          title="削除"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-neutral-400">
                                      <div>ISBN: <span className="font-mono text-neutral-300">{book.isbn || "—"}</span></div>
                                      <div>発売日: <span className="font-mono text-neutral-300">{book.release_date || "—"}</span></div>
                                    </div>

                                    {/* 巻ごとのあらすじ */}
                                    {book.summary && (
                                      <div className="pt-1">
                                        <span className="text-neutral-500 block text-[10px] mb-0.5 font-semibold">あらすじ</span>
                                        <p className="text-xs text-neutral-300 bg-neutral-950 p-2.5 rounded border border-neutral-800/60 leading-relaxed">
                                          {book.summary}
                                        </p>
                                      </div>
                                    )}

                                    {/* 巻ごとのメモ */}
                                    {book.memo && (
                                      <div className="pt-1">
                                        <span className="text-neutral-500 block text-[10px] mb-0.5 font-semibold">メモ</span>
                                        <p className="text-xs text-neutral-300 bg-neutral-950 p-2.5 rounded border border-neutral-800/60 italic">
                                          {book.memo}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ))}
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

      {/* 🛠️ その場で編集できるモーダル（ポップアップ） */}
      {editingBook && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-lg shadow-xl overflow-hidden my-8">
            <div className="flex justify-between items-center bg-neutral-950 px-5 py-4 border-b border-neutral-800">
              <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" /> 書籍情報の編集
              </h2>
              <button
                type="button"
                onClick={() => setEditingBook(null)}
                className="text-neutral-400 hover:text-neutral-100 p-1 rounded-full bg-neutral-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">ステータス</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingBook({ ...editingBook, status: "持っている" })}
                    className={`py-2 text-xs font-bold border transition cursor-pointer rounded ${
                      editingBook.status === "持っている"
                        ? "bg-neutral-100 text-neutral-950 border-neutral-100"
                        : "bg-neutral-950 text-neutral-400 border-neutral-800"
                    }`}
                  >
                    持っている本
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingBook({ ...editingBook, status: "欲しい" })}
                    className={`py-2 text-xs font-bold border transition cursor-pointer rounded ${
                      editingBook.status === "欲しい"
                        ? "bg-neutral-100 text-neutral-950 border-neutral-100"
                        : "bg-neutral-950 text-neutral-400 border-neutral-800"
                    }`}
                  >
                    欲しい本
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">タイトル *</label>
                  <input
                    type="text"
                    required
                    value={editingBook.title}
                    onChange={(e) => setEditingBook({ ...editingBook, title: e.target.value, sort_title: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 rounded focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">巻数</label>
                  <input
                    type="text"
                    value={editingBook.volume || ""}
                    onChange={(e) => setEditingBook({ ...editingBook, volume: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 rounded focus:outline-none focus:border-neutral-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">著者名</label>
                  <input
                    type="text"
                    value={editingBook.authors || ""}
                    onChange={(e) => setEditingBook({ ...editingBook, authors: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 rounded focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">シリーズ名</label>
                  <input
                    type="text"
                    value={editingBook.series || ""}
                    onChange={(e) => setEditingBook({ ...editingBook, series: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 rounded focus:outline-none focus:border-neutral-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">出版社</label>
                  <input
                    type="text"
                    value={editingBook.publisher || ""}
                    onChange={(e) => setEditingBook({ ...editingBook, publisher: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 rounded focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">ISBN</label>
                  <input
                    type="text"
                    value={editingBook.isbn || ""}
                    onChange={(e) => setEditingBook({ ...editingBook, isbn: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 rounded focus:outline-none focus:border-neutral-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">発売日</label>
                <input
                  type="date"
                  value={editingBook.release_date || ""}
                  onChange={(e) => setEditingBook({ ...editingBook, release_date: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 rounded focus:outline-none focus:border-neutral-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">あらすじ</label>
                <textarea
                  rows={3}
                  value={editingBook.summary || ""}
                  onChange={(e) => setEditingBook({ ...editingBook, summary: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 rounded focus:outline-none focus:border-neutral-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">メモ</label>
                <textarea
                  rows={2}
                  value={editingBook.memo || ""}
                  onChange={(e) => setEditingBook({ ...editingBook, memo: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 rounded focus:outline-none focus:border-neutral-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBook(null)}
                  className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded transition cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-300 text-neutral-950 text-xs font-bold rounded transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? "保存中..." : "変更を保存する"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}