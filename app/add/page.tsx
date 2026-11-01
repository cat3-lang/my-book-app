"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Search, BookOpen, Check, X, Calendar, Layers, Camera, Image as ImageIcon, Maximize2, Crop } from "lucide-react";

type ExistingBookInfo = {
  title: string;
  created_at: string;
  status: string;
  memo: string | null;
};

// 記号やスペースを除外して綺麗にカタカナ変換（フリガナ補助用）
function toKatakana(str: string) {
  const cleanStr = str.replace(/[Ａ-Ｚａ-ｚ０-９\s:：()（）「」『』ー-]/g, "");
  return cleanStr.replace(/[\u3041-\u3096]/g, function (match) {
    var chr = match.charCodeAt(0) + 0x60;
    return String.fromCharCode(chr);
  });
}

// ひらがなをカタカナに変換
function hiraganaToKatakana(str: string) {
  return str.replace(/[\u3041-\u3096]/g, function (match) {
    var chr = match.charCodeAt(0) + 0x60;
    return String.fromCharCode(chr);
  });
}

export default function AddBookPage() {
  const router = useRouter();

  // フォーム入力の状態
  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [sortTitle, setSortTitle] = useState("");
  const [series, setSeries] = useState("");
  const [authors, setAuthors] = useState("");
  const [publisher, setPublisher] = useState(""); // 発行社
  const [publishedDate, setPublishedDate] = useState("");
  const [imageLink, setImageLink] = useState("");
  const [status, setStatus] = useState<"持っている" | "欲しい">("持っている");
  
  const [registeredDate, setRegisteredDate] = useState("");

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    setRegisteredDate(todayStr);
  }, []);

  const [memo, setMemo] = useState("");

  const [loading, setLoading] = useState(false);
  const [fetchingApi, setFetchingApi] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [existingBook, setExistingBook] = useState<ExistingBookInfo | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  // トリミング・拡大調整用ステート
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageFitMode, setImageFitMode] = useState<"cover" | "contain">("cover"); // 切り抜き or 全体表示
  const [imageScale, setImageScale] = useState(1); // 拡大倍率
  const [imagePosX, setImagePosX] = useState(0);   // 横位置調整
  const [imagePosY, setImagePosY] = useState(0);   // 縦位置調整

  const handleTitleChange = (val: string) => {
    setTitle(val);
    setSortTitle(toKatakana(val));
  };

  // 国会図書館サーチを最優先としたハイブリッド検索
  const handleFetchByIsbn = async () => {
    const cleanIsbn = isbn.trim().replace(/-/g, "");
    if (!cleanIsbn) {
      setErrorMessage("ISBNを入力してください。");
      return;
    }

    setFetchingApi(true);
    setErrorMessage("");
    setExistingBook(null);

    try {
      // ── 1. 【第1優先】国会図書館サーチ (NDL) API ──
      const ndlUrl = `https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${cleanIsbn}`;
      const ndlRes = await fetch(ndlUrl);

      if (ndlRes.ok) {
        const xmlText = await ndlRes.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const item = xmlDoc.getElementsByTagName("item")[0];

        if (item) {
          const titleEl = item.getElementsByTagName("title")[0];
          const dcTitleEl = item.getElementsByTagName("dc:title")[0];
          const creatorEl = item.getElementsByTagName("dc:creator")[0];
          const publisherEl = item.getElementsByTagName("dc:publisher")[0];
          const dateEl = item.getElementsByTagName("dc:date")[0];

          const fetchedTitle = titleEl ? titleEl.textContent || "" : "";
          const titleKana = dcTitleEl ? dcTitleEl.getAttribute("transcription") || "" : "";
          const fetchedAuthor = creatorEl ? creatorEl.textContent || "" : "";
          const fetchedPublisher = publisherEl ? publisherEl.textContent || "" : "";
          let fetchedDate = dateEl ? dateEl.textContent || "" : "";
          fetchedDate = fetchedDate.replace(/\./g, "-").replace(/\//g, "-");

          setTitle(fetchedTitle);
          setSortTitle(titleKana ? hiraganaToKatakana(titleKana) : toKatakana(fetchedTitle));
          setAuthors(fetchedAuthor);
          setPublisher(fetchedPublisher);
          setPublishedDate(fetchedDate);

          // 国会図書館は画像がないため、openBDやGoogle Booksで画像だけ追加で探す
          try {
            const bdRes = await fetch(`https://api.openbd.jp/v1/get?isbn=${cleanIsbn}`);
            const bdData = await bdRes.json();
            if (bdData && bdData[0]?.summary?.cover) {
              setImageLink(bdData[0].summary.cover);
            } else {
              const gRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
              const gData = await gRes.json();
              if (gData.totalItems > 0 && gData.items) {
                const info = gData.items[0].volumeInfo;
                const rawImg = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "";
                if (rawImg) setImageLink(rawImg.replace("http://", "https://"));
              }
            }
          } catch (imgErr) {
            console.error("画像追加取得エラー", imgErr);
          }

          setFetchingApi(false);
          return;
        }
      }

      // ── 2. 【第2優先】openBD API ──
      const bdRes = await fetch(`https://api.openbd.jp/v1/get?isbn=${cleanIsbn}`);
      const bdData = await bdRes.json();

      if (bdData && bdData[0]) {
        const summary = bdData[0].summary;
        const fetchedTitle = summary.title || "";

        setTitle(fetchedTitle);
        setSortTitle(toKatakana(fetchedTitle));
        setAuthors(summary.author || "");
        setPublisher(summary.publisher || "");
        setPublishedDate(summary.pubdate || "");
        setImageLink(summary.cover || "");
        setFetchingApi(false);
        return;
      }

      // ── 3. 【第3優先】Google Books API ──
      const gRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
      const gData = await gRes.json();

      if (gData.totalItems > 0 && gData.items) {
        const volumeInfo = gData.items[0].volumeInfo;
        const rawTitle = volumeInfo.title || "";

        let parsedTitle = rawTitle;
        let parsedSeries = volumeInfo.seriesInfo?.bookDisplayTitle || "";

        if (rawTitle.includes(" : ")) {
          const parts = rawTitle.split(" : ");
          if (!parsedSeries) parsedSeries = parts[0];
        }
        if (rawTitle.includes(" (") && rawTitle.endsWith(")")) {
          const parts = rawTitle.split(" (");
          parsedTitle = parts[0];
          if (!parsedSeries) parsedSeries = parts[1].replace(")", "");
        }

        setTitle(parsedTitle);
        setSeries(parsedSeries);
        setSortTitle(toKatakana(parsedTitle));
        setAuthors(volumeInfo.authors ? volumeInfo.authors.join(" ") : "");
        setPublisher(volumeInfo.publisher || "");
        setPublishedDate(volumeInfo.publishedDate || "");
        
        const rawImg = volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || "";
        setImageLink(rawImg.replace("http://", "https://"));
        setFetchingApi(false);
        return;
      }

      setErrorMessage("該当する書籍が見つかりませんでした。手動で入力してください。");

    } catch (err) {
      console.error(err);
      setErrorMessage("情報の取得に失敗しました。");
    } finally {
      setFetchingApi(false);
    }
  };

  // 画像ファイル選択・撮影
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageLink(reader.result as string);
      setImageScale(1);
      setImagePosX(0);
      setImagePosY(0);
      setShowCropModal(true); // アップロード直後にトリミング・位置調整画面を開く
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("タイトルは必須です。");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setExistingBook(null);

    const cleanIsbn = isbn.trim();

    if (cleanIsbn) {
      const { data: foundData } = await supabase
        .from("books")
        .select("title, created_at, status, memo")
        .eq("isbn", cleanIsbn)
        .single();

      if (foundData) {
        setExistingBook(foundData);
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase.from("books").insert([
      {
        title: title.trim(),
        sort_title: sortTitle.trim() || title.trim(),
        series: series.trim() || null,
        authors: authors.trim() || null,
        publisher: publisher.trim() || null,
        published_date: publishedDate.trim() || null,
        image_link: imageLink.trim() || null,
        isbn: cleanIsbn || null,
        status: status,
        created_at: registeredDate ? new Date(registeredDate).toISOString() : new Date().toISOString(),
        memo: memo.trim() || null,
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
      setSuccessMessage("登録が完了しました");
      setTimeout(() => {
        router.push(status === "持っている" ? "/" : "/wants");
      }, 800);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-20">
      <header className="sticky top-0 z-10 bg-neutral-950/85 backdrop-blur-md border-b border-neutral-800 px-4 py-4 md:px-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>本棚に戻る</span>
          </Link>
          <h1 className="text-base font-bold tracking-wider text-neutral-100">本を登録する</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 md:px-8">
        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-950 border border-emerald-800 text-emerald-200 text-sm flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {existingBook && (
          <div className="mb-8 p-5 bg-neutral-900 border border-neutral-700 text-neutral-200">
            <h2 className="font-bold text-base mb-2 text-neutral-100 flex items-center gap-2">
              ⚠️ すでに登録されている本です
            </h2>
            <div className="bg-neutral-950 p-3 border border-neutral-800 text-xs space-y-1 text-neutral-300 mt-2">
              <p><strong className="text-neutral-100">タイトル:</strong> {existingBook.title}</p>
              <p><strong className="text-neutral-100">ステータス:</strong> {existingBook.status}</p>
              <p><strong className="text-neutral-100">登録日:</strong> {new Date(existingBook.created_at).toLocaleDateString()}</p>
              {existingBook.memo && <p><strong className="text-neutral-100">メモ:</strong> {existingBook.memo}</p>}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-neutral-900 border border-neutral-700 text-neutral-300 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 p-5 space-y-3">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" /> ISBN
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="9784..."
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
              />
              <button
                type="button"
                onClick={handleFetchByIsbn}
                disabled={fetchingApi}
                className="px-4 py-2 bg-neutral-100 text-neutral-900 text-sm font-semibold hover:bg-neutral-300 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <span>{fetchingApi ? "取得中..." : "自動取得"}</span>
              </button>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 p-5 space-y-4">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> 書籍詳細
            </h2>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">ステータス</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus("持っている")}
                  className={`py-2 text-xs font-bold border transition cursor-pointer ${
                    status === "持っている"
                      ? "bg-neutral-100 text-neutral-950 border-neutral-100"
                      : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  持っている本
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("欲しい")}
                  className={`py-2 text-xs font-bold border transition cursor-pointer ${
                    status === "欲しい"
                      ? "bg-neutral-100 text-neutral-950 border-neutral-100"
                      : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  欲しい本
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">タイトル *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">フリガナ（並び替え用）</label>
                <input
                  type="text"
                  value={sortTitle}
                  onChange={(e) => setSortTitle(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> シリーズ名
                </label>
                <input
                  type="text"
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">著者名</label>
                <input
                  type="text"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">発行社</label>
                <input
                  type="text"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> 登録日
              </label>
              <input
                type="date"
                value={registeredDate}
                onChange={(e) => setRegisteredDate(e.target.value)}
                className="w-full md:w-auto bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-500"
              />
            </div>

            {/* 表紙画像（プレビュー・トリミング調整・拡大） */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-neutral-400">表紙画像</label>
                {imageLink && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCropModal(true)}
                      className="text-[10px] text-neutral-300 hover:text-white flex items-center gap-1 bg-neutral-800 px-2.5 py-1 rounded cursor-pointer"
                    >
                      <Crop className="w-3.5 h-3.5" /> トリミング・位置調整
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div 
                  className="w-20 h-28 bg-neutral-950 border border-neutral-800 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer relative group"
                  onClick={() => imageLink && setShowCropModal(true)}
                >
                  {imageLink ? (
                    <img 
                      src={imageLink} 
                      alt="表紙プレビュー" 
                      style={{
                        transform: `scale(${imageScale}) translate(${imagePosX}px, ${imagePosY}px)`,
                        transition: 'transform 0.1s ease'
                      }}
                      className={`w-full h-full ${imageFitMode === "cover" ? "object-cover" : "object-contain"}`} 
                    />
                  ) : (
                    <BookOpen className="w-6 h-6 text-neutral-700" />
                  )}
                  {imageLink && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px]">
                      調整
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3 w-full">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="画像URL"
                      value={imageLink}
                      onChange={(e) => setImageLink(e.target.value)}
                      className="flex-1 bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-500"
                    />
                    {imageLink && (
                      <button
                        type="button"
                        onClick={() => setImageLink("")}
                        className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> クリア
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer transition">
                      <Camera className="w-4 h-4 text-neutral-400" />
                      <span>カメラで撮影</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>

                    <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer transition">
                      <ImageIcon className="w-4 h-4 text-neutral-400" />
                      <span>アルバムから選択</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">メモ（キーワード検索に活用できます）</label>
              <textarea
                rows={2}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-neutral-100 text-neutral-900 font-bold text-sm hover:bg-neutral-300 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? "登録中..." : "本棚に登録する"}
          </button>
        </form>
      </main>

      {/* 画像のトリミング・位置調整・拡大モーダル */}
      {showCropModal && imageLink && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-4 pb-8">
          <div className="w-full flex items-center justify-between max-w-md pt-2">
            <span className="text-xs font-bold text-neutral-300">表紙のトリミング・位置調整</span>
            <button
              type="button"
              onClick={() => setShowCropModal(false)}
              className="p-2 bg-neutral-800 text-white rounded-full hover:bg-neutral-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* トリミング枠（プレビュー） */}
          <div className="my-auto w-40 h-56 bg-neutral-900 border-2 border-white/80 shadow-2xl flex items-center justify-center overflow-hidden relative">
            <img
              src={imageLink}
              alt="トリミング調整中"
              style={{
                transform: `scale(${imageScale}) translate(${imagePosX}px, ${imagePosY}px)`,
                transition: 'transform 0.05s ease'
              }}
              className={`max-w-none ${imageFitMode === "cover" ? "w-full h-full object-cover" : "object-contain"}`}
            />
          </div>

          {/* 調整コントローラー */}
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 p-4 space-y-3 text-xs text-neutral-300">
            <div className="flex justify-between items-center">
              <span>表示モード:</span>
              <button
                type="button"
                onClick={() => setImageFitMode(imageFitMode === "cover" ? "contain" : "cover")}
                className="px-3 py-1 bg-neutral-800 text-neutral-100 rounded hover:bg-neutral-700 transition"
              >
                {imageFitMode === "cover" ? "切り抜き (Cover)" : "全体表示 (Contain)"}
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span>拡大 / 縮小:</span>
                <span>{imageScale.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={imageScale}
                onChange={(e) => setImageScale(parseFloat(e.target.value))}
                className="w-full accent-neutral-100 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <span>左右位置:</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={imagePosX}
                  onChange={(e) => setImagePosX(parseInt(e.target.value))}
                  className="w-full accent-neutral-100 cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <span>上下位置:</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={imagePosY}
                  onChange={(e) => setImagePosY(parseInt(e.target.value))}
                  className="w-full accent-neutral-100 cursor-pointer"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCropModal(false)}
              className="w-full mt-2 py-2.5 bg-neutral-100 text-neutral-900 font-bold rounded hover:bg-neutral-300 transition cursor-pointer"
            >
              調整を完了する
            </button>
          </div>
        </div>
      )}
    </div>
  );
}