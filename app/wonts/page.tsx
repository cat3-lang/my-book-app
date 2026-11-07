"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, ChevronDown, ChevronRight, Trash2, Edit3, User, ImageIcon, X, Camera, Save, Plus, ScanLine, RefreshCcw } from "lucide-react";
import FooterNav from "@/components/FooterNav";
import { Html5Qrcode } from "html5-qrcode";

const APP_VERSION = "v1.0.85";

type WantBook = {
  id: string;
  title: string;
  authors: string | null;
  publisher: string | null;
  isbn: string | null;
  status: string;
  requester: string | null;
  memo: string | null;
  image_url: string | null;
  created_at: string;
};

export default function WantBookPage() {
  const [books, setBooks] = useState<WantBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<{ [key: string]: boolean }>({});
  
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    authors: "",
    publisher: "",
    isbn: "",
    requester: "",
    memo: "",
    image_url: "",
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [fetching, setFetching] = useState(false);

  // バーコードスキャン用
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // 📸 カスタムカメラ撮影用モーダル＆Ref
  const [isCustomCameraOpen, setIsCustomCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

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
    return () => {
      stopScanner();
      stopCustomCamera();
    };
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
      requester: "",
      memo: "",
      image_url: "",
    });
    setErrorMessage("");
  };

  // 📸 カスタムカメラの起動
  const startCustomCamera = async () => {
    setIsCustomCameraOpen(true);
    setIsPreviewMode(false);
    setErrorMessage("");
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera start error:", err);
        setErrorMessage("カメラを起動できませんでした。権限を確認してください。");
        setIsCustomCameraOpen(false);
      }
    }, 100);
  };

  // 🛑 カスタムカメラの停止
  const stopCustomCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCustomCameraOpen(false);
    setIsPreviewMode(false);
  };

  // 📷 シャッターを切る
  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setForm(prev => ({ ...prev, image_url: dataUrl }));
    setIsPreviewMode(true);

    // カメラのストリームを止める
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  // 🔄 撮り直す
  const retakePhoto = () => {
    setIsPreviewMode(false);
    startCustomCamera();
  };

  // ISBN自動取得
  const handleAutoFetch = async (targetIsbn?: string) => {
    const cleanIsbn = (targetIsbn !== undefined ? targetIsbn : form.isbn).trim().replace(/-/g, "");
    if (!cleanIsbn) {
      setErrorMessage("ISBNを入力してください");
      return;
    }
    setFetching(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/book-fetch?isbn=${cleanIsbn}`);
      const data = await res.json();
      if (data && data.success) {
        setForm(prev => ({
          ...prev,
          isbn: cleanIsbn,
          title: data.title || prev.title,
          authors: data.authors || prev.authors,
          publisher: data.publisher || prev.publisher,
        }));
      } else {
        setErrorMessage("書籍が見つかりませんでした");
      }
    } catch (err) {
      setErrorMessage("取得に失敗しました");
    } finally {
      setFetching(false);
    }
  };

  // バーコードスキャン機能
  const startScanner = async () => {
    setIsScanning(true);
    setErrorMessage("");
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader-want");
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 100 },
          },
          async (decodedText) => {
            if (decodedText.startsWith("978") || decodedText.startsWith("979")) {
              await stopScanner();
              setForm(prev => ({ ...prev, isbn: decodedText }));
              handleAutoFetch(decodedText);
            }
          },
          () => {}
        );
      } catch (err) {
        console.error("Camera start error:", err);
        setErrorMessage("バーコードカメラを起動できませんでした。");
        setIsScanning(false);
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!form.title.trim() && !form.image_url) {
      setErrorMessage("タイトルまたは写真のいずれかを入力してください");
      return;
    }

    const finalTitle = form.title.trim() || (form.image_url ? "（写真のみ）" : "（無題）");

    const payload = {
      title: finalTitle,
      authors: form.authors.trim() || null,
      publisher: form.publisher.trim() || null,
      isbn: form.isbn.trim() || null,
      status: "欲しい",
      requester: form.requester.trim() || null,
      memo: form.memo.trim() || null,
      image_url: form.image_url.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase.from("books").update(payload).eq("id", editingId);
      if (error) {
        setErrorMessage("更新失敗: " + error.message);
        return;
      }
      setEditingId(null);
    } else {
      const { error } = await supabase.from("books").insert([{ ...payload, created_at: new Date().toISOString() }]);
      if (error) {
        setErrorMessage("登録失敗: " + error.message);
        return;
      }
    }

    setForm({
      title: "",
      authors: "",
      publisher: "",
      isbn: "",
      requester: "",
      memo: "",
      image_url: "",
    });

    fetchWantBooks();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("削除しますか？")) return;
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (!error) {
      setBooks(books.filter(b => b.id !== id));
    }
  };

  const sortedBooks = [...books].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-36 relative">
      
      {/* 🔴 カスタムカメラ撮影モーダル */}
      {isCustomCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-paper-card border border-paper-border p-4 rounded-lg relative space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-paper-text-main">
                {isPreviewMode ? "撮影プレビュー" : "カメラで撮影"}
              </h2>
              <button
                type="button"
                onClick={stopCustomCamera}
                className="p-1 text-paper-text-sub hover:text-paper-text-main bg-paper-sub rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* カメラ映像 / プレビュー用の枠 */}
            <div className="relative w-full aspect-[4/3] bg-black rounded overflow-hidden border border-paper-border flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${isPreviewMode ? "hidden" : "block"}`}
              ></video>
              <canvas
                ref={canvasRef}
                className={`w-full h-full object-cover ${isPreviewMode ? "block" : "hidden"}`}
              ></canvas>
            </div>

            {/* 操作ボタン */}
            <div className="flex justify-center gap-3 pt-2">
              {!isPreviewMode ? (
                <button
                  type="button"
                  onClick={takePhoto}
                  className="px-6 py-2.5 bg-paper-caramel text-white font-bold text-xs rounded-full shadow-md hover:opacity-90 cursor-pointer flex items-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  <span>シャッターを切る</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="px-4 py-2 bg-paper-sub border border-paper-border text-paper-text-main font-bold text-xs rounded shadow-xs hover:bg-paper-border cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    <span>撮り直す</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCustomCamera}
                    className="px-6 py-2 bg-emerald-600 text-white font-bold text-xs rounded shadow-xs hover:opacity-90 cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>この写真を使う</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* バーコードスキャン用モーダル */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-paper-card border border-paper-border p-4 rounded-lg relative space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-paper-text-main">バーコードを枠内に合わせてください</h2>
              <button
                type="button"
                onClick={stopScanner}
                className="p-1 text-paper-text-sub hover:text-paper-text-main bg-paper-sub rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div id="reader-want" className="w-full overflow-hidden rounded bg-black"></div>
            <p className="text-[11px] text-paper-text-sub text-center">
              本の裏表紙にある「978」から始まるバーコードをスキャンします
            </p>
          </div>
        </div>
      )}

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
              
              {errorMessage && (
                <div className="p-2 bg-red-950/20 border border-red-800 text-red-700 text-xs rounded">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-3 text-xs">
                
                {/* ISBN & バーコードスキャンボタン */}
                <div className="space-y-1">
                  <label className="block font-bold text-paper-text-sub">ISBN</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.isbn}
                      onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                      className="flex-1 bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleAutoFetch()}
                      disabled={fetching}
                      className="px-3 py-1.5 bg-paper-sub border border-paper-border font-bold text-paper-text-main hover:bg-paper-border cursor-pointer disabled:opacity-50"
                    >
                      {fetching ? "取得中..." : "自動取得"}
                    </button>
                    <button
                      type="button"
                      onClick={startScanner}
                      className="px-3 py-1.5 bg-paper-caramel text-white font-bold flex items-center gap-1 cursor-pointer hover:opacity-90 shrink-0"
                    >
                      <ScanLine className="w-4 h-4" />
                      <span>スキャン</span>
                    </button>
                  </div>
                </div>

                {/* 📸 カスタムカメラ撮影ボタン */}
                <div className="bg-paper-inner border border-paper-border p-3 rounded-xs space-y-2">
                  <span className="block font-bold text-paper-text-main">写真（カスタムカメラ枠）</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={startCustomCamera}
                      className="px-4 py-2 bg-paper-caramel text-white font-bold text-xs shadow-xs hover:opacity-90 cursor-pointer flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4" />
                      <span>カメラ枠を開いて撮影する</span>
                    </button>
                  </div>

                  {form.image_url && (
                    <div className="relative w-28 h-28 border border-paper-border overflow-hidden bg-white mt-2 shadow-xs">
                      <img src={form.image_url} alt="撮影プレビュー" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image_url: "" })}
                        className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-full cursor-pointer hover:bg-black"
                        title="写真を削除"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-paper-text-sub mb-1">タイトル</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main"
                  />
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
                  <label className="block font-bold text-paper-text-sub mb-1">希望者</label>
                  <input
                    type="text"
                    value={form.requester}
                    onChange={(e) => setForm({ ...form, requester: e.target.value })}
                    className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main"
                  />
                </div>

                <div>
                  <label className="block font-bold text-paper-text-sub mb-1">メモ</label>
                  <textarea
                    rows={2}
                    value={form.memo}
                    onChange={(e) => setForm({ ...form, memo: e.target.value })}
                    className="w-full bg-paper-inner border border-paper-border p-2 text-paper-text-main"
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
                    <span>{editingId ? "変更を保存する" : "登録する"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>

        <div className="bg-paper-card border border-paper-border p-3 flex items-center justify-between shadow-2xs">
          <div className="text-xs font-bold text-paper-text-sub font-mono">
            登録数：{books.length} 冊
          </div>
        </div>

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