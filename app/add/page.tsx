"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, BookOpen, Check, Calendar, Layers, Camera, X, Search, Loader2, AlertCircle, Trash2, Star, MapPin, ZoomIn, Crop, Save } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.0.93";

type ExistingBookInfo = {
  id: string;
  isbn: string | null;
  title: string;
  sub_title?: string | null;
  sort_title: string | null;
  created_at: string;
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

export default function AddBookPage() {
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
      }
    };
    checkUser();
  }, []);
  
  const router = useRouter();

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
  const [registeredDate, setRegisteredDate] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [location, setLocation] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");

  const [existingLocations, setExistingLocations] = useState<string[]>([]);

  // 画像拡大・トリミング用
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const rawImageRef = useRef<HTMLImageElement | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ドラッグ操作用の座標保持用Ref
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    setRegisteredDate(todayStr);

    const fetchLocations = async () => {
      const { data } = await supabase.from("books").select("location");
      if (data) {
        const uniqueLocs = Array.from(new Set(data.map(b => b.location).filter(Boolean))) as string[];
        setExistingLocations(uniqueLocs);
      }
    };
    fetchLocations();
  }, []);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [existingBook, setExistingBook] = useState<ExistingBookInfo | null>(null);
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

  const clearForm = () => {
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
    setRating(0);
    setLocation("");
    setImageUrl("");
    setExistingBook(null);
    setCheckMessage(null);
    setSuccessMessage("");
    setErrorMessage("");
  };

  const handleAutoFetchAndCheck = async (targetIsbn?: string) => {
    const cleanIsbn = (targetIsbn !== undefined ? targetIsbn : isbn).trim();
    if (!cleanIsbn) {
      setCheckMessage("ISBNを入力してください。");
      setExistingBook(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setFetching(true);
    setErrorMessage("");
    setCheckMessage(null);

    try {
      const { data: foundData } = await supabase
        .from("books")
        .select("id, isbn, title, sub_title, sort_title, created_at, status, memo, volume, series, authors, publisher, release_date, rating, location, image_url")
        .eq("isbn", cleanIsbn)
        .single();

      if (foundData) {
        setExistingBook(foundData);
        setTitle(foundData.title || "");
        setSubTitle(foundData.sub_title || "");
        setSortTitle(foundData.sort_title || foundData.title || "");
        setStatus(foundData.status || "持っている");
        setMemo(foundData.memo || "");
        setRating(foundData.rating || 0);
        setLocation(foundData.location || "");
        if (foundData.volume) setVolume(foundData.volume);
        if (foundData.series) setSeries(foundData.series);
        if (foundData.authors) setAuthors(foundData.authors);
        if (foundData.publisher) setPublisher(foundData.publisher);
        if (foundData.release_date) setReleaseDate(foundData.release_date);
        if (foundData.image_url) setImageUrl(foundData.image_url);

        setCheckMessage("⚠️ すでに登録されています。");
        setFetching(false);
        return;
      }

      const res = await fetch(`/api/book-fetch?isbn=${cleanIsbn}`, {
        signal: controller.signal,
      });
      const data = await res.json();

      if (data && data.success) {
        if (data.title) setTitle(data.title);
        if (data.subTitle) setSubTitle(data.subTitle);
        if (data.sortTitle) setSortTitle(data.sortTitle);
        if (data.volume) setVolume(data.volume);
        if (data.series) setSeries(data.series);
        if (data.authors) setAuthors(data.authors);
        if (data.publisher) setPublisher(data.publisher);
        if (data.releaseDate) setReleaseDate(data.releaseDate);
        
        setExistingBook(null);
        setCheckMessage("✅ 国立国会図書館から情報を取得しました（未登録）");
      } else {
        setExistingBook(null);
        setCheckMessage("✅ 未登録です（該当データなしのため手動入力してください）");
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setErrorMessage("情報の取得中にエラーが発生しました。");
    } finally {
      if (abortControllerRef.current === controller) {
        setFetching(false);
      }
    }
  };

  const handleDeleteExistingBook = async () => {
    if (!existingBook) return;
    setLoading(true);
    const { error } = await supabase.from("books").delete().eq("id", existingBook.id);
    setLoading(false);

    if (error) {
      setErrorMessage(`削除に失敗しました: ${error.message}`);
    } else {
      setSuccessMessage("データベースから本のデータを削除しました。");
      clearForm();
    }
  };

  const startScanner = async () => {
    setIsScanning(true);
    setErrorMessage("");
    setCheckMessage(null);

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
        setErrorMessage("カメラを起動できませんでした。");
        setIsCustomCameraOpen(false);
      }
    }, 100);
  };

  const stopCustomCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCustomCameraOpen(false);
    setIsPreviewMode(false);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setImageUrl(dataUrl);
    setIsPreviewMode(true);

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const retakePhoto = () => {
    setIsPreviewMode(false);
    startCustomCamera();
  };

  // トリミング適用処理
  const applyCrop = () => {
    const img = rawImageRef.current;
    const canvas = cropCanvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 566; // 縦長比率
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 + cropOffsetX, canvas.height / 2 + cropOffsetY);
    ctx.scale(cropZoom, cropZoom);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setImageUrl(croppedDataUrl);
    setIsCropOpen(false);
  };

  useEffect(() => {
    return () => {
      stopScanner();
      stopCustomCamera();
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

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

    if (existingBook) {
      const { error } = await supabase
        .from("books")
        .update({
          isbn: cleanIsbn || null,
          title: title.trim(),
          sub_title: subTitle.trim() || null,
          sort_title: sortTitle.trim() || title.trim(),
          volume: volume.trim() || null,
          series: series.trim() || null,
          authors: authors.trim() || null,
          publisher: publisher.trim() || null,
          release_date: releaseDate.trim() || null,
          status: status,
          memo: memo.trim() || null,
          rating: rating,
          location: location.trim() || null,
          image_url: imageUrl || null,
        })
        .eq("id", existingBook.id);

      if (error) setErrorMessage(`更新に失敗しました: ${error.message}`);
      else setSuccessMessage("既存のデータを更新しました！（登録日は維持されます）");
    } else {
      const { error } = await supabase.from("books").insert([
        {
          isbn: cleanIsbn || null,
          title: title.trim(),
          sub_title: subTitle.trim() || null,
          sort_title: sortTitle.trim() || title.trim(),
          volume: volume.trim() || null,
          series: series.trim() || null,
          authors: authors.trim() || null,
          publisher: publisher.trim() || null,
          release_date: releaseDate.trim() || null,
          status: status,
          created_at: registeredDate ? new Date(registeredDate).toISOString() : new Date().toISOString(),
          memo: memo.trim() || null,
          rating: rating,
          location: location.trim() || null,
          image_url: imageUrl || null,
        },
      ]);

      if (error) {
        if (error.code === "23505") setErrorMessage("このISBNの本はすでに登録されています。");
        else setErrorMessage(`登録に失敗しました: ${error.message}`);
      } else {
        setSuccessMessage("本を登録しました！");
      }
    }
    setLoading(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-44 relative">
      <header className="sticky top-0 z-10 bg-paper-card/95 backdrop-blur-md border-b border-paper-border px-4 py-3 md:px-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold text-paper-text-main bg-paper-sub px-3 py-1.5 border border-paper-border hover:bg-paper-border transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>本棚に戻る</span>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-wider text-paper-text-main">本を登録する</h1>
            <span className="text-[10px] bg-paper-sub text-paper-text-sub px-1.5 py-0.5 font-mono border border-paper-border">
              {APP_VERSION}
            </span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      {/* バーコードスキャン用モーダル */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-paper-card border border-paper-border p-4 relative shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-paper-text-main">バーコードを枠内に合わせてください</h2>
              <button type="button" onClick={stopScanner} className="p-1 text-paper-text-sub bg-paper-sub border border-paper-border cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div id="reader" className="w-full overflow-hidden bg-black"></div>
          </div>
        </div>
      )}

      {/* 🔴 縦長のカスタムカメラ撮影用モーダル */}
      {isCustomCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm bg-paper-card border border-paper-border p-4 rounded-lg relative space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-paper-text-main">
                {isPreviewMode ? "撮影プレビュー" : "カメラで撮影（縦長）"}
              </h2>
              <button type="button" onClick={stopCustomCamera} className="p-1 text-paper-text-sub bg-paper-sub rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 縦長比率 (3:4 または 9:16) */}
            <div className="relative w-full aspect-[3/4] bg-black rounded overflow-hidden border border-paper-border flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${isPreviewMode ? "hidden" : "block"}`}></video>
              <canvas ref={canvasRef} className={`w-full h-full object-cover ${isPreviewMode ? "block" : "hidden"}`}></canvas>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              {!isPreviewMode ? (
                <button type="button" onClick={takePhoto} className="px-6 py-2.5 bg-paper-caramel text-white font-bold text-xs rounded-full shadow-md hover:opacity-90 cursor-pointer flex items-center gap-1.5">
                  <Camera className="w-4 h-4" />
                  <span>シャッターを切る</span>
                </button>
              ) : (
                <>
                  <button type="button" onClick={retakePhoto} className="px-4 py-2 bg-paper-sub border border-paper-border text-paper-text-main font-bold text-xs rounded shadow-xs cursor-pointer">
                    撮り直す
                  </button>
                  <button type="button" onClick={stopCustomCamera} className="px-6 py-2 bg-emerald-600 text-white font-bold text-xs rounded shadow-xs cursor-pointer">
                    この写真を使う
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 写真拡大プレビューモーダル */}
      {isZoomOpen && imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4" onClick={() => setIsZoomOpen(false)}>
          <div className="relative max-w-lg w-full bg-paper-card p-2 rounded-lg border border-paper-border space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-2">
              <h3 className="text-xs font-bold text-paper-text-main">画像プレビュー</h3>
              <button type="button" onClick={() => setIsZoomOpen(false)} className="p-1 text-paper-text-sub hover:text-paper-text-main cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="w-full max-h-[70vh] overflow-hidden flex items-center justify-center bg-black">
              <img src={imageUrl} alt="拡大プレビュー" className="max-w-full max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* 🔴 縦長＆自由に動かせるトリミングモーダル */}
      {isCropOpen && imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm bg-paper-card border border-paper-border p-4 rounded-lg relative space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-paper-text-main">画像を動かして位置調整（トリミング）</h3>
              <button type="button" onClick={() => setIsCropOpen(false)} className="p-1 text-paper-text-sub hover:text-paper-text-main cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <img ref={rawImageRef} src={imageUrl} alt="raw" className="hidden" onLoad={() => { setCropZoom(1); setCropOffsetX(0); setCropOffsetY(0); }} />

            {/* 縦長のトリミング操作エリア（ドラッグ＆スワイプで位置移動可能） */}
            <div 
              className="relative w-full h-80 bg-black rounded overflow-hidden border border-paper-border flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                dragRef.current = {
                  isDragging: true,
                  startX: e.clientX,
                  startY: e.clientY,
                  initialX: cropOffsetX,
                  initialY: cropOffsetY,
                };
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!dragRef.current.isDragging) return;
                const dx = e.clientX - dragRef.current.startX;
                const dy = e.clientY - dragRef.current.startY;
                setCropOffsetX(dragRef.current.initialX + dx);
                setCropOffsetY(dragRef.current.initialY + dy);
              }}
              onPointerUp={(e) => {
                dragRef.current.isDragging = false;
                try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch(err) {}
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
                <img
                  src={imageUrl}
                  alt="editing"
                  style={{
                    transform: `translate(${cropOffsetX}px, ${cropOffsetY}px) scale(${cropZoom})`,
                    transition: dragRef.current.isDragging ? "none" : "transform 0.05s ease-out",
                    maxHeight: "100%",
                    maxWidth: "100%",
                    objectFit: "contain"
                  }}
                />
              </div>
              {/* 縦長の切り取り枠ガイド */}
              <div className="absolute inset-x-6 inset-y-4 border-2 border-dashed border-white/80 pointer-events-none rounded"></div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-paper-text-sub">拡大・縮小</span>
                <span className="font-mono">{cropZoom.toFixed(2)}x</span>
              </div>
              <input type="range" min="0.5" max="3" step="0.05" value={cropZoom} onChange={(e) => setCropZoom(parseFloat(e.target.value))} className="w-full accent-paper-caramel" />
              <p className="text-[10px] text-paper-text-sub text-center">画像を直接指やマウスでドラッグして位置を調整できます</p>
            </div>

            <canvas ref={cropCanvasRef} className="hidden"></canvas>

            <div className="flex justify-end gap-2 pt-2 border-t border-paper-border">
              <button type="button" onClick={() => setIsCropOpen(false)} className="px-4 py-1.5 bg-paper-sub border border-paper-border font-bold text-xs rounded cursor-pointer">キャンセル</button>
              <button type="button" onClick={applyCrop} className="px-6 py-1.5 bg-paper-caramel text-white font-bold text-xs rounded shadow-xs cursor-pointer">この大きさに切り抜く</button>
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
              <button
                type="button"
                onClick={() => setStatus("持っている")}
                className={`py-2 text-xs font-bold border transition cursor-pointer ${
                  status === "持っている" ? "bg-paper-caramel text-white border-paper-caramel" : "bg-paper-sub text-paper-text-body border-paper-border hover:bg-paper-border"
                }`}
              >
                持っている本
              </button>
              <button
                type="button"
                onClick={() => setStatus("欲しい")}
                className={`py-2 text-xs font-bold border transition cursor-pointer ${
                  status === "欲しい" ? "bg-paper-caramel text-white border-paper-caramel" : "bg-paper-sub text-paper-text-body border-paper-border hover:bg-paper-border"
                }`}
              >
                欲しい本
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-paper-caramel" /> 登録日
                </label>
                <input
                  type="date"
                  value={registeredDate}
                  onChange={(e) => setRegisteredDate(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1 flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-400" /> お気に入り度
                </label>
                <div className="flex items-center gap-1 py-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(rating === star ? 0 : star)}
                      className="p-1 cursor-pointer"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          rating >= star ? "fill-amber-400 text-amber-500" : "text-gray-400/70"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ISBN ＆ 読み取りボタン、自動取得ボタン */}
            <div>
              <label className="block text-xs font-bold text-paper-text-sub mb-1">ISBN</label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="978から始まる13桁"
                  className="flex-1 bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main font-mono"
                />
                <button
                  type="button"
                  onClick={startScanner}
                  className="cursor-pointer text-xs text-paper-text-main bg-paper-sub hover:bg-paper-border px-4 py-2 border border-paper-border flex items-center gap-1.5 font-bold whitespace-nowrap shadow-2xs"
                >
                  <Camera className="w-3.5 h-3.5 text-paper-caramel" />
                  <span>読み取り</span>
                </button>
              </div>

              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => handleAutoFetchAndCheck()}
                  disabled={fetching}
                  className="w-full py-2.5 bg-paper-sub hover:bg-paper-border text-paper-text-main text-xs font-bold transition flex items-center justify-center gap-1.5 border border-paper-border cursor-pointer shadow-2xs"
                >
                  {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 text-paper-caramel" />}
                  <span>{fetching ? "取得中..." : "自動取得"}</span>
                </button>
              </div>

              {checkMessage && (
                <div className={`mt-2 p-2.5 text-xs border flex items-center justify-between ${
                  existingBook ? "bg-[#FFF3CD] border-[#FFEEBA] text-[#856404]" : "bg-[#D4EDDA] border-[#C3E6CB] text-[#155724]"
                }`}>
                  <div>
                    <span>{checkMessage}</span>
                    {existingBook && (
                      <p className="mt-0.5 text-[11px]">
                        （登録日: {new Date(existingBook.created_at).toLocaleDateString()} / ステータス: {existingBook.status}）
                      </p>
                    )}
                  </div>
                  {existingBook && (
                    <button
                      type="button"
                      onClick={handleDeleteExistingBook}
                      className="text-[11px] bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>データを削除する</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 📸 画像 ＆ 撮影・トリミングボタン */}
            <div className="pt-2 border-t border-paper-border">
              <label className="block text-xs font-bold text-paper-text-sub mb-1">画像</label>
              <div className="flex items-start gap-4">
                {imageUrl ? (
                  <div className="relative w-24 h-32 border border-paper-border overflow-hidden bg-white shadow-xs group cursor-pointer" onClick={() => setIsZoomOpen(true)}>
                    <img src={imageUrl} alt="撮影プレビュー" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                      <ZoomIn className="w-5 h-5" />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setImageUrl(""); }}
                      className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-full cursor-pointer hover:bg-black"
                      title="写真を削除"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-32 border border-dashed border-paper-border flex items-center justify-center text-paper-text-sub text-[10px] bg-paper-inner">
                    写真なし
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={startCustomCamera}
                    className="px-4 py-2 bg-paper-caramel text-white font-bold text-xs shadow-xs hover:opacity-90 cursor-pointer flex items-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    <span>撮影する</span>
                  </button>

                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setIsCropOpen(true)}
                      className="px-4 py-2 bg-paper-sub border border-paper-border text-paper-text-main font-bold text-xs shadow-xs hover:bg-paper-border cursor-pointer flex items-center gap-1.5"
                    >
                      <Crop className="w-4 h-4 text-paper-caramel" />
                      <span>トリミング・調整</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* タイトル ＆ フリガナ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-paper-border">
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">
                  タイトル <span className="text-paper-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!sortTitle) setSortTitle(e.target.value);
                  }}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">フリガナ（並び替え用）</label>
                <input
                  type="text"
                  value={sortTitle}
                  onChange={(e) => setSortTitle(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main"
                />
              </div>
            </div>

            {/* サブタイトル ＆ 巻数 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-paper-text-sub mb-1">サブタイトル</label>
                <input
                  type="text"
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">巻数</label>
                <input
                  type="text"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main font-mono"
                />
              </div>
            </div>

            {/* 著者名 ＆ 発行所 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">著者名</label>
                <input
                  type="text"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1">発行所</label>
                <input
                  type="text"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main"
                />
              </div>
            </div>

            {/* 発行月 ＆ シリーズ名 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-paper-caramel" /> 発行月
                </label>
                <input
                  type="month"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-paper-text-sub mb-1 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-paper-caramel" /> シリーズ名
                </label>
                <input
                  type="text"
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-xs text-paper-text-main"
                />
              </div>
            </div>

            {/* 置き場所 */}
            <div>
              <label className="block text-xs font-bold text-paper-text-sub mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-paper-caramel" /> 置き場所
              </label>
              <input
                type="text"
                list="location-list"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="選択肢から選ぶか、直接入力してください"
                className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main"
              />
              <datalist id="location-list">
                {existingLocations.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            </div>

            {/* メモ */}
            <div>
              <label className="block text-xs font-bold text-paper-text-sub mb-1">メモ</label>
              <textarea
                rows={2}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main"
              />
            </div>
          </div>

          {/* 🟢 下部に常時固定する登録・更新ボタン */}
          <div className="fixed bottom-16 left-0 right-0 z-20 bg-paper-card/95 backdrop-blur-md border-t border-paper-border p-3 shadow-lg">
            <div className="max-w-3xl mx-auto flex justify-end px-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-auto px-8 py-3 bg-paper-caramel text-white font-bold cursor-pointer shadow-md hover:opacity-95 flex items-center justify-center gap-2 text-sm disabled:opacity-50 rounded"
              >
                <Save className="w-4 h-4" />
                <span>{existingBook ? "既存データを更新する" : "本を登録"}</span>
              </button>
            </div>
          </div>

        </form>
      </main>

      <FooterNav />
    </div>
  );
}