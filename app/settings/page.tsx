"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Download, Upload, FileText, Check, AlertCircle, Loader2, Database, LogOut, LogIn } from "lucide-react";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.0.69";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // 🔒 ログイン状態の確認
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
      setAuthChecking(false);
    };
    checkUser();
  }, []);

  const handleLogout = async () => {
    if (!window.confirm("ログアウトしますか？")) return;
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  // 📤 バックアップ（エクスポート）機能
  const handleExport = async () => {
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const { data, error } = await supabase.from("books").select("*");
      if (error) throw error;

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `books_backup_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setSuccessMessage("バックアップファイルのダウンロードが完了しました！");
    } catch (err: any) {
      setErrorMessage("エクスポートに失敗しました: " + (err.message || "不明なエラー"));
    } finally {
      setLoading(false);
    }
  };

  // 📥 復元（インポート）機能
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("バックアップファイルを読み込んでデータを復元しますか？（既存のデータに上書き・追加されます）")) {
      e.target.value = "";
      return;
    }

    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const importedBooks = JSON.parse(content);

        if (!Array.isArray(importedBooks)) {
          throw new Error("ファイルの形式が正しくありません。");
        }

        for (const book of importedBooks) {
          const { id, created_at, ...bookData } = book;
          const { error } = await supabase.from("books").insert([bookData]);
          if (error) console.error("インポートエラー:", error.message);
        }

        setSuccessMessage("データの復元が完了しました！");
      } catch (err: any) {
        setErrorMessage("インポートに失敗しました: " + (err.message || "ファイルの解析に失敗しました"));
      } finally {
        setLoading(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-paper-bg flex items-center justify-center text-xs text-paper-text-sub font-mono">
        認証確認中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-32 relative">
      <header className="sticky top-0 z-10 bg-paper-card/95 backdrop-blur-md border-b border-paper-border px-3 py-2.5 md:px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1 text-xs font-bold text-paper-text-main bg-paper-sub px-2.5 py-1.5 border border-paper-border hover:bg-paper-border transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>本棚へ戻る</span>
          </Link>
          <h1 className="text-sm font-bold text-paper-text-main">設定・アカウント</h1>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 md:px-6 py-4 space-y-4">
        {successMessage && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-green-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* アカウント管理セクション */}
        <div className="bg-paper-card border border-paper-border p-4 space-y-3 shadow-xs">
          <h2 className="text-xs font-bold text-paper-text-main uppercase tracking-wider border-b border-paper-border pb-2">
            アカウント管理
          </h2>
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-paper-text-main block">現在の状態</span>
              <span className="text-paper-text-sub">
                {isLoggedIn ? "家族アカウントでログイン中" : "ログアウト状態です"}
              </span>
            </div>
            {isLoggedIn ? (
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 bg-paper-danger text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs hover:opacity-90 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>ログアウト</span>
              </button>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-paper-caramel text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs hover:opacity-90 transition"
              >
                <LogIn className="w-4 h-4" />
                <span>ログイン</span>
              </Link>
            )}
          </div>
        </div>

        {/* データ管理（バックアップ・復元）セクション */}
        <div className="bg-paper-card border border-paper-border p-4 space-y-3 shadow-xs">
          <h2 className="text-xs font-bold text-paper-text-main uppercase tracking-wider border-b border-paper-border pb-2 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-paper-caramel" />
            <span>データ管理（バックアップ・復元）</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="font-bold text-paper-text-main block">データのバックアップ</span>
                <span className="text-paper-text-sub">登録した本データをファイル（JSON）として保存します。</span>
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={loading}
                className="px-3.5 py-2 bg-paper-sub hover:bg-paper-border border border-paper-border text-paper-text-main font-bold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-paper-caramel" />}
                <span>エクスポート</span>
              </button>
            </div>

            <div className="pt-3 border-t border-paper-border flex items-center justify-between gap-4">
              <div>
                <span className="font-bold text-paper-text-main block">データの復元</span>
                <span className="text-paper-text-sub">保存したバックアップファイルからデータを読み込みます。</span>
              </div>
              <label className="px-3.5 py-2 bg-paper-sub hover:bg-paper-border border border-paper-border text-paper-text-main font-bold flex items-center gap-1.5 cursor-pointer shrink-0">
                <Upload className="w-4 h-4 text-paper-caramel" />
                <span>インポート</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  disabled={loading}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* アプリ情報セクション */}
        <div className="bg-paper-card border border-paper-border p-4 space-y-3 shadow-xs">
          <h2 className="text-xs font-bold text-paper-text-main uppercase tracking-wider border-b border-paper-border pb-2">
            アプリ情報
          </h2>
          <div className="flex justify-between text-xs">
            <span className="text-paper-text-sub font-bold">バージョン</span>
            <span className="font-mono text-paper-text-main">{APP_VERSION}</span>
          </div>
        </div>
      </main>

      <FooterNav />
    </div>
  );
}