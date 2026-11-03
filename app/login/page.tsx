"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Lock, Mail, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg("ログインに失敗しました。メールアドレスまたはパスワードをご確認ください。");
      setLoading(false);
    } else {
      // router.push から window.location.href に変更して確実に本棚へ移動
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans flex items-center justify-center p-4">
      <div className="bg-paper-card border border-paper-border w-full max-w-md p-6 space-y-6 shadow-xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-paper-sub border border-paper-border rounded-full flex items-center justify-center mx-auto text-paper-caramel">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-base font-bold text-paper-text-main">ファミリー本棚 ログイン</h1>
          <p className="text-xs text-paper-text-sub">家族専用のプライベートな空間を守るため、ログインが必要です。</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-paper-text-sub mb-1">メールアドレス</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-paper-text-sub absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-paper-inner border border-paper-border pl-9 pr-3 py-2 text-sm text-paper-text-main"
                placeholder="family@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-paper-text-sub mb-1">パスワード</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-paper-text-sub absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-paper-inner border border-paper-border pl-9 pr-3 py-2 text-sm text-paper-text-main"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-paper-caramel text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:opacity-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>ログインする</span>
          </button>
        </form>
      </div>
    </div>
  );
}