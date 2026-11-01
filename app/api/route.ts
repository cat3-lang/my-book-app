import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get("isbn");

  if (!isbn) {
    return NextResponse.json({ error: "ISBNが指定されていません。" }, { status: 400 });
  }

  const cleanIsbn = isbn.replace(/-/g, "");

  try {
    // 国会図書館 SRU API (DCNDLレコード)
    const url = `https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&query=isbn=%22${cleanIsbn}%22&recordSchema=dcndl`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "BookManagerApp/1.0 (Family Bookshelf)",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `国会図書館APIエラー (Status: ${response.status})` }, { status: response.status });
    }

    const xmlText = await response.text();
    return NextResponse.json({ xmlText });
  } catch (err: any) {
    console.error("API Route Error:", err);
    return NextResponse.json({ error: `通信エラーが発生しました: ${err.message || ""}` }, { status: 500 });
  }
}