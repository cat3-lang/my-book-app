import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get("isbn");

  if (!isbn) {
    return NextResponse.json({ success: false, error: "ISBN is required" }, { status: 400 });
  }

  const cleanIsbn = isbn.replace(/[^0-9X]/gi, "").trim();

  try {
    // 1. 国立国会図書館サーチ (NDL OpenSearch API) 【最優先】
    // 正式なエンドポイントURLを使用
    const ndlUrl = `https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${cleanIsbn}`;
    const ndlRes = await fetch(ndlUrl, {
      headers: {
        "User-Agent": "BookManagerApp/1.0 (Family Book Manager)",
      },
    });

    if (ndlRes.ok) {
      const xmlText = await ndlRes.text();

      // 各項目をXMLタグ（名前空間含む）から正規表現で安全に抽出
      const titleMatch = xmlText.match(/<title>(.*?)<\/title>/);
      const creatorMatch = xmlText.match(/<dc:creator>(.*?)<\/dc:creator>/);
      const publisherMatch = xmlText.match(/<dc:publisher>(.*?)<\/dc:publisher>/);
      
      // 発売日: dcterms:issued または dc:date から取得
      const issuedMatch = xmlText.match(/<dcterms:issued[^>]*>(.*?)<\/dcterms:issued>/);
      const dateMatch = xmlText.match(/<dc:date[^>]*>(.*?)<\/dc:date>/);
      const rawDate = (issuedMatch ? issuedMatch[1] : null) || (dateMatch ? dateMatch[1] : null) || "";

      const descMatch = xmlText.match(/<description>(.*?)<\/description>/);

      if (titleMatch && titleMatch[1]) {
        let rawTitle = titleMatch[1]
          .replace(/<\/?[^>]+(>|$)/g, "")
          .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
          .trim();

        // 簡易的な巻数抽出の正規表現
        let extractedVolume = "";
        const volumeMatch = rawTitle.match(/(?:第?\s*(\d+)\s*巻|\(\s*(\d+)\s*\)|\[\s*(\d+)\s*\]|\s+(\d+)\s*$)/);
        if (volumeMatch) {
          extractedVolume = volumeMatch[1] || volumeMatch[2] || volumeMatch[3] || volumeMatch[4];
        }

        // 発売日の整形 (YYYY-MM-DD 形式に統一)
        let formattedDate = "";
        if (rawDate) {
          const digits = rawDate.match(/\d+/g);
          if (digits && digits.length >= 1) {
            const year = digits[0];
            const month = digits[1] ? digits[1].padStart(2, "0") : "01";
            const day = digits[2] ? digits[2].padStart(2, "0") : "01";
            formattedDate = `${year}-${month}-${day}`;
          }
        }

        const cleanCreator = creatorMatch 
          ? creatorMatch[1].replace(/<\/?[^>]+(>|$)/g, "").replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim() 
          : "";
        const cleanPublisher = publisherMatch 
          ? publisherMatch[1].replace(/<\/?[^>]+(>|$)/g, "").replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim() 
          : "";
        const cleanDesc = descMatch 
          ? descMatch[1].replace(/<\/?[^>]+(>|$)/g, "").replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim() 
          : "";

        return NextResponse.json({
          success: true,
          title: rawTitle,
          volume: extractedVolume,
          authors: cleanCreator,
          publisher: cleanPublisher,
          releaseDate: formattedDate,
          summary: cleanDesc,
        });
      }
    }

    // 2. OpenBD API 【フォールバック】
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