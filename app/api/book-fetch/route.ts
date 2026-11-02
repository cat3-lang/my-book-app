import { NextResponse } from 'next/server';

// 厳密に特定のXMLタグの「中身」だけを安全に抽出するヘルパー関数
function extractTagContent(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([^]*?)</${tagName}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  
  let content = match[1]
    .replace(/<!\[CDATA\[([^]*?)\]\]>/g, '$1') // CDATAセクションの除去
    .replace(/<\/?[^>]+(>|$)/g, "")           // 残ったHTMLタグの除去
    .trim();

  if (tagName === 'title') {
    content = content.replace(/\s*-\s*国立国会図書館サーチ.*/i, '');
  }
  
  return content;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get('isbn')?.replace(/-/g, '');

  if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) {
    return NextResponse.json({ success: false, error: '不正なISBNコードです。' }, { status: 400 });
  }

  try {
    // 正しいNDLサーチのOpenSearch APIエンドポイント
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

    // --- 各項目の厳密な抽出 ---
    const title = extractTagContent(itemXml, 'title');
    const sortTitle = extractTagContent(itemXml, 'dcndl:titleTranscription');
    const series = extractTagContent(itemXml, 'dcndl:seriesTitle');
    const authors = extractTagContent(itemXml, 'dc:creator');
    const publisher = extractTagContent(itemXml, 'dc:publisher');
    const summary = extractTagContent(itemXml, 'description');

    let releaseDate = extractTagContent(itemXml, 'dc:date');
    if (!releaseDate) releaseDate = extractTagContent(itemXml, 'dcterms:issued');
    releaseDate = releaseDate.replace(/[.\/]/g, '-');
    if (/^\d{4}-\d{2}$/.test(releaseDate)) releaseDate += '-01';
    if (/^\d{4}$/.test(releaseDate)) releaseDate += '-01-01';

    let volume = '';
    const volumeMatch = title.match(/(?:第\s*(\d+)\s*巻|[\(（](\d+)[\)）]|\b(\d+)\s*巻)/);
    if (volumeMatch) {
      volume = volumeMatch[1] || volumeMatch[2] || volumeMatch[3];
    }

    return NextResponse.json({
      success: true,
      title,
      sortTitle: sortTitle || title,
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