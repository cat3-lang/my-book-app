import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get("isbn");

  if (!isbn) {
    return NextResponse.json({ success: false, error: "ISBN is required" }, { status: 400 });
  }

  const cleanIsbn = isbn.replace(/[^0-9X]/gi, "").trim();

  try {
    // 1. 国立国会図書館 (NDL API)
    const ndlUrl = `https://iss.ndl.go.jp/api/opensearch?isbn=${cleanIsbn}`;
    const ndlRes = await fetch(ndlUrl, {
      headers: {
        "User-Agent": "BookManagerApp/1.0 (Family Book Manager)",
      },
    });

    if (ndlRes.ok) {
      const xmlText = await ndlRes.text();
      const titleMatch = xmlText.match(/<title>(.*?)<\/title>/);
      const authorMatch = xmlText.match(/<author>(.*?)<\/author>/);
      const publisherMatch = xmlText.match(/<publisher>(.*?)<\/publisher>/);
      const dateMatch = xmlText.match(/<pubDate>(.*?)<\/pubDate>/) || xmlText.match(/<date>(.*?)<\/date>/);
      const descMatch = xmlText.match(/<description>(.*?)<\/description>/);

      if (titleMatch && titleMatch[1]) {
        let rawTitle = titleMatch[1].replace(/<\/?[^>]+(>|$)/g, "").replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1");
        
        // タイトルから巻数の自動抽出 (例: "〇〇 (2巻)" や "〇〇 第2巻" など)
        let extractedVolume = "";
        const volMatch = rawTitle.match(/(?:\/|第)\s*([0-9０-９一二三四五六七八九十]+)\s*巻/) || rawTitle.match(/\[([0-9０-９一二三四五六七八九十]+)巻\]/);
        if (volMatch) {
          extractedVolume = volMatch[1];
        }

        let releaseDate = "";
        if (dateMatch && dateMatch[1]) {
          const raw = dateMatch[1].replace(/[^0-9]/g, "");
          if (raw.length >= 8) {
            releaseDate = `${raw.substring(0, 4)}-${raw.substring(4, 6)}-${raw.substring(6, 8)}`;
          } else if (raw.length === 4) {
            releaseDate = `${raw}-01-01`;
          }
        }

        const cleanAuthor = authorMatch ? authorMatch[1].replace(/<\/?[^>]+(>|$)/g, "").replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1") : "";
        const cleanPublisher = publisherMatch ? publisherMatch[1].replace(/<\/?[^>]+(>|$)/g, "").replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1") : "";
        const cleanDesc = descMatch ? descMatch[1].replace(/<\/?[^>]+(>|$)/g, "").replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1") : "";

        return NextResponse.json({
          success: true,
          title: rawTitle,
          volume: extractedVolume,
          authors: cleanAuthor,
          publisher: cleanPublisher,
          releaseDate: releaseDate,
          summary: cleanDesc,
        });
      }
    }

    // 2. OpenBD (フォールバック)
    const openBdRes = await fetch(`https://api.openbd.jp/v1/get?isbn=${cleanIsbn}`);
    if (openBdRes.ok) {
      const data = await openBdRes.json();
      if (data && data[0] && data[0].summary) {
        const b = data[0].summary;
        let rawPubDate = b.pubdate || "";
        let formattedPubDate = "";
        if (rawPubDate.length === 8) {
          formattedPubDate = `${rawPubDate.substring(0, 4)}-${rawPubDate.substring(4, 6)}-${rawPubDate.substring(6, 8)}`;
        }

        return NextResponse.json({
          success: true,
          title: b.title || "",
          volume: "",
          authors: b.author || "",
          publisher: b.publisher || "",
          releaseDate: formattedPubDate,
          summary: data[0].summary?.gesch || data[0].summary?.description || "",
        });
      }
    }

    return NextResponse.json({ success: false, error: "Book not found" }, { status: 404 });
  } catch (err) {
    console.error("API Route Error:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}