import { NextResponse } from 'next/server';

function extractScopedTag(xml: string, tagName: string): string {
  const safeTagName = tagName.replace(':', '\\:');
  const regex = new RegExp(`<${safeTagName}[^>]*>([^]*?)</${safeTagName}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  
  return match[1]
    .replace(/<!\[CDATA\[([^]*?)\]\]>/g, '$1') .replace(/<\/?[^>]+(>\vert{}$)/g, "")
    .trim();
}

function extractTagContent(xml: string, tagName: string): string {
  return extractScopedTag(xml, tagName);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get('isbn')?.replace(/-/g, '');

  if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) {
    return NextResponse.json({ success: false, error: '不正なISBNコードです。' }, { status: 400 });
  }

  try {
    // ==========================================
    // 1. 国立国会図書館サーチ（NDL）からの取得
    // ==========================================
    const ndlUrl = `https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${isbn}`;
    const ndlResponse = await fetch(ndlUrl, {
      headers: { 'Accept': 'application/xml', 'User-Agent': 'BookManagerApp/1.0' },
      next: { revalidate: 3600 }
    });

    if (!ndlResponse.ok) {
      throw new Error('国立国会図書館APIへのアクセスに失敗しました。');
    }

    const xmlText = await ndlResponse.text();
    const itemMatch = xmlText.match(/<item[^>]*>([^]*?)<\/item>/i);
    
    if (!itemMatch) {
      return NextResponse.json({ success: false, error: '該当する書籍が見つかりませんでした。' });
    }
    const itemXml = itemMatch[1];

    let title = extractTagContent(itemXml, 'title');
    title = title.replace(/\s*-\s*国立国会図書館サーチ.*/i, '').trim();

    let volumeTitle = extractScopedTag(itemXml, 'dcndl:volumeTitle') || '';
    let volume = extractScopedTag(itemXml, 'dcndl:volume') || '';

    if (!volume) {
      const volumeMatch = title.match(/(?:第\s*(\d+)\s*巻|[\[〔（\(](\d+)[\]〕）\)]|vol\.?\s*(\d+)|\b(\d+)\s*巻)/i);
      if (volumeMatch) {
        volume = volumeMatch[1] || volumeMatch[2] || volumeMatch[3] || volumeMatch[4];
        title = title.replace(/(?:第\s*\d+\s*巻|[\[〔（\(]\d+[\]〕）\)]|vol\.?\s*\d+|\b\d+\s*巻)/i, '').trim();
      }
    }

    if (volumeTitle && Array.from(volumeTitle).some(c => !"0123456789０１２３４５６７８９".includes(c))) {
      if (title.includes(volumeTitle)) {
        title = title.replace(volumeTitle, '').trim();
      }
      title = `${title} 〜${volumeTitle}〜`;
    }

    let sortTitle = extractScopedTag(itemXml, 'dcndl:titleTranscription') || extractScopedTag(itemXml, 'titleTranscription') || title;
    sortTitle = sortTitle.replace(/[\s ]+[ア-ン0-9０-９]+\s*$/, '').trim();

    let series = extractScopedTag(itemXml, 'dcndl:seriesTitle') || extractScopedTag(itemXml, 'seriesTitle');
    if (!series) {
      const seriesMatch = title.match(/^[【\[(](.+?)[】\])]/);
      if (seriesMatch) series = seriesMatch[1];
    }

    let authors = extractScopedTag(itemXml, 'dc:creator') || extractScopedTag(itemXml, 'author');
    authors = authors.replace(/,\s*/g, ' ').replace(/\s*[著]\s*/g, '').trim();

    const publisher = extractScopedTag(itemXml, 'dc:publisher') || extractScopedTag(itemXml, 'publisher');

    let releaseDate = extractScopedTag(itemXml, 'dc:date') || extractScopedTag(itemXml, 'dcterms:issued') || extractScopedTag(itemXml, 'pubDate');
    releaseDate = releaseDate.replace(/[.\/]/g, '-');
    if (/^\d{4}-\d{2}$/.test(releaseDate)) releaseDate += '-01';
    if (/^\d{4}$/.test(releaseDate)) releaseDate += '-01-01';


    // ==========================================
    // 2. あらすじの救出（Google Books API の相乗り）
    // ==========================================
    let summary = '';
    const ndlDesc = extractScopedTag(itemXml, 'description');
    
    if (ndlDesc && !ndlDesc.includes("タイトル：") && !ndlDesc.includes("責任表示：") && ndlDesc.length > 20) {
      summary = ndlDesc;
    } else {
      summary = extractScopedTag(itemXml, 'dcndl:abstract');
    }

    if (!summary || summary.length < 15 || summary.includes("：")) {
      try {
        const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
        const googleResponse = await fetch(googleUrl, { next: { revalidate: 3600 } });
        
        if (googleResponse.ok) {
          const googleData = await googleResponse.json();
          if (googleData.items && googleData.items[0]?.volumeInfo?.description) {
            summary = googleData.items[0].volumeInfo.description;
          }
        }
      } catch (gError) {
        console.error('Google Books API Fetch Error:', gError);
      }
    }

    summary = summary.replace(/<\/?[^>]+(>|$)/g, "").trim();

    return NextResponse.json({
      success: true,
      title,
      sortTitle,
      volume,
      series,
      authors,
      publisher,
      releaseDate,
      summary: summary || "あらすじ情報はありません"
    });

  } catch (error: any) {
    console.error('Book fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}