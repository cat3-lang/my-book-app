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
    
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: "国会図書館APIとの通信に失敗しました。" }, { status: response.status });
    }

    const xmlText = await response.text();
    
    // サーバー側（Node.js環境）でXMLをパースするために、DOMParserの代わりに正規表現や軽量な抽出処理、
    // あるいは簡易的にxmlTextをそのまま返すか、必要な項目を正規表現やパース用ライブラリで抽出します。
    // 今回は安全にXML文字列をそのまま返し、ブラウザ側（DOMParser）で解析する形にします。

    return NextResponse.json({ xmlText });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "サーバー内部でエラーが発生しました。" }, { status: 500 });
  }
}