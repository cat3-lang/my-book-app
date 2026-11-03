import { NextResponse } from 'next/server';

// コロンを含むタグ（例: dcndl:volumeTitle など）を安全に抽出するヘルパー関数
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
    // 正しい国立国会図書館サーチのOpenSearch APIエンドポイント
    const ndlUrl = `https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${isbn}`;
    const response = await fetch(ndlUrl, {
      headers: { 'Accept': 'application/xml', 'User-Agent': 'BookManagerApp/1.0' },
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      throw new Error('国立国会図書館APIへのアクセスに失敗しました。');
    }

    const xmlText = await response.text();

    const itemMatch = xmlText.match(/<item[^>]*>([^]*?)<\/item>/i);
    if (!itemMatch) {
      return NextResponse.json({ success: false, error: '該当する書籍が見つかりませんでした。' });
    }
    const itemXml = itemMatch[1];

    // --- 1. タイトル ＆ 8. 巻数（2段構えの連動補正ロジック） ---
    let title = extractTagContent(itemXml, 'title');
    title = title.replace(/\s*-\s*国立国会図書館サーチ.*/i, '').trim();

    let volume = extractScopedTag(itemXml, 'dcndl:volumeTitle') || extractScopedTag(itemXml, 'dcndl:volume') || '';

    if (!volume) {
      const joinedVolumeMatch = title.match(/[\s ]+(\d+)\s*$/);
      if (joinedVolumeMatch) {
        volume = joinedVolumeMatch[1];
        title = title.replace(/[\s ]+(\d+)\s*$/, '').trim();
      } else {
        const volumeMatch = title.match(/(?:第\s*(\d+)\s*巻|[\((](\d+)[\))]|vol\.?\s*(\d+)|\b(\d+)\s*巻)/i);
        if (volumeMatch) {
          volume = volumeMatch[1] || volumeMatch[2] || volumeMatch[3] || volumeMatch[4];
        }
      }
    }

    // 2. フリガナ（タイトル読み）
    let sortTitle = extractScopedTag(itemXml, 'dcndl:titleTranscription') || extractScopedTag(itemXml, 'titleTranscription') || title;
    sortTitle = sortTitle.replace(/[\s ]+[ア-ン0-9０-９]+\s*$/, '').trim();

    // 3. シリーズ名
    let series = extractScopedTag(itemXml, 'dcndl:seriesTitle') || extractScopedTag(itemXml, 'seriesTitle');
    if (!series) {
      const seriesMatch = title.match(/^[【\[(](.+?)[】\])]/);
      if (seriesMatch) series = seriesMatch[1];
    }

    // 4. 著者名
    let authors = extractScopedTag(itemXml, 'dc:creator') || extractScopedTag(itemXml, 'author');
    authors = authors.replace(/,\s*/g, ' ').replace(/\s*[著]\s*/g, '').trim();

    // 5. 発行社
    const publisher = extractScopedTag(itemXml, 'dc:publisher') || extractScopedTag(itemXml, 'publisher');

    // 6. あらすじ (description)
    let summary = extractScopedTag(itemXml, 'description');
    if (summary.includes("タイトル：") || summary.includes("責任表示：") || summary.includes("タイトル:") || summary.includes("責任表示:")) {
      const cleanDescParts = summary.split(/タイトル：|責任表示：|タイトル:|責任表示:|概要：|概要:|NDC/);
      summary = cleanDescParts[0].trim();
    }
    if (!summary || summary.length < 5) {
      summary = extractScopedTag(itemXml, 'dcndl:abstract') || summary;
    }

    // 7. 発売日
    let releaseDate = extractScopedTag(itemXml, 'dc:date');
    if (!releaseDate) releaseDate = extractScopedTag(itemXml, 'dcterms:issued');
    if (!releaseDate) releaseDate = extractScopedTag(itemXml, 'pubDate');
    releaseDate = releaseDate.replace(/[.\/]/g, '-');
    if (/^\d{4}-\d{2}$/.test(releaseDate)) releaseDate += '-01';
    if (/^\d{4}$/.test(releaseDate)) releaseDate += '-01-01';

    return NextResponse.json({
      success: true,
      title,
      sortTitle,
      volume,
      series,
      authors,
      publisher,
      releaseDate,
      summary
    });

  } catch (error: any) {
    console.error('Book fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}