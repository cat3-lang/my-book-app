"use client";

import { useState, useMemo, useEffect } from "react";

interface Book {
  id: number;
  isbn: string;
  title: string;
  kana: string;
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
  const [books, setBooks] = useState<Book[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("my_library_books");
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return [
      { id: 1, isbn: "9784088817668", title: "呪術廻戦", kana: "じゅじゅつかいせん", author: "芥見下々", series: "呪術廻戦", publisher: "集英社", status: "持っている", registeredAt: "2026-01-10", releaseDate: "2019-03-04", coverUrl: "https://image.opencover.jp/v1/cover/spine/9784088817668.webp", memo: "面白い！" },
    ];
  });

  useEffect(() => {
    localStorage.setItem("my_library_books", JSON.stringify(books));
  }, [books]);

  const [currentTab, setCurrentTab] = useState<"home" | "register">("home");
  const [isLoading, setIsLoading] = useState(false);

  // 登録フォーム
  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [kana, setKana] = useState("");
  const [author, setAuthor] = useState("");
  const [series, setSeries] = useState("");
  const [publisher, setPublisher] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<"持っている" | "欲しい">("持っている");

  // ホーム画面フィルター
  const [shelfTab, setShelfTab] = useState<"持っている" | "欲しい">("持っている");
  const [sortMode, setSortMode] = useState<"series" | "kana" | "date">("series");
  const [kanaFilter, setKanaFilter] = useState<string>("すべて");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({});

  const toggleSection = (name: string) => {
    setOpenSection(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // Google Books APIからフリガナ（読み仮名）や詳細を取得する関数
  const fetchBookInfo = async () => {
    const cleanIsbn = isbn.trim();
    if (!cleanIsbn || cleanIsbn.length < 10) {
      alert("有効なISBNを入力してください。");
      return;
    }

    setIsLoading(true);
    let foundTitle = "";
    let foundKana = "";
    let foundAuthor = "";
    let foundPublisher = "";
    let foundRelease = "";
    let foundDescription = "";

    try {
      const gRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
      const gData = await gRes.json();

      if (gData && gData.items && gData.items[0]) {
        const info = gData.items[0].volumeInfo;
        if (info.title) foundTitle = info.title;
        // Google Booksはサブタイトルや著者名に含まれるよみ、または検索用情報をチェック
        if (info.authors) foundAuthor = info.authors.join(", ");
        if (info.publisher) foundPublisher = info.publisher;
        if (info.publishedDate) foundRelease = info.publishedDate;
        if (info.description) foundDescription = info.description;
      }

      const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${cleanIsbn}`);
      const data = await res.json();

      if (data && data[0] && data[0].summary) {
        const summary = data[0].summary;
        if (!foundTitle && summary.title) foundTitle = summary.title;
        if (!foundAuthor && summary.author) foundAuthor = summary.author;
        if (summary.publisher) foundPublisher = summary.publisher;
        if (!foundRelease && summary.pubdate && summary.pubdate.length === 8) {
          foundRelease = `${summary.pubdate.slice(0, 4)}-${summary.pubdate.slice(4, 6)}-${summary.pubdate.slice(6, 8)}`;
        }
      }

      if (foundTitle) {
        setTitle(foundTitle);
        // カタカナ・ひらがながタイトルに含まれていればそれをフリガナ候補にする、なければ空欄にして手動入力を促す
        const kanaMatch = foundTitle.match(/[ぁ-んァ-ンー]+/g);
        setKana(kanaMatch ? kanaMatch.join("") : "");
      }
      if (foundAuthor) setAuthor(foundAuthor);
      if (foundPublisher) setPublisher(foundPublisher);
      if (foundRelease) setReleaseDate(foundRelease);
      if (foundDescription) setMemo(foundDescription);
      if (foundTitle) {
        setSeries(foundTitle.split(/[\s 0-9０-９一二三四五六七八九十巻#]/)[0]);
      }

      setCoverUrl(`https://image.opencover.jp/v1/cover/spine/${cleanIsbn}.webp`);
      alert("情報を自動取得しました！フリガナ欄が空欄の場合はひらがな・カタカナを入力してください。");
    } catch (e) {
      console.error(e);
      setCoverUrl(`https://image.opencover.jp/v1/cover/spine/${cleanIsbn}.webp`);
      alert("取得に失敗しましたが、背表紙画像を設定しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // 重複チェック（ISBNがすでに存在するか、または同じタイトルが存在するか）
    const isDuplicate = books.some(b => 
      (isbn.trim() !== "" && isbn.trim() !== "N/A" && b.isbn === isbn.trim()) || 
      b.title === title.trim()
    );

    if (isDuplicate) {
      alert("⚠️ この本はすでに本棚に登録されています！");
      return;
    }

    const newBook: Book = {
      id: Date.now() + Math.random(),
      isbn: isbn.trim() || "N/A",
      title,
      kana: kana.trim() || title,
      author,
      series: series.trim() || "単行本・その他",
      publisher: publisher.trim() || "未設定",
      status,
      registeredAt: new Date().toISOString().split("T")[0],
      releaseDate: releaseDate.trim() || "未設定",
      coverUrl: coverUrl.trim() || `https://image.opencover.jp/v1/cover/spine/${isbn.trim()}.webp`,
      memo: memo.trim(),
    };

    setBooks([newBook, ...books]);
    setIsbn(""); setTitle(""); setKana(""); setAuthor(""); setSeries(""); setPublisher(""); setReleaseDate(""); setCoverUrl(""); setMemo("");
    alert("本を登録しました！");
    setCurrentTab("home");
  };

  const deleteBook = (id: number) => {
    if (confirm("削除しますか？")) {
      setBooks(books.filter(b => b.id !== id));
      setSelectedBook(null);
    }
  };

  const updateBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook) return;
    setBooks(books.map(b => b.id === selectedBook.id ? selectedBook : b));
    setSelectedBook(null);
    alert("更新しました！");
  };

  const getKanaGroup = (str: string) => {
    const first = str.charAt(0);
    if (/^[あ-おア-オｱ-ｵ]/.test(first)) return "あ";
    if (/^[か-こカ-コガ-ゴｶ-ｺ]/.test(first)) return "か";
    if (/^[さ-そサ-ソざ-ゾｻ-ｿ]/.test(first)) return "さ";
    if (/^[た-とタ-トダ-ドﾀ-ﾄ]/.test(first)) return "た";
    if (/^[な-のナ-ノﾅ-ﾉ]/.test(first)) return "な";
    if (/^[は-ほハ-ホば-ぼﾊ-ﾎ]/.test(first)) return "は";
    if (/^[ま-もマ-モﾏ-ﾓ]/.test(first)) return "ま";
    if (/^[や-よヤ-ヨﾔ-ﾖ]/.test(first)) return "や";
    if (/^[ら-ろラ-ロﾗ-ﾛ]/.test(first)) return "ら";
    if (/^[わ-んわ-ﾝ]/.test(first)) return "わ";
    return "その他";
  };

  const filteredBooks = useMemo(() => {
    return books.filter(b => b.status === shelfTab && (
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.series.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.publisher.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.isbn.includes(searchQuery)
    ));
  }, [books, shelfTab, searchQuery]);

  const groupedData = useMemo(() => {
    const map: Record<string, Book[]> = {};

    filteredBooks.forEach(b => {
      let key = "すべて";
      if (sortMode === "series") {
        key = b.series || "単行本・その他";
      } else if (sortMode === "kana") {
        key = getKanaGroup(b.kana || b.title);
        if (kanaFilter !== "すべて" && key !== kanaFilter) return;
      } else if (sortMode === "date") {
        key = b.registeredAt ? b.registeredAt.slice(0, 7) : "未設定";
      }

      if (!map[key]) map[key] = [];
      map[key].push(b);
    });

    return map;
  }, [filteredBooks, sortMode, kanaFilter]);

  const kanaList = ["すべて", "あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ", "その他"];

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 p-4 sm:p-6 font-sans pb-20">
      <div className="max-w-5xl mx-auto space-y-4">
        
        {/* ヘッダー ＆ ナビゲーション */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 border border-neutral-300 gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentTab("home")}>
            <span className="text-lg">■</span>
            <h1 className="text-base font-bold tracking-wider">PERSONAL LIBRARY</h1>
          </div>
          
          <div className="flex gap-1 bg-neutral-100 p-1 border border-neutral-300 text-xs w-full sm:w-auto">
            <button onClick={() => setCurrentTab("home")} className={`flex-1 sm:flex-initial px-4 py-2 font-bold transition ${currentTab === "home" ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-200"}`}>
              ホーム本棚
            </button>
            <button onClick={() => setCurrentTab("register")} className={`flex-1 sm:flex-initial px-4 py-2 font-bold transition ${currentTab === "register" ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-200"}`}>
              本を登録
            </button>
          </div>
        </header>

        {/* ===================== ホーム本棚 ===================== */}
        {currentTab === "home" && (
          <div className="space-y-4">
            <div className="space-y-2 bg-white p-4 border border-neutral-300">
              <div className="flex flex-col sm:flex-row gap-2 justify-between">
                <div className="flex bg-neutral-100 p-1 border border-neutral-300 text-xs w-full sm:w-56">
                  <button onClick={() => setShelfTab("持っている")} className={`flex-1 py-1.5 font-bold ${shelfTab === "持っている" ? "bg-neutral-900 text-white" : "text-neutral-700"}`}>持っている</button>
                  <button onClick={() => setShelfTab("欲しい")} className={`flex-1 py-1.5 font-bold ${shelfTab === "欲しい" ? "bg-neutral-900 text-white" : "text-neutral-700"}`}>欲しい</button>
                </div>

                <div className="flex bg-neutral-100 p-1 border border-neutral-300 text-xs">
                  <button onClick={() => setSortMode("series")} className={`px-3 py-1.5 font-bold ${sortMode === "series" ? "bg-neutral-900 text-white" : "text-neutral-700"}`}>シリーズ順</button>
                  <button onClick={() => setSortMode("kana")} className={`px-3 py-1.5 font-bold ${sortMode === "kana" ? "bg-neutral-900 text-white" : "text-neutral-700"}`}>名前順(あかさたな)</button>
                  <button onClick={() => setSortMode("date")} className={`px-3 py-1.5 font-bold ${sortMode === "date" ? "bg-neutral-900 text-white" : "text-neutral-700"}`}>登録月順</button>
                </div>
              </div>

              {sortMode === "kana" && (
                <div className="flex flex-wrap gap-1 bg-neutral-50 p-2 border border-neutral-300 text-xs pt-2">
                  {kanaList.map(k => (
                    <button
                      key={k}
                      onClick={() => setKanaFilter(k)}
                      className={`px-2.5 py-1 font-bold border transition ${kanaFilter === k ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-200"}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              )}

              <input type="text" placeholder="🔍 本棚内を検索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="border border-neutral-300 bg-neutral-50 p-2.5 text-xs w-full focus:bg-white focus:outline-none" />
            </div>

            {/* 一覧 */}
            <section className="space-y-2">
              {Object.entries(groupedData).length === 0 ? (
                <div className="bg-white p-8 border border-neutral-300 text-center text-neutral-500 text-xs">
                  該当する本がありません。「本を登録」タブから追加してください。
                </div>
              ) : (
                Object.entries(groupedData).map(([groupName, gBooks]) => {
                  const isOpen = openSection[groupName] ?? true;
                  return (
                    <div key={groupName} className="bg-white border border-neutral-300 text-xs">
                      <button onClick={() => toggleSection(groupName)} className="w-full p-3 bg-neutral-100 hover:bg-neutral-200 transition flex justify-between font-bold border-b border-neutral-300">
                        <span>{groupName} ({gBooks.length}冊)</span>
                        <span>{isOpen ? "▲" : "▼"}</span>
                      </button>
                      {isOpen && (
                        <div className="divide-y divide-neutral-200">
                          {gBooks.map(b => (
                            <div key={b.id} onClick={() => setSelectedBook(b)} className="p-3 hover:bg-neutral-50 cursor-pointer transition flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <img src={b.coverUrl} alt="表紙" className="w-8 h-12 object-cover bg-neutral-200 border border-neutral-300" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                                <div>
                                  <p className="font-bold text-sm">{b.title}</p>
                                  <p className="text-[10px] text-neutral-600">著者: {b.author || "-"} / 出版社: {b.publisher || "-"}</p>
                                </div>
                              </div>
                              <span className="text-neutral-500 font-bold underline">詳細 ❯</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          </div>
        )}

        {/* ===================== 本を登録タブ ===================== */}
        {currentTab === "register" && (
          <section className="bg-white p-6 border border-neutral-300 space-y-4 max-w-xl mx-auto">
            <div className="flex justify-between items-center border-b border-neutral-300 pb-3">
              <div>
                <h2 className="text-sm font-bold">＋ 新しい本を登録する</h2>
                <p className="text-[11px] text-neutral-600">ISBN入力または自動取得できます</p>
              </div>
              <button onClick={() => setCurrentTab("home")} className="text-xs font-bold border border-neutral-300 px-2.5 py-1 hover:bg-neutral-100">
                ✕ ホームへ
              </button>
            </div>

            <div className="space-y-2 bg-neutral-50 p-3 border border-neutral-300 text-xs">
              <label className="font-bold block">ISBN (13桁バーコード)</label>
              <div className="flex gap-2">
                <input type="text" placeholder="例: 9784..." value={isbn} onChange={e => setIsbn(e.target.value)} className="w-full border border-neutral-300 bg-white p-2 focus:outline-none font-mono" />
                <button type="button" onClick={fetchBookInfo} disabled={isLoading} className="bg-neutral-900 text-white px-3 py-2 font-bold whitespace-nowrap hover:bg-neutral-800 disabled:opacity-50">
                  {isLoading ? "取得中..." : "自動取得"}
                </button>
              </div>
            </div>

            <form onSubmit={handleRegisterBook} className="space-y-3 text-xs">
              <div>
                <label className="font-bold mb-1 block">タイトル *</label>
                <input type="text" placeholder="タイトル" value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-neutral-300 p-2 bg-white" required />
              </div>
              <div>
                <label className="font-bold mb-1 block">フリガナ（※ひらがな・カタカナで入力するとあかさたな順に並びます）</label>
                <input type="text" placeholder="例: じゅじゅつかいせん" value={kana} onChange={e => setKana(e.target.value)} className="w-full border border-neutral-300 p-2 bg-white" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold mb-1 block">シリーズ名</label>
                  <input type="text" placeholder="シリーズ名" value={series} onChange={e => setSeries(e.target.value)} className="w-full border border-neutral-300 p-2 bg-white" />
                </div>
                <div>
                  <label className="font-bold mb-1 block">出版社</label>
                  <input type="text" placeholder="出版社" value={publisher} onChange={e => setPublisher(e.target.value)} className="w-full border border-neutral-300 p-2 bg-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold mb-1 block">著者名</label>
                  <input type="text" placeholder="著者名" value={author} onChange={e => setAuthor(e.target.value)} className="w-full border border-neutral-300 p-2 bg-white" />
                </div>
                <div>
                  <label className="font-bold mb-1 block">発売日</label>
                  <input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} className="w-full border border-neutral-300 p-2 bg-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold mb-1 block">ステータス</label>
                  <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full border border-neutral-300 p-2 bg-white">
                    <option value="持っている">持っている</option>
                    <option value="欲しい">欲しい</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold mb-1 block">表紙URL</label>
                  <input type="text" placeholder="https://..." value={coverUrl} onChange={e => setCoverUrl(e.target.value)} className="w-full border border-neutral-300 p-2 bg-white" />
                </div>
              </div>

              <div>
                <label className="font-bold mb-1 block">内容・あらすじ・メモ</label>
                <textarea rows={3} placeholder="内容..." value={memo} onChange={e => setMemo(e.target.value)} className="w-full border border-neutral-300 p-2 bg-white resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-300">
                <button type="button" onClick={() => setCurrentTab("home")} className="px-4 py-2 border border-neutral-300 font-bold hover:bg-neutral-100">キャンセル</button>
                <button type="submit" className="px-6 py-2 bg-neutral-900 text-white font-bold hover:bg-neutral-800">登録する</button>
              </div>
            </form>
          </section>
        )}

        {/* ===================== 詳細・編集モーダル ===================== */}
        {selectedBook && (
          <div className="fixed inset-0 bg-neutral-900/50 flex items-center justify-center p-4 z-50 text-xs">
            <div className="bg-white border border-neutral-300 max-w-md w-full p-5 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-neutral-300 pb-2">
                <span className="font-bold text-sm">{selectedBook.title}</span>
                <button onClick={() => setSelectedBook(null)} className="font-bold text-sm border border-neutral-300 px-2 py-0.5 hover:bg-neutral-100">✕</button>
              </div>
              <form onSubmit={updateBook} className="space-y-3">
                <div className="grid grid-cols-2 gap-2 bg-neutral-50 p-3 border border-neutral-300">
                  <div>
                    <label className="text-[10px] font-bold block">登録日（変更可）</label>
                    <input type="date" value={selectedBook.registeredAt} onChange={e => setSelectedBook({ ...selectedBook, registeredAt: e.target.value })} className="w-full border border-neutral-300 p-1 bg-white font-bold text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block">ISBN（変更不可）</label>
                    <input type="text" value={selectedBook.isbn} readOnly className="w-full border border-neutral-300 p-1 bg-neutral-200 font-mono text-neutral-700 text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold mb-1 block">タイトル</label>
                    <input type="text" value={selectedBook.title} onChange={e => setSelectedBook({ ...selectedBook, title: e.target.value })} className="w-full border border-neutral-300 p-2 bg-white" required />
                  </div>
                  <div>
                    <label className="font-bold mb-1 block">フリガナ</label>
                    <input type="text" value={selectedBook.kana} onChange={e => setSelectedBook({ ...selectedBook, kana: e.target.value })} className="w-full border border-neutral-300 p-2 bg-white" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold mb-1 block">出版社</label>
                    <input type="text" value={selectedBook.publisher} onChange={e => setSelectedBook({ ...selectedBook, publisher: e.target.value })} className="w-full border border-neutral-300 p-2 bg-white" />
                  </div>
                  <div>
                    <label className="font-bold mb-1 block">著者名</label>
                    <input type="text" value={selectedBook.author} onChange={e => setSelectedBook({ ...selectedBook, author: e.target.value })} className="w-full border border-neutral-300 p-2 bg-white" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold mb-1 block">発売日</label>
                    <input type="date" value={selectedBook.releaseDate} onChange={e => setSelectedBook({ ...selectedBook, releaseDate: e.target.value })} className="w-full border border-neutral-300 p-2 bg-white" />
                  </div>
                  <div>
                    <label className="font-bold mb-1 block">ステータス</label>
                    <select value={selectedBook.status} onChange={e => setSelectedBook({ ...selectedBook, status: e.target.value as any })} className="w-full border border-neutral-300 p-2 bg-white">
                      <option value="持っている">持っている</option>
                      <option value="欲しい">欲しい</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold mb-1 block">表紙URL</label>
                  <input type="text" value={selectedBook.coverUrl} onChange={e => setSelectedBook({ ...selectedBook, coverUrl: e.target.value })} className="w-full border border-neutral-300 p-2 bg-white" />
                </div>

                <div>
                  <label className="font-bold mb-1 block">内容・あらすじ・メモ</label>
                  <textarea rows={3} value={selectedBook.memo} onChange={e => setSelectedBook({ ...selectedBook, memo: e.target.value })} className="w-full border border-neutral-300 p-2 bg-white resize-none" />
                </div>

                <div className="flex justify-between pt-2 border-t border-neutral-300">
                  <button type="button" onClick={() => deleteBook(selectedBook.id)} className="text-red-600 font-bold hover:underline">削除</button>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSelectedBook(null)} className="px-3 py-1.5 border border-neutral-300 font-bold hover:bg-neutral-100">キャンセル</button>
                    <button type="submit" className="px-4 py-1.5 bg-neutral-900 text-white font-bold hover:bg-neutral-800">保存</button>
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