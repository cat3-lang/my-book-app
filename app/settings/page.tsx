"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Download, Upload, RefreshCw, FileText, Check, AlertCircle, Loader2, Database, Info, LogOut, LogIn } from "lucide-react";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.0.68";

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

  if (authChecking) {
    return (
      <div className="min-h-screen bg-paper-bg flex items-center justify-center text-xs text-paper-text-sub font-mono">
        読み込み中...
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
          <div className="w-16"></div> {/* バランス調整 */}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 md:px-6 py-4 space-y-4">
        {/* アカウント・認証セクション */}
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

        {/* その他の設定項目 */}
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