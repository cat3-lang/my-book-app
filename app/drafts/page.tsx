"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Trash2, Save, Search, Loader2, Check, Star, ZoomIn, X, Edit3 } from "lucide-react";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.0.99";

type DraftBook = {
  id: string;
  isbn: string | null;
  title: string;
  sub_title: string | null;
  sort_title: string | null;
  volume: string | null;
  series: string | null;
  authors: string | null;
  publisher: string | null;
  release_date: string | null;
  status: "持っている" | "欲しい";
  memo: string | null;
  registered_date: string;
  rating?: number | null;
  location?: string | null;
  image_url?: string | null;
  created_at: string;
  fetching?: boolean;
  fetchMessage?: string;
};

export default function DraftsPage() {
  const [authChecking, setAuthChecking] = useState(true);
  const [drafts, setDrafts] = useState<DraftBook[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [existingLocations, setExistingLocations] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DraftBook>>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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

  useEffect(() => {
    if (!authChecking) {
      loadDrafts();
      fetchLocations();
    }
  }, [authChecking]);

  const loadDrafts = () => {
    try {
      const stored = localStorage.getItem("book_drafts");
      if (stored) {
        setDrafts(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load drafts", e);
    }
  };

  const saveDraftsToStorage = (newDrafts: DraftBook[]) => {
    setDrafts(newDrafts);
    localStorage.setItem("book_drafts", JSON.stringify(newDrafts));
  };

  const fetchLocations = async () => {
    const { data } = await supabase.from("books").select("location");
    if (data) {
      const uniqueLocs = Array.from(new Set(data.map(b => b.location).filter(Boolean))) as string[];
      setExistingLocations(uniqueLocs);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-paper-bg flex items-center justify-center text-xs text-paper-text-sub font-mono">
        認証確認中...
      </div>
    );
  }

  // 個別の全自動取得
  const handleAutoFetchSingle = async (id: string, isbnStr: string | null) => {
    if (!isbnStr) {
      alert("ISBNが入力されていません。");
      return;
    }

    setDrafts(drafts.map(d => d.id === id ? { ...d, fetching: true, fetchMessage: "" } : d));

    try {
      const res = await fetch(`/api/book-fetch?isbn=${isbnStr.trim()}`);
      const data = await res.json();

      if (data && data.success) {
        setDrafts(prev => prev.map(d => {
          if (d.id === id) {
            return {
              ...d,
              title: data.title || d.title,
              sub_title: data.subTitle || d.sub_title,
              sort_title: data.sortTitle || d.sort_title || data.title || d.title,
              volume: data.volume || d.volume,
              series: data.series || d.series,
              authors: data.authors || d.authors,
              publisher: data.publisher || d.publisher,
              release_date: data.releaseDate || d.release_date,
              fetching: false,
              fetchMessage: "✅ 取得完了",
            };
          }
          return d;
        }));
      } else {
        setDrafts(prev => prev.map(d => d.id === id ? { ...d, fetching: false, fetchMessage: "❌ データなし" } : d));
      }
    } catch (err) {
      setDrafts(prev => prev.map(d => d.id === id ? { ...d, fetching: false, fetchMessage: "❌ エラー" } : d));
    }
  };

  // チェックボックス全選択/解除
  const toggleSelectAll = () => {
    if (selectedIds.length === drafts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(drafts.map(d => d.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  // 1冊を本棚（Supabase）へ登録（ステータスは「持っている」に変更）
  const registerDraftToMain = async (draft: DraftBook) => {
    const { error } = await supabase.from("books").insert([
      {
        isbn: draft.isbn || null,
        title: draft.title.trim(),
        sub_title: draft.sub_title || null,
        sort_title: draft.sort_title || draft.title,
        volume: draft.volume || null,
        series: draft.series || null,
        authors: draft.authors || null,
        publisher: draft.publisher || null,
        release_date: draft.release_date || null,
        status: "持っている", // 本棚に入れるため「持っている」へ強制変更
        created_at: draft.registered_date ? new Date(draft.registered_date).toISOString() : new Date().toISOString(),
        memo: draft.memo || null,
        rating: draft.rating || 0,
        location: draft.location || null,
        image_url: draft.image_url || null,
      },
    ]);
    return { error, title: draft.title };
  };

  // 個別登録
  const handleRegisterSingle = async (draft: DraftBook) => {
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await registerDraftToMain(draft);
    if (error) {
      alert(`登録失敗: ${error.message}`);
    } else {
      const updated = drafts.filter(d => d.id !== draft.id);
      saveDraftsToStorage(updated);
      setSelectedIds(prev => prev.filter(id => id !== draft.id));
      setSuccessMessage(`「${draft.title}」を本棚に登録しました！`);
    }
  };

  // チェックした本を一括登録
  const handleRegisterSelected = async () => {
    if (selectedIds.length === 0) {
      alert("登録する本にチェックを入れてください。");
      return;
    }
    if (!window.confirm(`選択した ${selectedIds.length}冊 を本棚に登録しますか？`)) return;

    setErrorMessage("");
    setSuccessMessage("");
    const targetDrafts = drafts.filter(d => selectedIds.includes(d.id));
    let successCount = 0;

    for (const draft of targetDrafts) {
      const { error } = await registerDraftToMain(draft);
      if (!error) {
        successCount++;
      }
    }

    const updated = drafts.filter(d => !selectedIds.includes(d.id));
    saveDraftsToStorage(updated);
    setSelectedIds([]);
    setSuccessMessage(`${successCount}冊 を本棚に登録しました！`);
  };

  const handleDeleteDraft = (id: string) => {
    if (!window.confirm("この待機データを削除しますか？")) return;
    const updated = drafts.filter(d => d.id !== id);
    saveDraftsToStorage(updated);
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const startEditing = (draft: DraftBook) => {
    setEditingId(draft.id);
    setEditForm({ ...draft });
  };

  const saveEdit = (id: string) => {
    const updated = drafts.map(d => d.id === id ? { ...d, ...editForm } as DraftBook : d);
    saveDraftsToStorage(updated);
    setEditingId(null);
  };

  return (
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-32 relative">
      <header className="sticky top-0 z-10 bg-paper-card/95 backdrop-blur-md border-b border-paper-border px-4 py-3 md:px-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/add"
            className="flex items-center gap-1.5 text-xs font-bold text-paper-text-main bg-paper-sub px-3 py-1.5 border border-paper-border hover:bg-paper-border transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>登録画面に戻る</span>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-wider text-paper-text-main">登録待機リスト</h1>
            <span className="text-[10px] bg-paper-sub text-paper-text-sub px-1.5 py-0.5 font-mono border border-paper-border">
              {APP_VERSION}
            </span>
          </div>
          <div className="text-xs font-mono font-bold text-paper-caramel bg-paper-sub px-2 py-1 border border-paper-border">
            {drafts.length} 冊
          </div>
        </div>
      </header>

      {/* 🖼️ 画像プレビューモーダル */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4" onClick={() => setPreviewImageUrl(null)}>
          <div className="relative max-w-lg w-full bg-paper-card p-2 rounded-lg border border-paper-border space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-2">
              <h3 className="text-xs font-bold text-paper-text-main">表紙プレビュー</h3>
              <button type="button" onClick={() => setPreviewImageUrl(null)} className="p-1 text-paper-text-sub hover:text-paper-text-main cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="w-full max-h-[70vh] overflow-hidden flex items-center justify-center bg-black">
              <img src={previewImageUrl} alt="拡大プレビュー" className="max-w-full max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {successMessage && (
          <div className="p-3 bg-[#E6F4EA] border border-[#A8DADC] text-[#1D3557] text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-[#2A9D8F]" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 選択一括登録ヘッダー */}
        {drafts.length > 0 && (
          <div className="bg-paper-card border border-paper-border p-3 flex items-center justify-between shadow-xs">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.length === drafts.length && drafts.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-paper-caramel cursor-pointer"
              />
              <span>すべて選択 ({selectedIds.length}/{drafts.length})</span>
            </label>

            <button
              type="button"
              onClick={handleRegisterSelected}
              disabled={selectedIds.length === 0}
              className="px-5 py-2 bg-paper-caramel text-white text-xs font-bold hover:opacity-95 transition cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" />
              <span>選択した本を登録</span>
            </button>
          </div>
        )}

        {drafts.length === 0 ? (
          <div className="text-center py-16 space-y-3 bg-paper-card border border-paper-border">
            <p className="text-xs text-paper-text-sub">待機リストに本はありません</p>
            <Link
              href="/add"
              className="inline-block text-xs font-bold text-white bg-paper-caramel px-4 py-2 hover:opacity-90 transition"
            >
              本を登録する
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((draft) => {
              const isEditing = editingId === draft.id;
              const isChecked = selectedIds.includes(draft.id);

              return (
                <div key={draft.id} className="bg-paper-card border border-paper-border p-3.5 space-y-3 shadow-xs text-xs">
                  {isEditing ? (
                    /* 編集モード（星・置き場所・シリーズを追加） */
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
                          <label className="text-[10px] text-paper-text-sub block font-bold">フリガナ</label>
                          <input
                            type="text"
                            value={editForm.sort_title || ""}
                            onChange={(e) => setEditForm({ ...editForm, sort_title: e.target.value })}
                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-paper-text-sub block font-bold">巻数</label>
                          <input
                            type="text"
                            value={editForm.volume || ""}
                            onChange={(e) => setEditForm({ ...editForm, volume: e.target.value })}
                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-paper-text-sub block font-bold">シリーズ名</label>
                          <input
                            type="text"
                            value={editForm.series || ""}
                            onChange={(e) => setEditForm({ ...editForm, series: e.target.value })}
                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-paper-text-sub block font-bold">著者</label>
                          <input
                            type="text"
                            value={editForm.authors || ""}
                            onChange={(e) => setEditForm({ ...editForm, authors: e.target.value })}
                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-paper-text-sub block font-bold">発行所</label>
                          <input
                            type="text"
                            value={editForm.publisher || ""}
                            onChange={(e) => setEditForm({ ...editForm, publisher: e.target.value })}
                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-paper-text-sub block font-bold">置き場所</label>
                          <input
                            type="text"
                            list="draft-loc-list"
                            value={editForm.location || ""}
                            onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                            className="bg-white border border-paper-border px-2 py-1 text-xs text-paper-text-main w-full"
                          />
                          <datalist id="draft-loc-list">
                            {existingLocations.map((loc) => (
                              <option key={loc} value={loc} />
                            ))}
                          </datalist>
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
                          onClick={() => saveEdit(draft.id)}
                          className="px-3 py-1 bg-paper-caramel text-white font-bold cursor-pointer"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 通常カード表示 */
                    <>
                      <div className="flex items-start gap-3">
                        {/* チェックボックス */}
                        <div className="pt-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(draft.id)}
                            className="w-4 h-4 accent-paper-caramel cursor-pointer"
                          />
                        </div>

                        {/* 本の縦長プレビューサムネイル（400:566） */}
                        <div 
                          className="w-12 aspect-[400/566] border border-paper-border bg-paper-inner shrink-0 overflow-hidden flex items-center justify-center cursor-pointer relative group"
                          onClick={() => draft.image_url && setPreviewImageUrl(draft.image_url)}
                        >
                          {draft.image_url ? (
                            <img src={draft.image_url} alt="表紙" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[8px] text-paper-text-sub text-center px-0.5">画像なし</span>
                          )}
                          {draft.image_url && (
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <ZoomIn className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        {/* 書籍情報 */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {draft.volume && (
                              <span className="bg-paper-caramel/10 text-paper-caramel px-1.5 py-0.5 font-bold text-[11px]">
                                {draft.volume}巻
                              </span>
                            )}
                            <span className="text-[11px] text-paper-text-sub font-mono">
                              ISBN: {draft.isbn || "なし"}
                            </span>
                            {/* 星表示 */}
                            {(draft.rating || 0) > 0 && (
                              <div className="flex items-center">
                                {[1, 2, 3].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-3 h-3 ${
                                      (draft.rating || 0) >= star ? "fill-amber-400 text-amber-500" : "text-gray-300"
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          <h2 className="font-bold text-sm text-paper-text-main truncate">
                            {draft.title}
                          </h2>

                          <p className="text-[11px] text-paper-text-sub truncate">
                            著者: {draft.authors || "ー"} / 発行所: {draft.publisher || "ー"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(draft.id)}
                          className="text-paper-text-sub hover:text-red-600 p-1 cursor-pointer"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {draft.fetchMessage && (
                        <div className="text-[11px] font-bold text-paper-caramel px-1">
                          {draft.fetchMessage}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-paper-border flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAutoFetchSingle(draft.id, draft.isbn)}
                            disabled={draft.fetching}
                            className="px-2.5 py-1 bg-paper-sub hover:bg-paper-border border border-paper-border text-xs font-bold cursor-pointer flex items-center gap-1"
                          >
                            {draft.fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3 text-paper-caramel" />}
                            <span>自動取得</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => startEditing(draft)}
                            className="px-2.5 py-1 bg-paper-sub hover:bg-paper-border border border-paper-border text-xs font-bold cursor-pointer flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3 text-paper-caramel" />
                            <span>編集</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRegisterSingle(draft)}
                          className="px-4 py-1.5 bg-paper-caramel text-white font-bold text-xs shadow-xs hover:opacity-95 cursor-pointer flex items-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>登録</span>
                        </button>
                      </div>
                    </>
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