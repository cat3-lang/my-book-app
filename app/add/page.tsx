"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Check, Camera, X, ScanLine, Save } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.0.86";

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
  const [releaseDate, setReleaseDate] = useState("");
  const [status, setStatus] = useState<"持っている" | "欲しい">("持っている");
  const [memo, setMemo] = useState("");
  const [registeredDate, setRegisteredDate] = useState("");
  const [imageUrl, setImageUrl] = useState("");

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

  // バーコードスキャン用
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // カスタムカメラ撮影用
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

    clearForm();
    setIsbn(cleanIsbn);
    setFetching(true);
    setErrorMessage("");
    setCheckMessage(null);

    try {
      // 1. 既存チェック
      const { data: foundData } = await supabase
        .from("books")
        .select("id, isbn, title, sub_title, sort_title, created_at, status, memo, volume, series, authors, publisher, release_date")
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
        if (foundData.release_date) setReleaseDate(foundData.release_date);

        setCheckMessage("⚠️ すでに登録されている本です（データを反映しました）");
      } else {
        setExistingBook(null);
        setCheckMessage("✅ 未登録です（新規登録します）");
      }

      // 2. 外部APIから書籍情報を取得
      const res = await fetch(`/api/book-fetch?isbn=${cleanIsbn}`);
      const data = await res.json();
      if (data && data.success) {
        if (!title) setTitle(data.title || "");
        if (!sortTitle) setSortTitle(data.title || "");
        if (!authors) setAuthors(data.authors || "");
        if (!publisher) setPublisher(data.publisher || "");
        if (data.releaseDate && !releaseDate) setReleaseDate(data.releaseDate);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("書籍情報の取得に失敗しました。");
    } finally {
      setFetching(false);
    }
  };

  // バーコードスキャン開始
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
          {
            fps: 10,
            qrbox: { width: 250, height: 100 },
          },
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

  // カスタムカメラ起動
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

  useEffect(() => {
    return () => {
      stopScanner();
      stopCustomCamera();
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
      const { error } = await supabase
        .from("books")
        .update({
          title: title.trim(),
          sort_title: sortTitle.trim() || title.trim(),
          volume: volume.trim() || null,
          series: series.trim() || null,
          authors: authors.trim() || null,
          publisher: publisher.trim() || null,
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
        setSuccessMessage("既存のデータを更新しました！");
        clearForm();
        setTimeout(() => {
          router.push(status === "持っている" ? "/" : "/want");
        }, 800);
      }
    } else {
      const { error } = await supabase.from("books").insert([
        {
          title: title.trim(),
          sort_title: sortTitle.trim() || title.trim(),
          volume: volume.trim() || null,
          series: series.trim() || null,
          authors: authors.trim() || null,
          publisher: publisher.trim() || null,
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
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-36 relative">
      
      {/* カメラ読み取りモーダル */}
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

      {/* カスタムカメラ撮影モーダル */}
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
          
          {/* 🟢 登録ボタンを上部に配置 */}
          <div className="bg-paper-card border border-paper-border p-3 rounded-xs sticky top-14 z-10 shadow-sm flex items-center justify-between">
            <span className="font-bold text-paper-text-sub">入力が完了したら</span>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-paper-caramel text-white font-bold cursor-pointer shadow-xs hover:opacity-95 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{existingBook ? "既存データを更新する" : "本棚に登録する"}</span>
            </button>
          </div>

          {/* ステータス選択 */}
          <div className="bg-paper-card border border-paper-border p-3 space-y-2">
            <label className="block font-bold text-paper-text-sub">ステータス</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                <input
                  type="radio"
                  name="status"
                  value="持っている"
                  checked={status === "持っている"}
                  onChange={() => setStatus("持っている")}
                  className="accent-paper-caramel"
                />
                <span>持っている本</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                <input
                  type="radio"
                  name="status"
                  value="欲しい"
                  checked={status === "欲しい"}
                  onChange={() => setStatus("欲しい")}
                  className="accent-paper-caramel"
                />
                <span>欲しい本</span>
              </label>
            </div>
          </div>

          {/* ISBN & スキャン */}
          <div className="bg-paper-card border border-paper-border p-3 space-y-2">
            <label className="block font-bold text-paper-text-sub">ISBN / バーコード</label>
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
                onClick={() => handleAutoFetchAndCheck()}
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

            {checkMessage && (
              <p className={`text-[11px] font-bold ${existingBook ? "text-amber-600" : "text-emerald-600"}`}>
                {checkMessage}
              </p>
            )}
          </div>

          {/* 📸 カメラで撮影ボタン */}
          <div className="bg-paper-card border border-paper-border p-3 space-y-2">
            <label className="block font-bold text-paper-text-sub">表紙写真（カスタムカメラ）</label>
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

            {imageUrl && (
              <div className="relative w-28 h-28 border border-paper-border overflow-hidden bg-white mt-2 shadow-xs">
                <img src={imageUrl} alt="撮影プレビュー" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-full cursor-pointer hover:bg-black"
                  title="写真を削除"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 各種入力欄 */}
          <div className="bg-paper-card border border-paper-border p-3 space-y-3">
            <div>
              <label className="block font-bold text-paper-text-sub mb-1">タイトル <span className="text-red-500">*</span></label>
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
              <label className="block font-bold text-paper-text-sub mb-1">メモ</label>
              <textarea
                rows={2}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full bg-paper-inner border border-paper-border p-2 text-paper-text-main"
              />
            </div>
          </div>
        </form>
      </main>

      <FooterNav />
    </div>
  );
}