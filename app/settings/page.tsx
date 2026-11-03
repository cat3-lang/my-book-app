"use client";

import React, { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Download, Upload, RefreshCw, FileText, Check, AlertCircle, Loader2, Database, Info } from "lucide-react";
import FooterNav from "@/components/FooterNav";

const APP_VERSION = "v1.0.68";

// CSVヘッダーに rating と location を追加
const CSV_HEADER = "isbn,title,sub_title,sort_title,volume,series,authors,publisher,release_date,status,created_at,memo,rating,location";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleDownloadSampleCsv = () => {
    const sampleRows = [
      CSV_HEADER,
      '9784800272829,転生して田舎でスローライフをおくりたい,王都で貴族交流会,テンセイシテイナカデスローライフオクリタイ,3,宝島社,錬金王,宝島社,2017-07,持っている,2026-11-03,サンプルデータ,5,リビング本棚 A-1'
    ].join("\n");

    const blob = new Blob(["\uFEFF" + sampleRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "book_manager_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportBackup = async () => {
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data: books, error } = await supabase
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!books || books.length === 0) {
        setErrorMessage("エクスポートする書籍データがありません。");
        setLoading(false);
        return;
      }

      const rows = books.map((b) => {
        const escape = (str: any) => {
          if (str === null || str === undefined) return "";
          const s = String(str).replace(/"/g, '""');
          return `"${s}"`;
        };
        return [
          escape(b.isbn),
          escape(b.title),
          escape(b.sub_title),
          escape(b.sort_title),
          escape(b.volume),
          escape(b.series),
          escape(b.authors),
          escape(b.publisher),
          escape(b.release_date),
          escape(b.status),
          escape(b.created_at ? new Date(b.created_at).toISOString().split("T")[0] : ""),
          escape(b.memo),
          escape(b.rating ?? 0),
          escape(b.location)
        ].join(",");
      });

      const csvContent = [CSV_HEADER, ...rows].join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const today = new Date().toISOString().split("T")[0];
      link.href = url;
      link.setAttribute("download", `book_backup_${today}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMessage(`全 ${books.length} 件のデータをエクスポートしました。`);
    } catch (err: any) {
      setErrorMessage(`エクスポートエラー: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>, mode: "append" | "restore") => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (mode === "restore") {
      const confirmRestore = window.confirm("⚠️ 【注意】現在の全データを削除し、バックアップファイルで置き換えます。よろしいですか？");
      if (!confirmRestore) {
        event.target.value = "";
        return;
      }
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== "");
        if (lines.length <= 1) {
          throw new Error("CSVファイルにデータが含まれていません。");
        }

        const parseCsvLine = (line: string) => {
          const result = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' && (i === 0 || line[i - 1] !== "\\")) {
              inQuotes = !inQuotes;
            } else if (char === "," && !inQuotes) {
              result.push(current.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
          return result;
        };

        const records = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]);
          if (!cols[1]) continue;

          records.push({
            isbn: cols[0] || null,
            title: cols[1],
            sub_title: cols[2] || null,
            sort_title: cols[3] || cols[1],
            volume: cols[4] || null,
            series: cols[5] || null,
            authors: cols[6] || null,
            publisher: cols[7] || null,
            release_date: cols[8] || null,
            status: cols[9] === "欲しい" ? "欲しい" : "持っている",
            created_at: cols[10] ? new Date(cols[10]).toISOString() : new Date().toISOString(),
            memo: cols[11] || null,
            rating: cols[12] ? parseInt(cols[12], 10) : 0,
            location: cols[13] || null,
          });
        }

        if (records.length === 0) {
          throw new Error("有効なデータが見つかりませんでした。");
        }

        if (mode === "restore") {
          const { error: deleteErr } = await supabase.from("books").delete().neq("id", "00000000-0000-0000-0000-000000000000");
          if (deleteErr) throw deleteErr;
        }

        const { error: insertErr } = await supabase.from("books").insert(records);
        if (insertErr) throw insertErr;

        setSuccessMessage(
          mode === "restore"
            ? `全データをクリアし、${records.length} 件のデータを復元しました！`
            : `${records.length} 件のデータを新規インポートしました！`
        );
      } catch (err: any) {
        setErrorMessage(`インポート失敗: ${err.message}`);
      } finally {
        setLoading(false);
        event.target.value = "";
      }
    };

    reader.readAsText(file, "UTF-8");
  };

  return (
    <div className="min-h-screen bg-paper-bg text-paper-text-body font-sans pb-32">
      <header className="sticky top-0 z-10 bg-paper-card/95 backdrop-blur-md border-b border-paper-border px-4 py-3 md:px-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold text-paper-text-main bg-paper-sub px-3 py-1.5 border border-paper-border hover:bg-paper-border transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>本棚に戻る</span>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-wider text-paper-text-main">設定・データ管理</h1>
            <span className="text-[10px] bg-paper-sub text-paper-text-sub px-1.5 py-0.5 font-mono border border-paper-border">
              {APP_VERSION}
            </span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 md:px-8 space-y-6">
        {successMessage && (
          <div className="p-3 bg-[#E6F4EA] border border-[#A8DADC] text-[#1D3557] text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-[#2A9D8F] shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-[#F8D7DA] border border-[#F5C6CB] text-[#721C24] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. バックアップ＆ダウンロード */}
        <section className="bg-paper-card border border-paper-border p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold text-paper-text-main uppercase tracking-wider flex items-center gap-1.5 border-b border-paper-border pb-2">
            <Database className="w-3.5 h-3.5 text-paper-caramel" /> データのエクスポート
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-paper-text-sub mb-2">現在の蔵書データをCSVファイルとして一括保存します。</p>
              <button
                type="button"
                onClick={handleExportBackup}
                disabled={loading}
                className="w-full py-2.5 bg-paper-caramel text-white text-xs font-bold hover:opacity-95 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>全データ一括バックアップ</span>
              </button>
            </div>
            <div>
              <p className="text-xs text-paper-text-sub mb-2">インポート作成用のフォーマット例（CSV）を取得します。</p>
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="w-full py-2.5 bg-paper-sub hover:bg-paper-border text-paper-text-main text-xs font-bold border border-paper-border transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-paper-caramel" />
                <span>見本ファイルのダウンロード</span>
              </button>
            </div>
          </div>
        </section>

        {/* 2. インポート（2種類） */}
        <section className="bg-paper-card border border-paper-border p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold text-paper-text-main uppercase tracking-wider flex items-center gap-1.5 border-b border-paper-border pb-2">
            <Upload className="w-3.5 h-3.5 text-paper-caramel" /> データのインポート
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-paper-border p-3.5 bg-paper-inner space-y-2">
              <h3 className="text-xs font-bold text-paper-text-main">① 追加用インポート</h3>
              <p className="text-[11px] text-paper-text-sub leading-relaxed">
                既存のデータを残したまま、新しい本をCSVファイルからまとめて登録します。
              </p>
              <label className="block mt-2">
                <span className="w-full py-2 bg-paper-sub hover:bg-paper-border text-paper-text-main text-xs font-bold border border-paper-border transition flex items-center justify-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-paper-caramel" /> 追加CSVを選択
                </span>
                <input
                  type="file"
                  accept=".csv"
                  disabled={loading}
                  onChange={(e) => handleImportCsv(e, "append")}
                  className="hidden"
                />
              </label>
            </div>

            <div className="border border-paper-border p-3.5 bg-paper-inner space-y-2">
              <h3 className="text-xs font-bold text-[#8C4A4A]">② バックアップ復元インポート</h3>
              <p className="text-[11px] text-paper-text-sub leading-relaxed">
                全データを一度クリアして、過去のバックアップCSVファイルの状態に丸ごと復元します。
              </p>
              <label className="block mt-2">
                <span className="w-full py-2 bg-[#8C4A4A] text-white hover:opacity-90 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" /> 復元CSVを選択
                </span>
                <input
                  type="file"
                  accept=".csv"
                  disabled={loading}
                  onChange={(e) => handleImportCsv(e, "restore")}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="bg-paper-card border border-paper-border p-5 space-y-2 shadow-sm">
          <h2 className="text-xs font-bold text-paper-text-main uppercase tracking-wider flex items-center gap-1.5 border-b border-paper-border pb-2">
            <Info className="w-3.5 h-3.5 text-paper-caramel" /> 今後の改善メモ（未実装リスト）
          </h2>
          <ul className="text-xs text-paper-text-sub space-y-1 list-disc list-inside pt-1">
            <li>国立国会図書館APIからの「その他タイトル（サブタイトル）」のより精度の高い抽出・自動補完ロジックの再調整</li>
          </ul>
        </section>
      </main>

      <FooterNav />
    </div>
  );
}