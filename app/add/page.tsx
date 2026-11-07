"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Check, Camera, X, ScanLine, Save, ZoomIn, RefreshCw, Crop, Trash2 } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.0.91";

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
  location?: string | null;
};

export default function AddBookPage() {
  const router = useRouter();

  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [subTitle, setSubTitle] = useState("");
  const [sortTitle, setSortTitle] = useState("");
  const [volume, setVolume] = useState("");
  const [series, setSeries] = useState("");
  const [authors, setAuthors] = useState("");
  const [publisher, setPublisher] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<"持っている" | "欲しい">("持っている");
  const [memo, setMemo] = useState("");
  const [registeredDate, setRegisteredDate] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // 画像拡大プレビュー用
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  // トリミング編集用モーダル
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const rawImageRef = useRef<HTMLImageElement | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    setRegisteredDate(todayStr);
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
    setLocation("");
    setMemo("");
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
        .select("id, isbn, title, sub_title, sort_title, created_at, status, memo, volume, series, authors, publisher, location")
        .eq("isbn", cleanIsbn)
        .single();

      if (foundData) {
        setExistingBook(foundData);
        setTitle(foundData.title || "");
        setSubTitle(foundData.sub_title || "");
        setSortTitle(foundData.sort_title || foundData.title || "");
        setStatus(foundData.status || "持っている");
        setMemo(foundData.memo || "");
        if (foundData.volume) setVolume(foundData.volume);
        if (foundData.series) setSeries(foundData.series);
        if (foundData.authors) setAuthors(foundData.authors);
        if (foundData.publisher) setPublisher(foundData.publisher);
        if (foundData.location) setLocation(foundData.location);

        setCheckMessage("⚠️ すでに登録されている本です");
      } else {
        setExistingBook(null);
        setCheckMessage("✅ 未登録です");
      }

      const res = await fetch(`/api/book-fetch?isbn=${cleanIsbn}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      if (data && data.success) {
        setTitle(data.title || title);
        setSortTitle(data.title || sortTitle);
        setAuthors(data.authors || authors);
        setPublisher(data.publisher || publisher);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error(err);
      setErrorMessage("書籍情報の取得に失敗しました。");
    } finally {
      if (abortControllerRef.current === controller) {
        setFetching(false);
      }
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
          async (decodedText) => {
            if (decodedText.startsWith("978") || decodedText.startsWith("979")) {
              await stopScanner();
              setIsbn(decodedText);
              handleAutoFetchAndCheck(decodedText);
            }
          },
          () => {}
        );
      } catch (err) {
        console.error("Camera start error:", err);
        setErrorMessage("カメラを起動できませんでした。権限を確認してください。");
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

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
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

  const applyCrop = () => {
    const img = rawImageRef.current;
    const canvas = cropCanvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 533;
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

  // 既存データの削除機能
  const handleDeleteExisting = async () => {
    if (!existingBook) return;
    if (!window.confirm(`「${existingBook.title}」を削除しますか？`)) return;

    const { error } = await supabase.from("books").delete().eq("id", existingBook.id);
    if (error) {
      setErrorMessage(`削除に失敗しました: ${error.message}`);
    } else {
      setSuccessMessage("既存のデータを削除しました。");
      setExistingBook(null);
      setCheckMessage("✅ 未登録状態になりました");
      setTimeout(() => setSuccessMessage(""), 2000);
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
      stopCustomCamera();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
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
    const cleanIsbn = isbn.trim();

    if (existingBook) {
      // ⚠️ 更新時は created_at を含めないため、元の登録日のまま維持されます
      const { error } = await supabase
        .from("books")
        .update({
          title: title.trim(),
          sub_title: subTitle.trim() || null,
          sort_title: sortTitle.trim() || title.trim(),
          volume: volume.trim() || null,
          series: series.trim() || null,
          authors: authors.trim() || null,
          publisher: publisher.trim() || null,
          location: location.trim() || null,
          status: status,
          memo: memo.trim() || null,
          image_url: imageUrl || null,
        })
        .eq("id", existingBook.id);

      if (error) {
        console.error(error);
        setErrorMessage(`更新に失敗しました: ${error.message}`);
        setLoading(false);
      } else {
        setSuccessMessage("既存のデータを更新しました！（登録日は維持されます）");
        clearForm();
        setTimeout(() => {
          router.push(status === "持っている" ? "/" : "/want");
        }, 800);
      }
    } else {
      const { error } = await supabase.from("books").insert([
        {
          title: title.trim(),
          sub_title: subTitle.trim() || null,
          sort_title: sortTitle.trim() || title.trim(),
          volume: volume.trim() || null,
          series: series.trim() || null,
          authors: authors.trim() || null,
          publisher: publisher.trim() || null,
          location: location.trim() || null,
          isbn: cleanIsbn || null,
          status: status,
          memo: memo.trim() || null,
          image_url: imageUrl || null,
          created_at: registeredDate ? new Date(registeredDate).toISOString() : new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error(error);
        if (error.code === "23505") {
          setErrorMessage("このISBNの本はすでに登録されています。");
        } else {
          setErrorMessage(`登録に失敗しました: ${error.message}`);
        }
        setLoading(false);
      } else {
        setSuccessMessage("登録が完了しました！");
        clearForm();
        setTimeout(() => {
          router.push(status === "持っている" ? "/" : "/want");
        }, 800);
      }
    }
  };

  return (
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-44 relative">
      
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
            <div id="reader" className="w-full overflow-hidden rounded bg-black"></div>
            <p className="text-[11px] text-paper-text-sub text-center">
              本の裏表紙にある「978」から始まるバーコードをスキャンします
            </p>
          </div>
        </div>
      )}

      {/* カスタムカメラ撮影用モーダル */}
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
                    className="px-4 py-2 bg-paper-sub border border-paper-border text-paper-text-main font-bold text-xs rounded shadow-xs hover:bg-paper-border cursor-pointer"
                  >
                    撮り直す
                  </button>
                  <button
                    type="button"
                    onClick={stopCustomCamera}
                    className="px-6 py-2 bg-emerald-600 text-white font-bold text-xs rounded shadow-xs hover:opacity-90 cursor-pointer"
                  >
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
              <button type="button" onClick={() => setIsZoomOpen(false)} className="p-1 text-paper-text-sub hover:text-paper-text-main">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="w-full max-h-[70vh] overflow-hidden flex items-center justify-center bg-black">
              <img src={imageUrl} alt="拡大プレビュー" className="max-w-full max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* トリミング・拡大縮小編集モーダル */}
      {isCropOpen && imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-paper-card border border-paper-border p-4 rounded-lg relative space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-paper-text-main">画像を自由に調整（トリミング・拡大縮小）</h3>
              <button type="button" onClick={() => setIsCropOpen(false)} className="p-1 text-paper-text-sub hover:text-paper-text-main">
                <X className="w-5 h-5" />
              </button>
            </div>

            <img
              ref={rawImageRef}
              src={imageUrl}
              alt="raw"
              className="hidden"
              onLoad={() => {
                setCropZoom(1);
                setCropOffsetX(0);
                setCropOffsetY(0);
              }}
            />

            <div className="relative w-full h-64 bg-black rounded overflow-hidden border border-paper-border flex items-center justify-center">
              <div 
                className="absolute inset-0 flex items-center justify-center overflow-hidden cursor-move"
                onPointerDown={(e) => {
                  const startX = e.clientX - cropOffsetX;
                  const startY = e.clientY - cropOffsetY;
                  const onPointerMove = (moveEvent: PointerEvent) => {
                    setCropOffsetX(moveEvent.clientX - startX);
                    setCropOffsetY(moveEvent.clientY - startY);
                  };
                  const onPointerUp = () => {
                    window.removeEventListener("pointermove", onPointerMove);
                    window.removeEventListener("pointerup", onPointerUp);
                  };
                  window.addEventListener("pointermove", onPointerMove);
                  window.addEventListener("pointerup", onPointerUp);
                }}
              >
                <img
                  src={imageUrl}
                  alt="editing"
                  style={{
                    transform: `translate(${cropOffsetX}px, ${cropOffsetY}px) scale(${cropZoom})`,
                    transition: "transform 0.05s ease-out",
                    maxHeight: "100%",
                    maxWidth: "100%",
                    objectFit: "contain"
                  }}
                />
              </div>
              <div className="absolute inset-8 border-2 border-dashed border-white/70 pointer-events-none rounded"></div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-paper-text-sub">拡大・縮小</span>
                <span className="font-mono">{cropZoom.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={cropZoom}
                onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                className="w-full accent-paper-caramel"
              />
              <p className="text-[10px] text-paper-text-sub text-center">画像ドラッグで位置調整もできます</p>
            </div>

            <canvas ref={cropCanvasRef} className="hidden"></canvas>

            <div className="flex justify-end gap-2 pt-2 border-t border-paper-border">
              <button
                type="button"
                onClick={() => setIsCropOpen(false)}
                className="px-4 py-1.5 bg-paper-sub border border-paper-border font-bold text-xs rounded"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={applyCrop}
                className="px-6 py-1.5 bg-paper-caramel text-white font-bold text-xs rounded shadow-xs"
              >
                この大きさに切り抜く
              </button>
            </div>
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
          <h1 className="text-sm font-bold text-paper-text-main">本を登録する</h1>
          <span className="text-[10px] font-mono text-paper-text-sub opacity-60">
            {APP_VERSION}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 md:px-6 py-4 space-y-4">
        {successMessage && (
          <div className="p-3 bg-emerald-950/20 border border-emerald-800 text-emerald-700 text-xs rounded flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-950/20 border border-red-800 text-red-700 text-xs rounded">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">

          {/* ステータス選択 */}
          <div className="bg-paper-card border border-paper-border p-3 space-y-2">
            <label className="block font-bold text-paper-text-sub">ステータス</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus("持っている")}
                className={`py-2 px-3 text-center font-bold border transition rounded cursor-pointer ${
                  status === "持っている"
                    ? "bg-paper-caramel text-white border-paper-caramel shadow-xs"
                    : "bg-paper-sub text-paper-text-sub border-paper-border hover:bg-paper-border"
                }`}
              >
                持っている本
              </button>
              <button
                type="button"
                onClick={() => setStatus("欲しい")}
                className={`py-2 px-3 text-center font-bold border transition rounded cursor-pointer ${
                  status === "欲しい"
                    ? "bg-paper-caramel text-white border-paper-caramel shadow-xs"
                    : "bg-paper-sub text-paper-text-sub border-paper-border hover:bg-paper-border"
                }`}
              >
                欲しい本
              </button>
            </div>
          </div>

          {/* ISBN & スキャン */}
          <div className="bg-paper-card border border-paper-border p-3 space-y-2">
            <label className="block font-bold text-paper-text-sub">ISBN</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="978から始まる13桁"
                className="flex-1 bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main font-mono"
              />
              <button
                type="button"
                onClick={startScanner}
                className="px-4 py-1.5 bg-paper-caramel text-white font-bold flex items-center gap-1 cursor-pointer hover:opacity-90 shrink-0"
              >
                <ScanLine className="w-4 h-4" />
                <span>スキャン</span>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleAutoFetchAndCheck()}
                className="px-4 py-1.5 bg-paper-sub border border-paper-border font-bold text-paper-text-main hover:bg-paper-border cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${fetching ? "animate-spin text-paper-caramel" : ""}`} />
                <span>{fetching ? "再取得中..." : "自動取得"}</span>
              </button>

              {existingBook && (
                <button
                  type="button"
                  onClick={handleDeleteExisting}
                  className="px-3 py-1.5 bg-paper-danger text-white font-bold flex items-center gap-1 rounded hover:opacity-90 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>既存データを削除する</span>
                </button>
              )}
            </div>

            {checkMessage && (
              <p className={`text-[11px] font-bold ${existingBook ? "text-amber-600" : "text-emerald-600"}`}>
                {checkMessage}
              </p>
            )}
          </div>

          {/* 📸 画像 ＆ 右側に撮影ボタン */}
          <div className="bg-paper-card border border-paper-border p-3 space-y-2">
            <label className="block font-bold text-paper-text-sub">画像</label>
            <div className="flex items-start gap-4">
              {imageUrl ? (
                <div className="relative w-28 h-28 border border-paper-border overflow-hidden bg-white shadow-xs group cursor-pointer" onClick={() => setIsZoomOpen(true)}>
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
                <div className="w-28 h-28 border border-dashed border-paper-border flex items-center justify-center text-paper-text-sub text-[10px] bg-paper-inner">
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

          {/* 各種入力欄（タイトル、読み、サブタイトル、巻数、著者、発行所、シリーズ名、置き場所、メモ） */}
          <div className="bg-paper-card border border-paper-border p-3 space-y-3">
            <div>
              <label className="block font-bold text-paper-text-main mb-1">タイトル <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-paper-inner border border-paper-border px-3 py-2 text-sm text-paper-text-main"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-paper-text-sub mb-1">読み（フリガナ）</label>
                <input
                  type="text"
                  value={sortTitle}
                  onChange={(e) => setSortTitle(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main"
                />
              </div>
              <div>
                <label className="block font-bold text-paper-text-sub mb-1">サブタイトル</label>
                <input
                  type="text"
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-paper-text-sub mb-1">巻数</label>
                <input
                  type="text"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  placeholder="例: 1"
                  className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main"
                />
              </div>
              <div>
                <label className="block font-bold text-paper-text-sub mb-1">シリーズ名</label>
                <input
                  type="text"
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-paper-text-sub mb-1">著者</label>
                <input
                  type="text"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main"
                />
              </div>
              <div>
                <label className="block font-bold text-paper-text-sub mb-1">発行所</label>
                <input
                  type="text"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-paper-text-sub mb-1">置き場所</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: リビング本棚"
                className="w-full bg-paper-inner border border-paper-border px-3 py-1.5 text-paper-text-main"
              />
            </div>

            <div>
              <label className="block font-bold text-paper-text-sub mb-1">メモ</label>
              <textarea
                rows={2}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full bg-paper-inner border border-paper-border p-2 text-paper-text-main"
              />
            </div>
          </div>

          {/* 🟢 下部に常時固定する「本棚に登録する」ボタン */}
          <div className="fixed bottom-16 left-0 right-0 z-20 bg-paper-card/95 backdrop-blur-md border-t border-paper-border p-3 shadow-lg">
            <div className="max-w-3xl mx-auto flex justify-end px-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-auto px-8 py-3 bg-paper-caramel text-white font-bold cursor-pointer shadow-md hover:opacity-95 flex items-center justify-center gap-2 text-sm disabled:opacity-50 rounded"
              >
                <Save className="w-4 h-4" />
                <span>{existingBook ? "既存データを更新する" : "本棚に登録する"}</span>
              </button>
            </div>
          </div>

        </form>
      </main>

      <FooterNav />
    </div>
  );
}