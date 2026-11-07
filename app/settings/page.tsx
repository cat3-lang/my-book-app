"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Settings, BookOpen, User, Shield, Info, PenTool, PenLine, Pencil, Edit3, Notebook, BookMarked, FileText, StickyNote, Heart, Star, Bookmark, Layers } from "lucide-react";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.1.02";

export default function SettingsPage() {
  const [authChecking, setAuthChecking] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
      } else {
        setUserEmail(session.user.email || null);
        setAuthChecking(false);
      }
    };
    checkUser();
  }, []);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-paper-bg flex items-center justify-center text-xs text-paper-text-sub font-mono">
        認証確認中...
      </div>
    );
  }

  // テスト用アイコンのリスト（名前とコンポーネント）
  const testIcons = [
    { name: "PenLine (おすすめ)", icon: PenLine },
    { name: "Notebook (ノート)", icon: Notebook },
    { name: "Pencil (鉛筆)", icon: Pencil },
    { name: "PenTool", icon: PenTool },
    { name: "Edit3 (ペン・編集)", icon: Edit3 },
    { name: "BookMarked (しおり付本)", icon: BookMarked },
    { name: "FileText (書類・メモ)", icon: FileText },
    { name: "StickyNote (付箋)", icon: StickyNote },
    { name: "Heart (ハート)", icon: Heart },
    { name: "Star (スター)", icon: Star },
    { name: "Bookmark (ブックマーク)", icon: Bookmark },
    { name: "Layers (レイヤー)", icon: Layers },
  ];

  return (
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-32 relative">
      <div className="absolute top-1 right-2 z-20 text-[9px] text-paper-text-sub font-mono">
        {APP_VERSION}
      </div>

      <header className="sticky top-0 z-10 bg-paper-card/95 backdrop-blur-md border-b border-paper-border px-3 py-2.5 md:px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-sm font-bold text-paper-text-main flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-paper-caramel" /> 設定
          </h1>
          <span className="text-xs font-mono text-paper-text-sub">
            {userEmail || ""}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* 基本設定セクション */}
        <div className="bg-paper-card border border-paper-border p-4 space-y-4 shadow-xs">
          <h2 className="text-xs font-bold text-paper-text-main uppercase tracking-wider flex items-center gap-1.5 border-b border-paper-border pb-2">
            <Info className="w-3.5 h-3.5 text-paper-caramel" /> アプリ情報
          </h2>
          <div className="text-xs space-y-2 text-paper-text-sub">
            <p><strong>バージョン:</strong> {APP_VERSION}</p>
            <p><strong>テーマ:</strong> Paper Style (紙の質感テーマ)</p>
          </div>
        </div>

        {/* 🧪 アイコンテスト用セクション（ご要望のエリア） */}
        <div className="bg-paper-card border border-paper-border p-4 space-y-4 shadow-xs">
          <h2 className="text-xs font-bold text-paper-text-main uppercase tracking-wider flex items-center gap-1.5 border-b border-paper-border pb-2">
            <Notebook className="w-3.5 h-3.5 text-paper-caramel" /> アイコン見比べテスト用エリア
          </h2>
          <p className="text-[11px] text-paper-text-sub">
            「Bookノート」のタブアイコンに使える候補の一覧です。見栄えや雰囲気をここですべて確認できます。
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
            {testIcons.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <div
                  key={index}
                  className="bg-paper-inner border border-paper-border p-3 flex flex-col items-center justify-center gap-2 rounded hover:bg-paper-sub transition shadow-2xs"
                >
                  <div className="p-2 bg-paper-card border border-paper-border rounded-full text-paper-caramel">
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold text-paper-text-main text-center font-mono">
                    {item.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <FooterNav />
    </div>
  );
}