"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Download, Upload, ArrowLeft, BookOpen, CheckCircle, AlertCircle, FileSpreadsheet } from "lucide-react";

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 📄 まとめて登録できる見本CSVのダウンロード
  const handleDownloadTemplate = () => {
    const headers = [
      "title",
      "sort_title",
      "volume",
      "series",
      "authors",
      "publisher",
      "isbn",
      "status",
      "summary",
      "memo",
      "release_date",
    ];

    // まとめて登録するための複数冊サンプルデータ
    const sampleRows = [
      [
        "サンプル漫画A",
        "さんぷるまんがえー",
        "1",
        "サンプルシリーズ",
        "著者 太郎",
        "サンプル出版社",
        "9784000000001",
        "持っている",
        "これは1巻のあらすじです。",
        "面白かった",
        "2025-01-01",
      ],
      [
        "サンプル漫画A",
        "さんぷるまんがえー",
        "2",
        "サンプルシリーズ",
        "著者 太郎",
        "サンプル出版社",
        "9784000000002",
        "持っている",
        "これは2巻のあらすじです。",
        "続きも期待",
        "2025-02-01",
      ],
      [
        "サンプル小説B",
        "さんぷるしょうせつびー",
        "1",
        "",
        "作家 次郎",
        "文庫出版",
        "9784000000003",
        "欲しい",
        "今度出る新刊の小説です。",
        "本屋でチェックする",
        "2026-03-10",
      ],
    ];

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...sampleRows.map((row) => row.map((val) => `"${val}"`).join(","))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "book_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 📤 CSV書き出し（エクスポート）
  const handleExportCSV = async () => {
    setExporting(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.from("books").select("*");
      if (error) throw error;

      if (!data || data.length === 0) {
        setMessage({ type: "error", text: "エクスポートするデータがありません。" });
        setExporting(false);
        return;
      }

      const headers = [
        "id",
        "title",
        "sort_title",
        "volume",
        "series",
        "authors",
        "publisher",
        "isbn",
        "status",
        "summary",
        "memo",
        "release_date",
        "created_at",
      ];

      const csvRows = data.map((row) =>
        headers
          .map((header) => {
            const val = row[header] ?? "";
            const escaped = String(val).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      );

      const csvContent = "\uFEFF" + [headers.join(","), ...csvRows].join("\r\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `books_backup_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage({ type: "success", text: `${data.length}件のデータをCSVファイルとして書き出しました！` });
    } catch (err: any) {
      setMessage({ type: "error", text: "エクスポートに失敗しました: " + err.message });
    } finally {
      setExporting(false);
    }
  };

  // 📥 CSV読み込み（インポート）
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== "");

        if (lines.length < 2) {
          throw new Error("有効なCSVデータが見つかりません。");
        }

        const parseCSVLine = (line: string) => {
          const result = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === "," && !inQuotes) {
              result.push(current);
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current);
          return result;
        };

        const headers = parseCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));

        const booksToInsert = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]).map((v) => v.trim().replace(/^"|"$/g, ""));
          if (values.length < headers.length) continue;

          const rowData: any = {};
          headers.forEach((header, index) => {
            const val = values[index];
            if (header !== "id" && header !== "created_at") {
              rowData[header] = val === "" ? null : val;
            }
          });

          if (rowData.title) {
            if (!rowData.status) rowData.status = "持っている";
            if (!rowData.sort_title) rowData.sort_title = rowData.title;
            booksToInsert.push(rowData);
          }
        }

        if (booksToInsert.length === 0) {
          throw new Error("取り込める書籍データがCSV内にありませんでした。");
        }

        const { error } = await supabase.from("books").insert(booksToInsert);
        if (error) throw error;

        setMessage({ type: "success", text: `${booksToInsert.length}件の書籍データを正常に取り込みました！` });
      } catch (err: any) {
        setMessage({ type: "error", text: "インポートに失敗しました: " + err.message });
      } finally {
        setImporting(false);
        e.target.value = "";
      }
    };

    reader.readAsText(file, "UTF-8");
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-28">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800 px-4 py-3 md:px-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-neutral-300 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-sm font-bold tracking-wider text-neutral-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" /> 設定・CSV入出力
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {message && (
          <div
            className={`p-4 rounded border flex items-center gap-3 text-xs ${
              message.type === "success"
                ? "bg-emerald-950/50 border-emerald-800 text-emerald-300"
                : "bg-red-950/50 border-red-800 text-red-300"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 📄 見本CSVダウンロードカード */}
          <div className="bg-neutral-900 border border-neutral-800 p-5 rounded space-y-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-2 mb-1">
                <FileSpreadsheet className="w-4 h-4 text-sky-400" /> 見本ファイルのダウンロード
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed">
                複数冊をまとめて一括登録するためのサンプルデータが入ったCSV見本をダウンロードできます。
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>見本CSVをダウンロード</span>
            </button>
          </div>

          {/* 📤 エクスポートカード */}
          <div className="bg-neutral-900 border border-neutral-800 p-5 rounded space-y-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-2 mb-1">
                <Download className="w-4 h-4 text-emerald-400" /> データのバックアップ
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed">
                登録されているすべての書籍データを現在の状態のままCSVファイルとして書き出します。
              </p>
            </div>
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-neutral-100 text-xs font-bold rounded transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? "書き出し中..." : "バックアップを保存"}</span>
            </button>
          </div>

          {/* 📥 インポートカード */}
          <div className="bg-neutral-900 border border-neutral-800 p-5 rounded space-y-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-2 mb-1">
                <Upload className="w-4 h-4 text-amber-400" /> 一括インポート
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed">
                作成したCSVファイルを選択して、本棚や欲しい本リストへ書籍データを一括で登録します。
              </p>
            </div>
            <label className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-300 text-neutral-950 text-xs font-bold rounded transition cursor-pointer flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              <span>{importing ? "読み込み中..." : "CSVファイルを選択"}</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                disabled={importing}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </main>
    </div>
  );
}