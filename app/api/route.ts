import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get("isbn");

  if (!isbn) {
    return NextResponse.json({ error: "ISBNが指定されていません。" }, { status: 400 });
  }

  const cleanIsbn = isbn.replace(/-/g, "");

  try {
    const url = `https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&query=isbn=${cleanIsbn}&recordSchema=dcndl`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "BookManagerApp/1.0 (Family Bookshelf)",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `国会図書館APIエラー (Status: ${response.status})` }, { status: response.status });
    }

    const xmlText = await response.text();

    // XMLから主要なデータを安全に抽出
    const extractTag = (tag: string) => {
      const match = xmlText.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, "s"));
      return match ? match[1].replace(/<[^>]+>/g, "").trim() : "";
    };

    const titleMatch = xmlText.match(/<dc:title[^>]*transcription="([^"]*)"[^>]*>(.*?)<\/dc:title>/s);
    const title = titleMatch ? titleMatch[2].replace(/<[^>]+>/g, "").trim() : extractTag("dc:title");
    const titleTranscription = titleMatch ? titleMatch[1].trim() : "";

    const seriesTitle = extractTag("dcndl:seriesTitle");
    const creator = extractTag("dc:creator").replace(/\s*(著|編|監修|絵|原作|著書).*$/, "").trim();
    const publisher = extractTag("dcterms:publisher").replace(/\s*\(.*?\)/g, "").trim();

    const idMatches = Array.from(xmlText.matchAll(/<dc:identifier[^>]*>(.*?)<\/dc:identifier>/g));
    let ndlUrl = "";
    for (const m of idMatches) {
      if (m[1].startsWith("http://") || m[1].startsWith("https://")) {
        ndlUrl = m[1].trim();
        break;
      }
    }

    if (!title && !creator) {
      return NextResponse.json({ error: "該当する書籍が見つかりませんでした。" }, { status: 404 });
    }

    return NextResponse.json({
      title,
      titleTranscription,
      seriesTitle,
      creator,
      publisher,
      ndlUrl,
    });

  } catch (err: any) {
    console.error("API Route Error:", err);
    return NextResponse.json({ error: `通信エラーが発生しました: ${err.message || ""}` }, { status: 500 });
  }
}