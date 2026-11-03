import { NextResponse } from 'next/server';

function extractScopedTag(xml: string, tagName: string): string {
  const safeTagName = tagName.replace(':', '\\:');
  const regex = new RegExp(`<${safeTagName}[^>]*>([^]*?)</${safeTagName}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  
  return match[1]
    .replace(/<!\[CDATA\[([^]*?)\]\]>/g, '$1')
    .replace(/<\/?[^>]+(>|$)/g, "")
    .trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get('isbn')?.replace(/-/g, '');

  if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) {
    return NextResponse.json({ success: false, error: '不正なISBNコードです。' }, { status: 400 });
  }

  try {
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

    let title = extractScopedTag(itemXml, 'title');
    title = title.replace(/\s*-\s*国立国会図書館サーチ.*/i, '').trim();

    // 巻数の抽出
    let volume = extractScopedTag(itemXml, 'dcndl:volumeTitle') || extractScopedTag(itemXml, 'dcndl:volume') || '';
    if (!volume) {
      const volumeMatch = title.match(/(?:第\s*(\d+)\s*巻|[\[〔（\(](\d+)[\]〕）\)]|vol\.?\s*(\d+)|\b(\d+)\s*巻)/i);
      if (volumeMatch) {
        volume = volumeMatch[1] || volumeMatch[2] || volumeMatch[3] || volumeMatch[4];
        title = title.replace(/(?:第\s*\d+\s*巻|[\[〔（\(]\d+[\]〕）\)]|vol\.?\s*\d+|\b\d+\s*巻)/i, '').trim();
      }
    }
    if (!volume) {
      volume = '1（単）';
    }

    // サブタイトル（その他のタイトル：専用タグの値だけをそのまま取得）
    const subTitle = extractScopedTag(itemXml, 'dcndl:alternative') || 
                     extractScopedTag(itemXml, 'alternative') || 
                     extractScopedTag(itemXml, 'dcndl:subTitle') || 
                     extractScopedTag(itemXml, 'subTitle') || '';

    // フリガナ（タイトル読み：そのまま取得）
    let sortTitle = extractScopedTag(itemXml, 'dcndl:titleTranscription') || 
                    extractScopedTag(itemXml, 'titleTranscription') || 
                    extractScopedTag(itemXml, 'dcndl:alternativeTranscription') || '';
                    
    if (!sortTitle) {
      sortTitle = title;
    }

    // シリーズ名
    let series = extractScopedTag(itemXml, 'dcndl:seriesTitle') || extractScopedTag(itemXml, 'seriesTitle');
    if (!series) {
      const seriesMatch = title.match(/^[【\[（\(](.+?)[】\]）\)]/);
      if (seriesMatch) series = seriesMatch[1];
    }

    // 著者名
    let authors = extractScopedTag(itemXml, 'dc:creator') || extractScopedTag(itemXml, 'author');
    authors = authors.replace(/,\s*/g, ' ').replace(/\s*[著]\s*/g, '').trim();

    // 発行者
    const publisher = extractScopedTag(itemXml, 'dc:publisher') || extractScopedTag(itemXml, 'publisher');

    // 発行月（YYYY-MM形式）
    let rawDate = extractScopedTag(itemXml, 'dcterms:issued') || 
                  extractScopedTag(itemXml, 'dc:date') || 
                  extractScopedTag(itemXml, 'pubDate') || '';
                  
    rawDate = rawDate.replace(/[.\/]/g, '-').trim();
    let releaseDate = '';
    const dateMatch = rawDate.match(/(\d{4})-(\d{1,2})/);
    if (dateMatch) {
      const year = dateMatch[1];
      const month = dateMatch[2].padStart(2, '0');
      releaseDate = `${year}-${month}`;
    } else {
      releaseDate = rawDate;
    }

    return NextResponse.json({
      success: true,
      title,
      subTitle,
      sortTitle,
      volume,
      series,
      authors,
      publisher,
      releaseDate
    });

  } catch (error: any) {
    console.error('Book fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}