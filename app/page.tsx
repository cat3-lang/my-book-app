"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Book {
  id: number;
  isbn: string;
  title: string;
  author: string;
  series: string;
  publisher: string;
  status: "持っている" | "欲しい";
  registeredAt: string;
  releaseDate: string;
  coverUrl: string;
  memo: string;
}

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [mode, setMode] = useState<"manage" | "store">("manage");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [series, setSeries] = useState("");
  const [publisher, setPublisher] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<"持っている" | "欲しい">("持っている");
  const [registeredAt, setRegisteredAt] = useState(() => new Date().toISOString().split("T")[0]);

  const [stagedBooks, setStagedBooks] = useState<Book[]>([]);
  const [storeSearchQuery, setStoreSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"持っている" | "欲しい">("持っている");
  const [sortMode, setSortMode] = useState<"series" | "kana" | "date">("series");
  const [kanaFilter, setKanaFilter] = useState<string>("すべて");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({});

  const toggleSection = (name: string) => {
    setOpenSection(prev => ({ ...prev, [name]: !prev[name] }));
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    const { data, error } = await supabase.from('books').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('データ取得エラー:', error);
    } else if (data) {
      setBooks(data.map((b: any) => ({
        id: b.id,
        isbn: b.isbn || "",
        title: b.title || "",
        author: b.author || "",
        series: b.series || "",
        publisher: b.publisher || "",
        status: b.status || "持っている",
        registeredAt: b.registeredAt || "",
        releaseDate: b.releaseDate || "",
        coverUrl: b.coverUrl || "",
        memo: b.memo || ""
      })));
    }
  };

  const fetchBookInfo = async () => {
    const cleanIsbn = isbn.trim();
    if (!cleanIsbn || cleanIsbn.length < 10) {
      alert("有効なISBNを入力してください。");
      return;
    }

    setIsLoading(true);
    let foundTitle = "";
    let foundAuthor = "";
    let foundPublisher = "";
    let foundRelease = "";
    let foundDescription = "";
    let foundCoverUrl = "";

    try {
      const gRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
      const gData = await gRes.json();

      if (gData && gData.items && gData.items[0]) {
        const info = gData.items[0].volumeInfo;
        if (info.title) foundTitle = info.title;
        if (info.authors) foundAuthor = info.authors.join(", ");
        if (info.publisher) foundPublisher = info.publisher;
        if (info.publishedDate) foundRelease = info.publishedDate;
        if (info.description) foundDescription = info.description;
        if (info.imageLinks && info.imageLinks.thumbnail) {
          foundCoverUrl = info.imageLinks.thumbnail.replace("http://", "https://");
        }
      }

      const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${cleanIsbn}`);
      const data = await res.json();

      if (data && data[0]) {
        const item = data[0];
        let rawPublisher = item.summary?.publisher || "";
        let rawSeller = "";

        if (item.onix?.PublishingDetail?.Publisher) {
          const publishers = Array.isArray(item.onix.PublishingDetail.Publisher)
            ? item.onix.PublishingDetail.Publisher
            : [item.onix.PublishingDetail.Publisher];
          
          const sellerObj = publishers.find((p: any) => p.PublishingRole === "02");
          if (sellerObj && sellerObj.PublisherName) {
            rawSeller = sellerObj.PublisherName;
          }
        }

        if (rawPublisher && rawSeller && rawPublisher !== rawSeller) {
          foundPublisher = `${rawPublisher} (発売：${rawSeller})`;
        } else if (rawPublisher) {
          foundPublisher = rawPublisher;
        }

        if (item.summary) {
          const summary = item.summary;
          if (!foundTitle && summary.title) foundTitle = summary.title;
          if (!foundAuthor && summary.author) foundAuthor = summary.author;
          if (!foundRelease && summary.pubdate && summary.pubdate.length === 8) {
            foundRelease = `${summary.pubdate.slice(0, 4)}-${summary.pubdate.slice(4, 6)}-${summary.pubdate.slice(6, 8)}`;
          }
          if (summary.cover) {
            foundCoverUrl = summary.cover;
          }
        }
      }

      if (foundTitle) setTitle(foundTitle);
      if (foundAuthor) setAuthor(foundAuthor);
      if (foundPublisher) setPublisher(foundPublisher);
      if (foundRelease) setReleaseDate(foundRelease);
      if (foundDescription) setMemo(foundDescription);
      if (foundTitle) setSeries(foundTitle.split(/[\s 0-9０-９一二三四五六七八九十巻#]/)[0]);

      if (foundCoverUrl) {
        setCoverUrl(foundCoverUrl);
      } else {
        setCoverUrl(`https://image.opencover.jp/v1/cover/spine/${cleanIsbn}.webp`);
      }

      alert("出版社や内容を含めて情報を自動取得しました！");
    } catch (e) {
      console.error(e);
      setCoverUrl(`https://image.opencover.jp/v1/cover/spine/${cleanIsbn}.webp`);
      alert("自動取得に失敗しましたが、背表紙画像を設定しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const addToStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const cleanIsbn = isbn.trim();
    if (cleanIsbn) {
      const existsByIsbn = books.some(b => b.isbn === cleanIsbn) || stagedBooks.some(b => b.isbn === cleanIsbn);
      if (existsByIsbn) {
        alert("このISBNの本はすでに登録されています！");
        return;
      }
    }
    const existsByTitle = books.some(b => b.title === title.trim()) || stagedBooks.some(b => b.title === title.trim());
    if (existsByTitle) {
      alert("同じタイトルの本がすでに登録されています！");
      return;
    }

    const newBook: Book = {
      id: Date.now() + Math.random(),
      isbn: cleanIsbn || "N/A",
      title,
      author,
      series: series.trim() || "単行本・その他",
      publisher: publisher.trim() || "未設定",
      status,
      registeredAt: registeredAt || new Date().toISOString().split("T")[0],
      releaseDate: releaseDate.trim() || "未設定",
      coverUrl: coverUrl.trim() || `https://image.opencover.jp/v1/cover/spine/${cleanIsbn}.webp`,
      memo: memo.trim(),
    };

    setStagedBooks([newBook, ...stagedBooks]);
    setIsbn(""); setTitle(""); setAuthor(""); setSeries(""); setPublisher(""); setReleaseDate(""); setCoverUrl(""); setMemo("");
  };

  const commitBatch = async () => {
    if (stagedBooks.length === 0) return;

    const insertData = stagedBooks.map(b => ({
      isbn: b.isbn,
      title: b.title,
      author: b.author,
      series: b.series,
      publisher: b.publisher,
      status: b.status,
      registeredAt: b.registeredAt,
      releaseDate: b.releaseDate,
      coverUrl: b.coverUrl,
      memo: b.memo
    }));

    const { data, error } = await supabase.from('books').insert(insertData).select();

    if (error) {
      console.error('Supabase保存エラー:', error);
      alert("データベースへの保存に失敗しました。");
    } else {
      alert("本棚へ登録しました！");
      setStagedBooks([]);
      fetchBooks();
    }
  };

  const deleteBook = async (id: number) => {
    if (confirm("削除しますか？")) {
      const { error } = await supabase.from('books').delete().eq('id', id);
      if (error) {
        console.error('削除エラー:', error);
        alert("削除に失敗しました。");
      } else {
        setSelectedBook(null);
        fetchBooks();
      }
    }
  };

  const updateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook) return;

    const { error } = await supabase.from('books').update({
      title: selectedBook.title,
      author: selectedBook.author,
      series: selectedBook.series,
      publisher: selectedBook.publisher,
      status: selectedBook.status,
      registeredAt: selectedBook.registeredAt,
      releaseDate: selectedBook.releaseDate,
      coverUrl: selectedBook.coverUrl,
      memo: selectedBook.memo
    }).eq('id', selectedBook.id);

    if (error) {
      console.error('更新エラー:', error);
      alert("更新に失敗しました。");
    } else {
      setSelectedBook(null);
      alert("更新しました！");
      fetchBooks();
    }
  };

  const filteredBooks = useMemo(() => {
    return books.filter(b => b.status === activeTab && (
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.series.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.publisher.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.isbn.includes(searchQuery)
    ));
  }, [books, activeTab, searchQuery]);

  const getKanaGroup = (str: string) => {
    const first = str.charAt(0);
    if (/^[あ-おア-オ]/.test(first)) return "あ";
    if (/^[か-こカ-コが-ごガ-ゴ]/.test(first)) return "か";
    if (/^[さ-そサ-ソざ-ぞザ-ゾ]/.test(first)) return "さ";
    if (/^[た-とタ-トだ-どダ-ド]/.test(first)) return "た";
    if (/^[な-のナ-ノ]/.test(first)) return "な";
    if (/^[は-ほハ-ホば-ぼバ-ボぱ-ぽパ-ポ]/.test(first)) return "は";
    if (/^[ま-もマ-モ]/.test(first)) return "ま";
    if (/^[や-よヤ-ヨ]/.test(first)) return "や";
    if (/^[ら-ろラ-ロ]/.test(first)) return "ら";
    if (/^[わ-んワ-ン]/.test(first)) return "わ";
    return "その他";
  };

  const groupedData = useMemo(() => {
    const map: Record<string, Book[]> = {};

    filteredBooks.forEach(b => {
      let key = "すべて";
      if (sortMode === "series") {
        key = b.series || "単行本・その他";
      } else if (sortMode === "kana") {
        key = getKanaGroup(b.title);
        if (kanaFilter !== "すべて" && key !== kanaFilter) return;
      } else if (sortMode === "date") {
        key = b.registeredAt ? b.registeredAt.slice(0, 7) : "未設定";
      }

      if (!map[key]) map[key] = [];
      map[key].push(b);
    });

    return map;
  }, [filteredBooks, sortMode, kanaFilter]);

  const storeSearchResult = useMemo(() => {
    if (!storeSearchQuery.trim()) return [];
    return books.filter(b => b.isbn.includes(storeSearchQuery) || b.title.toLowerCase().includes(storeSearchQuery.toLowerCase()));
  }, [books, storeSearchQuery]);

  const exportCSV = () => {
    const headers = "ISBN,タイトル,著者,シリーズ名,出版社,ステータス,登録日,発売日\n";
    const rows = books.map(b => `"${b.isbn}","${b.title}","${b.author}","${b.series}","${b.publisher}","${b.status}","${b.registeredAt}","${b.releaseDate}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "books.csv"; a.click();
  };

  const kanaList = ["すべて", "あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ", "その他"];

  return (
    <main className="min-h-screen bg-[#1e1e1e] text-[#d4d4d4] p-4 sm:p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-4">
        
        {/* ヘッダー */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#252526] p-4 rounded-lg border border-[#333333] gap-3 shadow-md">
          <h1 className="text-sm font-bold tracking-wider text-white flex items-center gap-2">
            <span className="w-2 h-2 bg-neutral-400 inline-block"></span>
            PERSONAL LIBRARY
          </h1>
          <div className="flex gap-2 items-center">
            <div className="bg-[#1e1e1e] p-1 rounded border border-[#333333] flex gap-1 text-xs">
              <button onClick={() => setMode("manage")} className={`px-3 py-1 rounded font-semibold transition-colors ${mode === "manage" ? "bg-[#333333] text-white" : "text-neutral-400 hover:text-white"}`}>ホーム本棚</button>
              <button onClick={() => setMode("store")} className={`px-3 py-1 rounded font-semibold transition-colors ${mode === "store" ? "bg-[#333333] text-white" : "text-neutral-400 hover:text-white"}`}>店舗チェック</button>
            </div>
            <button onClick={exportCSV} className="border border-[#333333] bg-[#1e1e1e] px-3 py-1.5 rounded text-xs font-semibold text-neutral-300 hover:bg-[#333333] transition-colors">CSV</button>
          </div>
        </header>

        {mode === "manage" && (
          <div className="space-y-4">
            {/* 新規追加アコーディオン */}
            <section className="bg-[#252526] rounded-lg border border-[#333333] overflow-hidden shadow-md">
              <button onClick={() => setIsFormOpen(!isFormOpen)} className="w-full p-4 flex justify-between items-center text-xs font-bold text-white hover:bg-[#2a2a2b] transition-colors">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-neutral-500 inline-block"></span>
                  新しい本を追加する（出版社・内容自動取得対応）
                </span>
                <span className="text-neutral-400">{isFormOpen ? "▲ 閉じる" : "▼ 開く"}</span>
              </button>
              {isFormOpen && (
                <div className="p-4 pt-0 border-t border-[#333333] space-y-3 bg-[#252526]">
                  <div className="flex gap-2 pt-3 items-end">
                    <div className="flex-1">
                      <label className="text-[10px] text-neutral-400 block mb-1">ISBN (13桁)</label>
                      <input type="text" placeholder="9784..." value={isbn} onChange={e => setIsbn(e.target.value)} className="w-full border border-[#333333] p-2 rounded text-xs bg-[#1e1e1e] text-white focus:outline-none focus:border-neutral-500" />
                    </div>
                    <button type="button" onClick={fetchBookInfo} disabled={isLoading} className="bg-[#3a3a3b] hover:bg-[#4a4a4b] text-white px-3 py-2 rounded text-xs h-[34px] transition-colors">
                      {isLoading ? "取得中..." : "🔄 情報を自動取得"}
                    </button>
                  </div>
                  <form onSubmit={addToStage} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                    <input type="text" placeholder="タイトル *" value={title} onChange={e => setTitle(e.target.value)} className="border border-[#333333] p-2 rounded bg-[#1e1e1e] text-white focus:outline-none focus:border-neutral-500" required />
                    <input type="text" placeholder="シリーズ名" value={series} onChange={e => setSeries(e.target.value)} className="border border-[#333333] p-2 rounded bg-[#1e1e1e] text-white focus:outline-none focus:border-neutral-500" />
                    <input type="text" placeholder="出版社" value={publisher} onChange={e => setPublisher(e.target.value)} className="border border-[#333333] p-2 rounded bg-[#1e1e1e] text-white focus:outline-none focus:border-neutral-500" />
                    <input type="text" placeholder="著者名" value={author} onChange={e => setAuthor(e.target.value)} className="border border-[#333333] p-2 rounded bg-[#1e1e1e] text-white focus:outline-none focus:border-neutral-500" />
                    <div>
                      <label className="text-[10px] text-neutral-400 block">登録日</label>
                      <input type="date" value={registeredAt} onChange={e => setRegisteredAt(e.target.value)} className="w-full border border-[#333333] p-1.5 rounded bg-[#1e1e1e] text-white focus:outline-none focus:border-neutral-500" />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block">発売日</label>
                      <input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} className="w-full border border-[#333333] p-1.5 rounded bg-[#1e1e1e] text-white focus:outline-none focus:border-neutral-500" />
                    </div>
                    <select value={status} onChange={e => setStatus(e.target.value as any)} className="border border-[#333333] p-2 rounded bg-[#1e1e1e] text-white self-end focus:outline-none focus:border-neutral-500">
                      <option value="持っている">持っている</option>
                      <option value="欲しい">欲しい</option>
                    </select>
                    <button type="submit" className="bg-[#3a3a3b] hover:bg-[#4a4a4b] text-white py-2 rounded font-semibold self-end transition-colors">ストックに追加</button>
                  </form>
                </div>
              )}
            </section>

            {/* ストック */}
            {stagedBooks.length > 0 && (
              <section className="bg-[#2d2d2d] text-white p-4 rounded-lg space-y-2 border border-[#3a3a3b] shadow-md">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold">🛒 ストック ({stagedBooks.length}冊)</span>
                  <button onClick={commitBatch} className="bg-white text-neutral-900 px-3 py-1 rounded font-bold hover:bg-neutral-200 transition-colors">本棚へ登録 (クラウド保存)</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {stagedBooks.map(b => (
                    <span key={b.id} className="bg-[#1e1e1e] border border-[#3a3a3b] px-2.5 py-1 rounded text-xs flex items-center gap-1">
                      {b.title} 
                      <button onClick={() => setStagedBooks(stagedBooks.filter(x => x.id !== b.id))} className="text-neutral-400 hover:text-white">×</button>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* タブ & 表示切替 ＆ 検索 */}
            <div className="space-y-2 bg-[#252526] p-3 rounded-lg border border-[#333333] shadow-md">
              <div className="flex flex-col sm:flex-row gap-2 justify-between">
                <div className="flex bg-[#1e1e1e] p-1 rounded border border-[#333333] text-xs w-full sm:w-64">
                  <button onClick={() => setActiveTab("持っている")} className={`flex-1 py-1 rounded font-semibold transition-colors ${activeTab === "持っている" ? "bg-[#333333] text-white" : "text-neutral-400 hover:text-white"}`}>持っている</button>
                  <button onClick={() => setActiveTab("欲しい")} className={`flex-1 py-1 rounded font-semibold transition-colors ${activeTab === "欲しい" ? "bg-[#333333] text-white" : "text-neutral-400 hover:text-white"}`}>欲しい</button>
                </div>

                <div className="flex bg-[#1e1e1e] p-1 rounded border border-[#333333] text-xs">
                  <button onClick={() => setSortMode("series")} className={`px-3 py-1 rounded font-semibold transition-colors ${sortMode === "series" ? "bg-[#333333] text-white" : "text-neutral-400 hover:text-white"}`}>シリーズ順</button>
                  <button onClick={() => setSortMode("kana")} className={`px-3 py-1 rounded font-semibold transition-colors ${sortMode === "kana" ? "bg-[#333333] text-white" : "text-neutral-400 hover:text-white"}`}>名前順</button>
                  <button onClick={() => setSortMode("date")} className={`px-3 py-1 rounded font-semibold transition-colors ${sortMode === "date" ? "bg-[#333333] text-white" : "text-neutral-400 hover:text-white"}`}>登録月順</button>
                </div>
              </div>

              {sortMode === "kana" && (
                <div className="flex flex-wrap gap-1 bg-[#1e1e1e] p-2 rounded border border-[#333333] text-xs">
                  {kanaList.map(k => (
                    <button
                      key={k}
                      onClick={() => setKanaFilter(k)}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors ${kanaFilter === k ? "bg-[#333333] text-white" : "bg-[#252526] text-neutral-400 hover:bg-[#333333] hover:text-white"}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              )}

              <input type="text" placeholder="🔍 本棚内を検索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="border border-[#333333] bg-[#1e1e1e] p-2 rounded text-xs w-full text-white focus:outline-none focus:border-neutral-500" />
            </div>

            {/* 一覧 */}
            <section className="space-y-2">
              {Object.entries(groupedData).map(([groupName, gBooks]) => {
                const isOpen = openSection[groupName] ?? true;
                return (
                  <div key={groupName} className="bg-[#252526] rounded-lg border border-[#333333] overflow-hidden text-xs shadow-md">
                    <button onClick={() => toggleSection(groupName)} className="w-full p-3 bg-[#2d2d2d] flex justify-between font-bold text-white hover:bg-[#333333] transition-colors">
                      <span>{groupName} ({gBooks.length}冊)</span>
                      <span className="text-neutral-400">{isOpen ? "▲" : "▼"}</span>
                    </button>
                    {isOpen && (
                      <div className="divide-y divide-[#333333]">
                        {gBooks.map(b => (
                          <div key={b.id} onClick={() => setSelectedBook(b)} className="p-3 hover:bg-[#2a2a2b] cursor-pointer flex justify-between items-center transition-colors">
                            <div className="flex items-center gap-3">
                              <img 
                                src={b.coverUrl} 
                                alt="表紙" 
                                className="w-8 h-12 object-cover rounded bg-[#1e1e1e] border border-[#333333]" 
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.onerror = null;
                                  target.src = "https://image.opencover.jp/v1/cover/spine/" + b.isbn + ".webp";
                                }} 
                              />
                              <div>
                                <p className="font-bold text-white">{b.title}</p>
                                <p className="text-[10px] text-neutral-400">著者: {b.author || "-"} / 出版社: {b.publisher || "-"}</p>
                              </div>
                            </div>
                            <span className="text-neutral-400 text-[10px]">詳細 ❯</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </div>
        )}

        {mode === "store" && (
          <section className="bg-[#252526] p-6 rounded-lg border border-[#333333] space-y-4 max-w-lg mx-auto text-center shadow-md">
            <h2 className="text-sm font-bold text-white">店頭チェックモード</h2>
            <input type="text" placeholder="ISBN または タイトル..." value={storeSearchQuery} onChange={e => setStoreSearchQuery(e.target.value)} className="w-full border border-[#333333] p-3 rounded text-xs bg-[#1e1e1e] text-white focus:outline-none focus:border-neutral-500" autoFocus />
            {storeSearchQuery.trim() && (
              <div className="text-left space-y-2 text-xs">
                {storeSearchResult.length === 0 ? (
                  <p className="p-4 bg-[#1e1e1e] border border-[#333333] text-center rounded font-bold text-green-400">✓ 未所持です</p>
                ) : (
                  storeSearchResult.map(b => (
                    <div key={b.id} className="p-4 bg-[#1e1e1e] border border-[#333333] text-white rounded flex gap-3 items-center shadow-inner">
                      <img 
                        src={b.coverUrl} 
                        alt="表紙" 
                        className="w-10 h-14 object-cover rounded border border-[#333333]" 
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = "https://image.opencover.jp/v1/cover/spine/" + b.isbn + ".webp";
                        }}
                      />
                      <div>
                        <span className="text-[9px] bg-[#333333] px-1.5 py-0.5 rounded text-neutral-300">登録済み ({b.status})</span>
                        <p className="font-bold mt-1 text-white">{b.title}</p>
                        <p className="text-[10px] text-neutral-400">出版社: {b.publisher}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        )}

        {/* 詳細モーダル */}
        {selectedBook && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 text-xs backdrop-blur-xs">
            <div className="bg-[#252526] border border-[#333333] rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl text-neutral-200">
              <div className="flex justify-between items-center border-b border-[#333333] pb-2">
                <span className="font-bold text-sm text-white">{selectedBook.title}</span>
                <button onClick={() => setSelectedBook(null)} className="font-bold text-neutral-400 hover:text-white">✕</button>
              </div>
              <form onSubmit={updateBook} className="space-y-3">
                <div className="grid grid-cols-2 gap-2 bg-[#1e1e1e] border border-[#333333] p-3 rounded">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400">登録日（変更可）</label>
                    <input type="date" value={selectedBook.registeredAt} onChange={e => setSelectedBook({ ...selectedBook, registeredAt: e.target.value })} className="w-full border border-[#333333] p-1.5 rounded bg-[#252526] text-white font-bold focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400">ISBN（変更不可）</label>
                    <input type="text" value={selectedBook.isbn} readOnly className="w-full border border-[#333333] p-1.5 rounded bg-[#1e1e1e] font-mono text-neutral-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={selectedBook.title} onChange={e => setSelectedBook({ ...selectedBook, title: e.target.value })} className="border border-[#333333] p-2 rounded bg-[#1e1e1e] text-white focus:outline-none focus:border-neutral-500" placeholder="タイトル" required />
                  <input type="text" value={selectedBook.publisher} onChange={e => setSelectedBook({ ...selectedBook, publisher: e.target.value })} className="border border-[#333333] p-2 rounded bg-[#1e1e1e] text-white focus:outline-none focus:border-neutral-500" placeholder="出版社" />
                  <input type="text" value={selectedBook.series} onChange={e => setSelectedBook({ ...selectedBook, series: e.target.value })} className="border border-[#333333] p-2 rounded bg-[#1e1e1e] text-white focus:outline-none focus:border-neutral-500" placeholder="シリーズ名" />
                  <input type="text" value={selectedBook.author} onChange={e => setSelectedBook({ ...selectedBook, author: e.target.value })} className="border border-[#333333] p-2 rounded bg-[#1e1e1e] text-white focus:outline-none focus:border-neutral-500" placeholder="著者名" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400">発売日</label>
                    <input type="date" value={selectedBook.releaseDate} onChange={e => setSelectedBook({ ...selectedBook, releaseDate: e.target.value })} className="w-full border border-[#333333] p-2 rounded bg-[#1e1e1e] text-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400">ステータス</label>
                    <select value={selectedBook.status} onChange={e => setSelectedBook({ ...selectedBook, status: e.target.value as any })} className="w-full border border-[#333333] p-2 rounded bg-[#1e1e1e] text-white focus:outline-none">
                      <option value="持っている">持っている</option>
                      <option value="欲しい">欲しい</option>
                    </select>
                  </div>
                </div>
                <input type="text" value={selectedBook.coverUrl} onChange={e => setSelectedBook({ ...selectedBook, coverUrl: e.target.value })} className="w-full border border-[#333333] p-2 rounded bg-[#1e1e1e] text-white focus:outline-none" placeholder="表紙URL" />
                <textarea rows={4} value={selectedBook.memo} onChange={e => setSelectedBook({ ...selectedBook, memo: e.target.value })} className="w-full border border-[#333333] p-2 rounded bg-[#1e1e1e] text-white focus:outline-none resize-none" placeholder="内容・あらすじ・メモ" />
                <div className="flex justify-between pt-2 border-t border-[#333333]">
                  <button type="button" onClick={() => deleteBook(selectedBook.id)} className="text-red-400 font-bold hover:text-red-300">削除</button>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSelectedBook(null)} className="px-3 py-1.5 border border-[#333333] rounded hover:bg-[#333333] transition-colors text-white">キャンセル</button>
                    <button type="submit" className="px-3 py-1.5 bg-[#3a3a3b] hover:bg-[#4a4a4b] text-white rounded font-semibold transition-colors">保存</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}