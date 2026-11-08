"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, BookOpen, Trash2, Edit3, Camera, Upload, ZoomIn, X, ArrowUp, ArrowDown, Star, MapPin, CheckCircle } from "lucide-react";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.1.04";

type WantBook = {
  id: string;
  title: string;
  sub_title: string | null;
  sort_title: string | null;
  volume: string | null;
  series: string | null;
  authors: string | null;
  publisher: string | null;
  isbn: string | null;
  status: string; // "欲しい" または "その他" または "完了"
  memo: string | null;
  release_date: string | null;
  created_at: string;
  rating?: number | null;
  location?: string | null;
  image_url?: string | null;
};

export default function WantPage() {
  const [authChecking, setAuthChecking] = useState(true);
  const [books, setBooks] = useState<WantBook[]>([]);
  const [loading, setLoading] = useState(true);

  // タブ切り替え: "欲しい" | "その他" | "ログ"
  const [activeTab, setActiveTab] = useState<"欲しい" | "その他" | "ログ">("欲しい");

  // 編集中の本のIDとフォーム
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<WantBook>>({});

  // 画像拡大モーダル
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // カメラ撮影用
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeCameraBookId, setActiveCameraBookId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // 🔒 未ログインチェック
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

  // データの取得（本棚の「持っている」以外のもの全て、または完了ログ）
  const fetchBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .neq("status", "持っている");

    if (error) {
      console.error("Error fetching books:", error);
    } else {
      let fetchedBooks: WantBook[] = data || [];
      
      const savedOrder = localStorage.getItem("want_books_order");
      if (savedOrder) {
        try {
          const orderIds: string[] = JSON.parse(savedOrder);
          fetchedBooks.sort((a, b) => {
            const indexA = orderIds.indexOf(a.id);
            const indexB = orderIds.indexOf(b.id);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
        } catch (e) {}
      }
      setBooks(fetchedBooks);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authChecking) {
      fetchBooks();
    }
  }, [authChecking]);

  const saveOrder = (newBooks: WantBook[]) => {
    setBooks(newBooks);
    const orderIds = newBooks.map(b => b.id);
    localStorage.setItem("want_books_order", JSON.stringify(orderIds));
  };

  const moveUp = (index: number, currentList: WantBook[]) => {
    const targetBook = currentList[index];
    const globalIndex = books.findIndex(b => b.id === targetBook.id);
    if (globalIndex <= 0) return;

    // 全体配列で1つ上の要素を探して入れ替え
    const newBooks = [...books];
    // 同タブ内での上方向の要素を探す
    let prevTargetGlobalIndex = -1;
    for (let i = globalIndex - 1; i >= 0; i--) {
      const b = newBooks[i];
      if (activeTab === "ログ" ? b.status === "完了" : b.status === activeTab) {
        prevTargetGlobalIndex = i;
        break;
      }
    }
    if (prevTargetGlobalIndex !== -1) {
      const temp = newBooks[globalIndex];
      newBooks[globalIndex] = newBooks[prevTargetGlobalIndex];
      newBooks[prevTargetGlobalIndex] = temp;
      saveOrder(newBooks);
    }
  };

  const moveDown = (index: number, currentList: WantBook[]) => {
    const targetBook = currentList[index];
    const globalIndex = books.findIndex(b => b.id === targetBook.id);
    if (globalIndex === -1 || globalIndex >= books.length - 1) return;

    const newBooks = [...books];
    let nextTargetGlobalIndex = -1;
    for (let i = globalIndex + 1; i < newBooks.length; i++) {
      const b = newBooks[i];
      if (activeTab === "ログ" ? b.status === "完了" : b.status === activeTab) {
        nextTargetGlobalIndex = i;
        break;
      }
    }
    if (nextTargetGlobalIndex !== -1) {
      const temp = newBooks[globalIndex];
      newBooks[globalIndex] = newBooks[nextTargetGlobalIndex];
      newBooks[nextTargetGlobalIndex] = temp;
      saveOrder(newBooks);
    }
  };

  const startEditing = (book: WantBook) => {
    setEditingId(book.id);
    setEditForm({ ...book });
  };

  const handleSaveInline = async (id: string) => {
    const updateData = {
      title: editForm.title || "",
      sub_title: editForm.sub_title || null,
      sort_title: editForm.sort_title || editForm.title || "",
      volume: editForm.volume || null,
      series: editForm.series || null,
      authors: editForm.authors || null,
      publisher: editForm.publisher || null,
      status: editForm.status || "欲しい",
      memo: editForm.memo || null,
      rating: editForm.rating || 0,
      location: editForm.location || null,
      image_url: editForm.image_url || null,
    };

    const { error } = await supabase
      .from("books")
      .update(updateData)
      .eq("id", id);

    if (error) {
      alert("保存に失敗しました: " + error.message);
    } else {
      setBooks(books.map((b) => (b.id === id ? { ...b, ...updateData } : b)));
      setEditingId(null);
    }
  };

  // ステータスを「完了」にしてログに残す
  const handleMarkAsComplete = async (id: string) => {
    const { error } = await supabase
      .from("books")
      .update({ status: "完了" })
      .eq("id", id);

    if (error) {
      alert("更新に失敗しました: " + error.message);
    } else {
      setBooks(books.map(b => b.id === id ? { ...b, status: "完了" } : b));
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`「${title}」を削除してもよろしいですか？`)) return;

    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) {
      alert("削除に失敗しました: " + error.message);
    } else {
      const updated = books.filter((b) => b.id !== id);
      saveOrder(updated);
      if (editingId === id) setEditingId(null);
    }
  };

  const handleFileChange = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        const { error } = await supabase
          .from("books")
          .update({ image_url: result })
          .eq("id", id);

        if (!error) {
          setBooks(books.map(b => b.id === id ? { ...b, image_url: result } : b));
          if (editingId === id) setEditForm(prev => ({ ...prev, image_url: result }));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const startCameraForBook = (id: string) => {
    setActiveCameraBookId(id);
    setIsCameraOpen(true);
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        alert("カメラを起動できませんでした。");
        setIsCameraOpen(false);
      }
    }, 100);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !activeCameraBookId) return;

    canvas.width = 400;
    canvas.height = 566;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    const { error } = await supabase
      .from("books")
      .update({ image_url: dataUrl })
      .eq("id", activeCameraBookId);

    if (!error) {
      setBooks(books.map(b => b.id === activeCameraBookId ? { ...b, image_url: dataUrl } : b));
      if (editingId === activeCameraBookId) setEditForm(prev => ({ ...prev, image_url: dataUrl }));
    }

    stopCamera();
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraOpen(false);
    setActiveCameraBookId(null);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-paper-bg flex items-center justify-center text-xs text-paper-text-sub font-mono">
        認証確認中...
      </div>
    );
  }

  // タブでデータをフィルタリング ("欲しい", "その他", "ログ")
  const filteredBooks = books.filter(b => {
    if (activeTab === "ログ") {
      return b.status === "完了";
    }
    return b.status === activeTab;
  });

  return (
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-32 relative">
      <div className="absolute top-1 right-2 z-20 text-[9px] text-paper-text-sub font-mono">
        {APP_VERSION}
      </div>

      <header className="sticky top-0 z-10 bg-paper-card/95 backdrop-blur-md border-b border-paper-border px-3 py-2.5 md:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-sm font-bold text-paper-text-main flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-paper-caramel" /> Bookノート
          </h1>

          {/* 🟢 上部タブ切り替え (欲しい / その他 / ログボタン) */}
          <div className="flex items-center gap-1 bg-paper-sub p-1 border border-paper-border">
            <button
              type="button"
              onClick={() => setActiveTab("欲しい")}
              className={`px-3 py-1 text-xs font-bold transition cursor-pointer ${
                activeTab === "欲しい"
                  ? "bg-paper-card text-paper-text-main shadow-xs border border-paper-border"
                  : "text-paper-text-sub hover:text-paper-text-main"
              }`}
            >
              欲しい
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("その他")}
              className={`px-3 py-1 text-xs font-bold transition cursor-pointer ${
                activeTab === "その他"
                  ? "bg-paper-card text-paper-text-main shadow-xs border border-paper-border"
                  : "text-paper-text-sub hover:text-paper-text-main"
              }`}
            >
              その他
            </button>
            {/* 小さなログボタンタブ */}
            <button
              type="button"
              onClick={() => setActiveTab("ログ")}
              className={`px-2.5 py-1 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                activeTab === "ログ"
                  ? "bg-paper-card text-paper-caramel shadow-xs border border-paper-border"
                  : "text-paper-text-sub hover:text-paper-text-main"
              }`}
            >
              <CheckCircle className="w-3 h-3" />
              <span>ログ</span>
            </button>
          </div>
        </div>
      </header>

      {/* 🖼️ 画像拡大ポップアップモーダル */}
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
              <h3 className="text-xs font-bold text-paper-text-main">プレビュー拡大</h3>
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
                alt="拡大写真" 
                className="max-w-full max-h-[75vh] object-contain" 
              />
            </div>
          </div>
        </div>
      )}

      {/* 📷 カメラ撮影用モーダル */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm bg-paper-card border border-paper-border p-4 rounded-lg relative space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-paper-text-main">カメラで撮影</h2>
              <button type="button" onClick={stopCamera} className="p-1 text-paper-text-sub bg-paper-sub rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative w-full aspect-[400/566] max-h-[60vh] bg-black rounded overflow-hidden border border-paper-border">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
              <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
            <div className="flex justify-center pt-2">
              <button 
                type="button" 
                onClick={capturePhoto} 
                className="px-6 py-2 bg-paper-caramel text-white font-bold text-xs rounded-full shadow-md hover:opacity-90 cursor-pointer flex items-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                <span>撮影して反映</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-2 md:px-6 py-4 space-y-3">
        {loading ? (
          <p className="text-center text-paper-text-sub py-8 text-xs">読み込み中...</p>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-12 space-y-3 bg-paper-card border border-paper-border">
            <p className="text-xs text-paper-text-sub">
              {activeTab === "ログ" ? "完了したログはありません" : `${activeTab}タブにノートはありません`}
            </p>
            {activeTab !== "ログ" && (
              <Link
                href="/add"
                className="inline-block text-xs font-bold text-white bg-paper-caramel px-4 py-2 hover:opacity-90 transition"
              >
                新規登録する
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredBooks.map((book, index) => {
              const isEditing = editingId === book.id;
              const fileInputId = `want_file_${book.id}`;

              return (
                <div key={book.id} className="bg-paper-card border border-paper-border p-3 shadow-xs text-xs space-y-2">
                  {isEditing ? (
                    /* ✏️ インライン編集モード */
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
                          <label className="text-[10px] text-paper-text-sub block font-bold">ステータス</label>
                          <select
                            value={editForm.status || "欲しい"}
                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full font-bold"
                          >
                            <option value="欲しい">欲しい</option>
                            <option value="その他">その他</option>
                            <option value="完了">完了（ログ）</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-paper-text-sub block font-bold">置き場所・メモ棚</label>
                          <input
                            type="text"
                            value={editForm.location || ""}
                            onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-paper-text-sub block font-bold mb-0.5">お気に入り度</label>
                          <div className="flex items-center gap-1 py-0.5">
                            {[1, 2, 3].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setEditForm({ ...editForm, rating: editForm.rating === star ? 0 : star })}
                                className="cursor-pointer"
                              >
                                <Star
                                  className={`w-4 h-4 ${
                                    (editForm.rating || 0) >= star ? "fill-amber-400 text-amber-500" : "text-gray-400/70"
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-paper-text-sub block font-bold">詳細メモ</label>
                        <textarea
                          rows={2}
                          value={editForm.memo || ""}
                          onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                          className="bg-white border border-paper-border p-1.5 text-xs text-paper-text-main w-full"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1 border-t border-paper-border">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-paper-sub border border-paper-border text-paper-text-main font-bold cursor-pointer"
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveInline(book.id)}
                          className="px-3 py-1 bg-paper-caramel text-white font-bold cursor-pointer"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 📄 通常表示カード */
                    <div className="flex items-start gap-3">
                      {/* 上下並び替えボタン */}
                      <div className="flex flex-col gap-1 shrink-0 pt-1">
                        <button
                          type="button"
                          onClick={() => moveUp(index, filteredBooks)}
                          disabled={index === 0}
                          className="p-1 bg-paper-sub border border-paper-border hover:bg-paper-border disabled:opacity-20 cursor-pointer"
                          title="上へ移動"
                        >
                          <ArrowUp className="w-3.5 h-3.5 text-paper-text-main" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(index, filteredBooks)}
                          disabled={index === filteredBooks.length - 1}
                          className="p-1 bg-paper-sub border border-paper-border hover:bg-paper-border disabled:opacity-20 cursor-pointer"
                          title="下へ移動"
                        >
                          <ArrowDown className="w-3.5 h-3.5 text-paper-text-main" />
                        </button>
                      </div>

                      {/* 縦長サムネイル（クリックで拡大） */}
                      <div
                        className="w-14 aspect-[400/566] border border-paper-border bg-paper-inner shrink-0 overflow-hidden flex items-center justify-center cursor-pointer relative group"
                        onClick={() => book.image_url && setPreviewImageUrl(book.image_url)}
                      >
                        {book.image_url ? (
                          <img src={book.image_url} alt="表紙" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] text-paper-text-sub text-center px-0.5">写真なし</span>
                        )}
                        {book.image_url && (
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                            <ZoomIn className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* 本・メモの情報 */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {book.location && (
                            <span className="text-[10px] text-paper-text-sub flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-paper-caramel" />
                              {book.location}
                            </span>
                          )}
                          {(book.rating || 0) > 0 && (
                            <div className="flex items-center">
                              {[1, 2, 3].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-3 h-3 ${
                                    (book.rating || 0) >= star ? "fill-amber-400 text-amber-500" : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        <h2 className="font-bold text-sm text-paper-text-main break-words">
                          {book.title}
                        </h2>

                        {book.memo && (
                          <p className="text-xs text-paper-text-sub bg-paper-inner p-1.5 border border-paper-border/60 break-words">
                            {book.memo}
                          </p>
                        )}

                        {/* 操作ボタン類 */}
                        <div className="flex items-center justify-between pt-1.5 flex-wrap gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startCameraForBook(book.id)}
                              className="px-2 py-1 bg-paper-sub hover:bg-paper-border border border-paper-border text-[11px] font-bold cursor-pointer flex items-center gap-1"
                            >
                              <Camera className="w-3 h-3 text-paper-caramel" />
                              <span>撮影</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => document.getElementById(fileInputId)?.click()}
                              className="px-2 py-1 bg-paper-sub hover:bg-paper-border border border-paper-border text-[11px] font-bold cursor-pointer flex items-center gap-1"
                            >
                              <Upload className="w-3 h-3 text-paper-caramel" />
                              <span>画像選択</span>
                            </button>
                            <input
                              type="file"
                              id={fileInputId}
                              accept="image/*"
                              onChange={(e) => handleFileChange(book.id, e)}
                              className="hidden"
                            />

                            {/* 🟢 ログに残す（完了）ボタン ※ログタブ以外で表示 */}
                            {book.status !== "完了" && (
                              <button
                                type="button"
                                onClick={() => handleMarkAsComplete(book.id)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-bold cursor-pointer flex items-center gap-1"
                              >
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>完了にする</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEditing(book)}
                              className="px-2.5 py-1 bg-paper-sub hover:bg-paper-border border border-paper-border text-[11px] font-bold cursor-pointer flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3 text-paper-caramel" />
                              <span>編集</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(book.id, book.title)}
                              className="px-2 py-1 bg-paper-danger/10 text-paper-danger border border-paper-danger/30 text-[11px] font-bold cursor-pointer hover:bg-paper-danger hover:text-white transition"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
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