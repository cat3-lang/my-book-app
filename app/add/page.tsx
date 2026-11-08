"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, BookOpen, Check, Calendar, Camera, Upload, X, Search, Loader2, AlertCircle, Trash2, Star, MapPin, ZoomIn, Crop, Save, ListPlus } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.1.00";

type BookInfo = {
  id?: string;
  isbn: string | null;
  title: string;
  sub_title?: string | null;
  sort_title: string | null;
  created_at?: string;
  status: "持っている" | "欲しい";
  memo: string | null;
  volume?: string | null;
  series?: string | null;
  authors?: string | null;
  publisher?: string | null;
  release_date?: string | null;
  rating?: number | null;
  location?: string | null;
  image_url?: string | null;
};

type DraftBookInfo = BookInfo & { draft_id: string };

export default function AddBookPage() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = "/login";
    });
  }, []);

  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [subTitle, setSubTitle] = useState("");
  const [sortTitle, setSortTitle] = useState("");
  const [volume, setVolume] = useState("");
  const [series, setSeries] = useState("");
  const [authors, setAuthors] = useState("");
  const [publisher, setPublisher] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [status, setStatus] = useState<"持っている" | "欲しい">("持っている");
  const [memo, setMemo] = useState("");
  const [registeredDate, setRegisteredDate] = useState(new Date().toISOString().split("T")[0]);
  const [rating, setRating] = useState<number>(0);
  const [location, setLocation] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");

  const [existingLocations, setExistingLocations] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 画面・モーダル管理
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const rawImageRef = useRef<HTMLImageElement | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [existingBook, setExistingBook] = useState<BookInfo | null>(null);
  const [matchedDraft, setMatchedDraft] = useState<DraftBookInfo | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [isCustomCameraOpen, setIsCustomCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    supabase.from("books").select("location").then(({ data }) => {
      if (data) setExistingLocations(Array.from(new Set(data.map(b => b.location).filter(Boolean))) as string[]);
    });
  }, []);

  // フォームクリア（保持する項目を指定可能）
  const resetForm = (keepRatingAndLocation = false) => {
    setIsbn("");
    setTitle("");
    setSubTitle("");
    setSortTitle("");
    setVolume("");
    setSeries("");
    setAuthors("");
    setPublisher("");
    setReleaseDate("");
    setMemo("");
    setImageUrl("");
    setExistingBook(null);
    setMatchedDraft(null);
    setCheckMessage(null);
    setSuccessMessage("");
    setErrorMessage("");
    if (!keepRatingAndLocation) {
      setRating(0);
      setLocation("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => ev.target?.result && setImageUrl(ev.target.result as string);
      reader.readAsDataURL(file);
    }
  };

  // 書籍データの自動取得＆存在チェック
  const handleAutoFetchAndCheck = async (targetIsbn?: string) => {
    const cleanIsbn = (targetIsbn !== undefined ? targetIsbn : isbn).trim();
    if (!cleanIsbn) {
      setCheckMessage("ISBNを入力してください。");
      setExistingBook(null);
      setMatchedDraft(null);
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setFetching(true);
    setErrorMessage("");
    setCheckMessage(null);

    try {
      // 1. 本棚（Supabase）チェック
      const { data: foundData } = await supabase
        .from("books")
        .select("*")
        .eq("isbn", cleanIsbn)
        .single();

      if (foundData) {
        setExistingBook(foundData);
        setMatchedDraft(null);
        fillFormFields(foundData);
        setCheckMessage("⚠️ すでに本棚に登録されています。");
        setFetching(false);
        return;
      }

      // 2. 待機リスト（localStorage）チェック
      const localDraftsRaw = localStorage.getItem("book_drafts");
      if (localDraftsRaw) {
        const drafts = JSON.parse(localDraftsRaw);
        const draftMatch = drafts.find((d: any) => d.isbn === cleanIsbn);
        if (draftMatch) {
          setMatchedDraft({ ...draftMatch, draft_id: draftMatch.id });
          setExistingBook(null);
          fillFormFields(draftMatch);
          setCheckMessage("📋 待機リストに保存されている本です。");
          setFetching(false);
          return;
        }
      }

      // 3. 国立国会図書館API
      const res = await fetch(`/api/book-fetch?isbn=${cleanIsbn}`, { signal: controller.signal });
      const data = await res.json();

      setExistingBook(null);
      setMatchedDraft(null);
      if (data && data.success) {
        if (data.title) setTitle(data.title);
        if (data.subTitle) setSubTitle(data.subTitle);
        if (data.sortTitle) setSortTitle(data.sortTitle);
        if (data.volume) setVolume(data.volume);
        if (data.series) setSeries(data.series);
        if (data.authors) setAuthors(data.authors);
        if (data.publisher) setPublisher(data.publisher);
        if (data.releaseDate) setReleaseDate(data.releaseDate);
        setCheckMessage("✅ 国立国会図書館から情報を取得しました（未登録）");
      } else {
        setCheckMessage("✅ 未登録です（手動入力してください）");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") setErrorMessage("情報の取得中にエラーが発生しました。");
    } finally {
      if (abortControllerRef.current === controller) setFetching(false);
    }
  };

  const fillFormFields = (data: any) => {
    setTitle(data.title || "");
    setSubTitle(data.sub_title || "");
    setSortTitle(data.sort_title || data.title || "");
    setStatus(data.status || "持っている");
    setMemo(data.memo || "");
    setRating(data.rating || 0);
    setLocation(data.location || "");
    if (data.volume) setVolume(data.volume);
    if (data.series) setSeries(data.series);
    if (data.authors) setAuthors(data.authors);
    if (data.publisher) setPublisher(data.publisher);
    if (data.release_date) setReleaseDate(data.release_date);
    if (data.created_at) setRegisteredDate(data.created_at.split("T")[0]);
    if (data.image_url) setImageUrl(data.image_url);
  };

  const handleDeleteExistingBook = async () => {
    if (!existingBook) return;
    setLoading(true);
    const { error } = await supabase.from("books").delete().eq("id", existingBook.id);
    setLoading(false);
    if (error) setErrorMessage(`削除に失敗しました: ${error.message}`);
    else {
      setSuccessMessage("データベースから本のデータを削除しました");
      resetForm();
    }
  };

  // スキャナ操作
  const startScanner = async () => {
    resetForm(true); // 読み取り時は星と置き場所以外をクリア
    setIsScanning(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 100 } },
          (decodedText) => {
            if (decodedText.startsWith("978") || decodedText.startsWith("979")) {
              setIsbn(decodedText);
              stopScanner();
              handleAutoFetchAndCheck(decodedText);
            }
          },
          () => {}
        );
      } catch (err) {
        setErrorMessage("カメラを起動できませんでした。");
        setIsScanning(false);
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {}
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  // カスタムカメラ操作
  const startCustomCamera = async () => {
    setIsCustomCameraOpen(true);
    setIsPreviewMode(false);
    setErrorMessage("");
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        mediaStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        setErrorMessage("カメラを起動できませんでした。");
        setIsCustomCameraOpen(false);
      }
    }, 100);
  };

  const stopCustomCamera = () => {
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    setIsCustomCameraOpen(false);
    setIsPreviewMode(false);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = 400;
    canvas.height = 566;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const vW = video.videoWidth, vH = video.videoHeight;
      const aspect = 400 / 566;
      let sW = vW, sH = vW / aspect, sX = 0, sY = (vH - sH) / 2;
      if (sH > vH) { sH = vH; sW = vH * aspect; sX = (vW - sW) / 2; sY = 0; }
      ctx.drawImage(video, sX, sY, sW, sH, 0, 0, canvas.width, canvas.height);
    }
    setImageUrl(canvas.toDataURL("image/jpeg", 0.85));
    setIsPreviewMode(true);
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
  };

  const applyCrop = () => {
    const img = rawImageRef.current;
    const canvas = cropCanvasRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 566;
    ctx.clearRect(0, 0, 400, 566);
    ctx.save();
    ctx.translate(200 + cropOffsetX, 283 + cropOffsetY);
    ctx.scale(cropZoom, cropZoom);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    setImageUrl(canvas.toDataURL("image/jpeg", 0.85));
    setIsCropOpen(false);
  };

  // 待機リストへ保存
  const handleSaveToDrafts = () => {
    if (!title.trim() && !isbn.trim()) {
      alert("タイトルまたはISBNを入力してください。");
      return;
    }
    const draftItem = {
      id: "draft_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      isbn: isbn.trim() || null,
      title: title.trim() || "（タイトル未入力）",
      sub_title: subTitle.trim() || null,
      sort_title: sortTitle.trim() || title.trim(),
      volume: volume.trim() || null,
      series: series.trim() || null,
      authors: authors.trim() || null,
      publisher: publisher.trim() || null,
      release_date: releaseDate.trim() || null,
      status,
      memo: memo.trim() || null,
      registered_date: registeredDate,
      rating,
      location: location.trim() || null,
      image_url: imageUrl || null,
      created_at: new Date().toISOString(),
    };

    try {
      const drafts = JSON.parse(localStorage.getItem("book_drafts") || "[]");
      drafts.unshift(draftItem);
      localStorage.setItem("book_drafts", JSON.stringify(drafts));
      setSuccessMessage("待機リストに保存しました");
      resetForm();
    } catch (e) {
      setErrorMessage("一時保存に失敗しました。");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    return () => {
      stopScanner();
      stopCustomCamera();
      abortControllerRef.current?.abort();
    };
  }, []);

  // 本の登録・更新処理（フォームをクリアせずそのまま残す）
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("タイトルは必須です。");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    const cleanIsbn = isbn.trim();
    const payload = {
      isbn: cleanIsbn || null,
      title: title.trim(),
      sub_title: subTitle.trim() || null,
      sort_title: sortTitle.trim() || title.trim(),
      volume: volume.trim() || null,
      series: series.trim() || null,
      authors: authors.trim() || null,
      publisher: publisher.trim() || null,
      release_date: releaseDate.trim() || null,
      status,
      memo: memo.trim() || null,
      rating,
      location: location.trim() || null,
      image_url: imageUrl || null,
    };

    if (existingBook) {
      const { error } = await supabase.from("books").update(payload).eq("id", existingBook.id);
      if (error) setErrorMessage(`更新に失敗しました: ${error.message}`);
      else setSuccessMessage("既存のデータを更新しました");
    } else {
      const { error } = await supabase.from("books").insert([
        { ...payload, created_at: registeredDate ? new Date(registeredDate).toISOString() : new Date().toISOString() }
      ]);
      if (error) {
        if (error.code === "23505") setErrorMessage("このISBNの本はすでに登録されています。");
        else setErrorMessage(`登録に失敗しました: ${error.message}`);
      } else {
        if (matchedDraft) {
          try {
            const drafts = JSON.parse(localStorage.getItem("book_drafts") || "[]");
            localStorage.setItem("book_drafts", JSON.stringify(drafts.filter((d: any) => d.id !== matchedDraft.draft_id)));
          } catch (e) {}
        }
        setSuccessMessage("本を登録しました");
      }
    }
    setLoading(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-44 relative">
      <header className="sticky top-0 z-10 bg-paper-card/95 backdrop-blur-md border-b border-paper-border px-4 py-3 md:px-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-xs font-bold text-paper-text-main bg-paper-sub px-3 py-1.5 border border-paper-border hover:bg-paper-border transition">
            <ArrowLeft className="w-4 h-4" />
            <span>本棚に戻る</span>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-wider text-paper-text-main">本を登録する</h1>
            <span className="text-[10px] bg-paper-sub text-paper-text-sub px-1.5 py-0.5 font-mono border border-paper-border">{APP_VERSION}</span>
          </div>
          <Link href="/drafts" className="flex items-center gap-1 text-xs font-bold text-paper-caramel bg-paper-sub px-3 py-1.5 border border-paper-border hover:bg-paper-border transition">
            <ListPlus className="w-4 h-4" />
            <span>待機リスト</span>
          </Link>
        </div>
      </header>

      {/* スキャナ モーダル */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-paper-card border border-paper-border p-4 relative shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-paper-text-main">バーコードを合わせてください</h2>
              <button type="button" onClick={stopScanner} className="p-1 text-paper-text-sub bg-paper-sub border border-paper-border cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div id="reader" className="w-full overflow-hidden bg-black"></div>
          </div>
        </div>
      )}

      {/* カメラ モーダル */}
      {isCustomCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm bg-paper-card border border-paper-border p-4 rounded-lg relative space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-paper-text-main">{isPreviewMode ? "撮影プレビュー" : "カメラで撮影（縦長）"}</h2>
              <button type="button" onClick={stopCustomCamera} className="p-1 text-paper-text-sub bg-paper-sub rounded-full cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="relative w-full aspect-[400/566] max-h-[65vh] bg-black rounded overflow-hidden border border-paper-border flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${isPreviewMode ? "hidden" : "block"}`}></video>
              <canvas ref={canvasRef} className={`w-full h-full object-cover ${isPreviewMode ? "block" : "hidden"}`}></canvas>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              {!isPreviewMode ? (
                <button type="button" onClick={takePhoto} className="px-6 py-2.5 bg-paper-caramel text-white font-bold text-xs rounded-full shadow-md hover:opacity-95 cursor-pointer flex items-center gap-1.5"><Camera className="w-4 h-4" /><span>シャッターを切る</span></button>
              ) : (
                <>
                  <button type="button" onClick={() => { setIsPreviewMode(false); startCustomCamera(); }} className="px-4 py-2 bg-paper-sub border border-paper-border text-paper-text-main font-bold text-xs rounded shadow-xs cursor-pointer">撮り直す</button>
                  <button type="button" onClick={stopCustomCamera} className="px-6 py-2 bg-emerald-600 text-white font-bold text-xs rounded shadow-xs cursor-pointer">この写真を使う</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 拡大プレビュー */}
      {isZoomOpen && imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4" onClick={() => setIsZoomOpen(false)}>
          <div className="relative max-w-lg w-full bg-paper-card p-2 rounded-lg border border-paper-border space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-2">
              <h3 className="text-xs font-bold text-paper-text-main">画像プレビュー</h3>
              <button type="button" onClick={() => setIsZoomOpen(false)} className="p-1 text-paper-text-sub hover:text-paper-text-main cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="w-full max-h-[70vh] overflow-hidden flex items-center justify-center bg-black">
              <img src={imageUrl} alt="拡大プレビュー" className="max-w-full max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* トリミング モーダル */}
      {isCropOpen && imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm bg-paper-card border border-paper-border p-4 rounded-lg relative space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-paper-text-main">位置調整・トリミング</h3>
              <button type="button" onClick={() => setIsCropOpen(false)} className="p-1 text-paper-text-sub hover:text-paper-text-main cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <img ref={rawImageRef} src={imageUrl} alt="raw" className="hidden" onLoad={() => { setCropZoom(1); setCropOffsetX(0); setCropOffsetY(0); }} />
            <div 
              className="relative w-full aspect-[400/566] max-h-[60vh] bg-black rounded overflow-hidden border border-paper-border flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                dragRef.current = { isDragging: true, startX: e.clientX, startY: e.clientY, initialX: cropOffsetX, initialY: cropOffsetY };
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!dragRef.current.isDragging) return;
                setCropOffsetX(dragRef.current.initialX + (e.clientX - dragRef.current.startX));
                setCropOffsetY(dragRef.current.initialY + (e.clientY - dragRef.current.startY));
              }}
              onPointerUp={(e) => {
                dragRef.current.isDragging = false;
                try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch(err) {}
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
                <img src={imageUrl} alt="editing" style={{ transform: `translate(${cropOffsetX}px, ${cropOffsetY}px) scale(${cropZoom})`, transition: dragRef.current.isDragging ? "none" : "transform 0.05s ease-out", maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
              </div>
              <div className="absolute inset-4 border-2 border-dashed border-white/80 pointer-events-none rounded"></div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between"><span className="font-bold text-paper-text-sub">拡大・縮小</span><span className="font-mono">{cropZoom.toFixed(2)}x</span></div>
              <input type="range" min="0.5" max="3" step="0.05" value={cropZoom} onChange={(e) => setCropZoom(parseFloat(e.target.value))} className="w-full accent-paper-caramel" />
            </div>
            <canvas ref={cropCanvasRef} className="hidden"></canvas>
            <div className="flex justify-end gap-2 pt-2 border-t border-paper-border">
              <button type="button" onClick={() => setIsCropOpen(false)} className="px-4 py-1.5 bg-paper-sub border border-paper-border font-bold text-xs rounded cursor-pointer">キャンセル</button>
              <button type="button" onClick={applyCrop} className="px-6 py-1.5 bg-paper-caramel text-white font-bold text-xs rounded shadow-xs cursor-pointer">適用</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-8 md:px-8 space-y-4">
        {successMessage && (
          <div className="p-3 bg-[#E6F4EA] border border-[#A8DADC] text-[#1D3557] text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-[#2A9D8F]" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-[#F8D7DA] border border-[#F5C6CB] text-[#721C24] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-paper-card border border-paper-border p-5 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold text-paper-text-main uppercase tracking-wider flex items-center gap-1.5 border-b border-paper-border pb-2">
              <BookOpen className="w-3.5 h-3.5 text-paper-caramel" /> 書籍詳細
            </h2>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setStatus("持っている")} className={`py-2 text-xs font-bold border transition cursor-pointer ${status === "持っている" ? "bg-paper-caramel text-white border-paper-caramel" : "bg-paper-sub text-paper-text-body border-paper-border hover:bg-paper-border"}`}>持っている本</button>
              <button type="button" onClick={() => setStatus("欲しい")} className={`py-2 text-xs font-bold border transition cursor-pointer ${status === "欲しい" ? "bg-paper-caramel text-white border-paper-caramel" : "bg-paper-sub text-paper-text-body border-paper-border hover:bg-paper-border"}`}>欲しい本</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1 flex items-center gap-1"><Calendar className="w-3 h-3 text-paper-caramel" /> 登録日</label>
                <input type="date" value={registeredDate} onChange={(e) => setRegisteredDate(e.target.value)} className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main font-mono" />
              </div>
              <div className="flex items-center gap-1 pb-1">
                {[1, 2, 3].map((star) => (
                  <button key={star} type="button" onClick={() => setRating(rating === star ? 0 : star)} className="p-1 cursor-pointer">
                    <Star className={`w-6 h-6 ${rating >= star ? "fill-amber-400 text-amber-500" : "text-gray-400/70"}`} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-paper-text-sub mb-1">ISBN</label>
              <div className="flex gap-2 items-center">
                <input type="text" value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="978から始まる13桁" className="flex-1 bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main font-mono" />
                <button type="button" onClick={startScanner} className="cursor-pointer text-xs text-paper-text-main bg-paper-sub hover:bg-paper-border px-4 py-2 border border-paper-border flex items-center gap-1.5 font-bold whitespace-nowrap shadow-2xs">
                  <Camera className="w-3.5 h-3.5 text-paper-caramel" /><span>読み取り</span>
                </button>
              </div>
              <div className="mt-2">
                <button type="button" onClick={() => handleAutoFetchAndCheck()} disabled={fetching} className="w-full py-2.5 bg-paper-sub hover:bg-paper-border text-paper-text-main text-xs font-bold transition flex items-center justify-center gap-1.5 border border-paper-border cursor-pointer shadow-2xs">
                  {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 text-paper-caramel" />}
                  <span>{fetching ? "取得中..." : "自動取得"}</span>
                </button>
              </div>

              {checkMessage && (
                <div className={`mt-2 p-2.5 text-xs border flex items-center justify-between ${existingBook ? "bg-[#FFF3CD] border-[#FFEEBA] text-[#856404]" : matchedDraft ? "bg-[#E2E3E5] border-[#D6D8DB] text-[#383D41]" : "bg-[#D4EDDA] border-[#C3E6CB] text-[#155724]"}`}>
                  <span>{checkMessage}</span>
                  {existingBook && (
                    <button type="button" onClick={handleDeleteExistingBook} disabled={loading} className="px-2.5 py-1 bg-red-600 text-white font-bold text-xs rounded hover:bg-red-700 transition cursor-pointer flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /><span>既存データを削除</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-paper-text-sub mb-1">タイトル <span className="text-red-500">*</span></label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main" />
            </div>

            <div>
              <label className="block text-xs font-bold text-paper-text-sub mb-1">フリガナ (並び替え用)</label>
              <input type="text" value={sortTitle} onChange={(e) => setSortTitle(e.target.value)} className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main" />
            </div>

            <div>
              <label className="block text-xs font-bold text-paper-text-sub mb-1">サブタイトル</label>
              <input type="text" value={subTitle} onChange={(e) => setSubTitle(e.target.value)} className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">巻数</label>
                <input type="text" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="例: 1" className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">シリーズ名</label>
                <input type="text" value={series} onChange={(e) => setSeries(e.target.value)} className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">著者</label>
                <input type="text" value={authors} onChange={(e) => setAuthors(e.target.value)} className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main" />
              </div>
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">発行所</label>
                <input type="text" value={publisher} onChange={(e) => setPublisher(e.target.value)} className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">発行月</label>
                <input type="month" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1 flex items-center gap-1"><MapPin className="w-3 h-3 text-paper-caramel" /> 保管場所</label>
                <input type="text" list="location-list" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="選択または自由入力" className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main" />
                <datalist id="location-list">{existingLocations.map((loc) => (<option key={loc} value={loc} />))}</datalist>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-paper-border">
              <label className="block text-xs font-bold text-paper-text-sub">本の画像</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={startCustomCamera} className="px-3 py-2 bg-paper-sub hover:bg-paper-border border border-paper-border text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Camera className="w-4 h-4 text-paper-caramel" /><span>カメラで撮影</span></button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-2 bg-paper-sub hover:bg-paper-border border border-paper-border text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Upload className="w-4 h-4 text-paper-caramel" /><span>ファイル選択</span></button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              </div>

              {imageUrl && (
                <div className="mt-2 flex items-center gap-3 p-2 bg-paper-inner border border-paper-border">
                  <div className="w-14 h-20 bg-black overflow-hidden flex items-center justify-center shrink-0 border border-paper-border">
                    <img src={imageUrl} alt="サムネイル" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setIsZoomOpen(true)} className="px-2.5 py-1 bg-paper-sub border border-paper-border text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-paper-border"><ZoomIn className="w-3.5 h-3.5 text-paper-caramel" /><span>拡大</span></button>
                    <button type="button" onClick={() => setIsCropOpen(true)} className="px-2.5 py-1 bg-paper-sub border border-paper-border text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-paper-border"><Crop className="w-3.5 h-3.5 text-paper-caramel" /><span>位置調整</span></button>
                    <button type="button" onClick={() => setImageUrl("")} className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-600 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-red-100"><Trash2 className="w-3.5 h-3.5" /><span>削除</span></button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-paper-text-sub mb-1">メモ</label>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} className="w-full bg-paper-inner border border-paper-border p-2.5 text-xs text-paper-text-main" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-paper-caramel text-white font-bold text-xs tracking-wider shadow-md hover:opacity-95 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{existingBook ? "変更を保存する" : "本棚に登録する"}</span>
            </button>
            {!existingBook && (
              <button type="button" onClick={handleSaveToDrafts} className="px-4 py-3 bg-paper-sub border border-paper-border text-paper-text-main font-bold text-xs hover:bg-paper-border transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
                <ListPlus className="w-4 h-4 text-paper-caramel" /><span>待機リストへ保存</span>
              </button>
            )}
          </div>
        </form>
      </main>
      <FooterNav />
    </div>
  );
}