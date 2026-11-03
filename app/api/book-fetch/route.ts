import { NextResponse } from 'next/server';

function extractScopedTag(xml: string, tagName: string): string {
  const safeTagName = tagName.replace(':', '\\:');
  const regex = new RegExp(`<(?:[a-zA-Z0-9]+:)?${safeTagName.replace(/^.*:/, '')}[^>]*>([^]*?)<\/(?:[a-zA-Z0-9]+:)?${safeTagName.replace(/^.*:/, '')}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  
  return match[1]
    .replace(/<!\[CDATA\[([^]*?)\]\]>/g, '$1')
    .replace(/<\/?[^>]+(>|$)/g, "")
    .trim();
}

function extractSubTitle(itemXml: string): string {
  const altMatches = itemXml.match(/<(?:[a-zA-Z0-9]+:)?alternative[^>]*>([^<]+)<\/(?:[a-zA-Z0-9]+:)?alternative>/gi);
  if (!altMatches) return '';

  for (const altTag of altMatches) {
    const innerMatch = altTag.match(/>([^<]+)</);
    if (innerMatch) {
      const text = innerMatch[1].trim();
      if (!/^[A-Za-z\s.,!?]+$/.test(text)) {
        return text;
      }
    }
  }
  const firstMatch = altMatches[0].match(/>([^<]+)</);
  return firstMatch ? firstMatch[1].trim() : '';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get('isbn')?.replace(/-/g, '');

  if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) {
    return NextResponse.json({ success: false, error: '不正なISBNコードです。' }, { status: 400 });
  }

  try {
    const ndlUrl = `https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${isbn}&recordSchema=dcndl`;
    const ndlResponse = await fetch(ndlUrl, {
      headers: { 'Accept': 'application/xml', 'User-Agent': 'BookManagerApp/1.0' },
      next: { revalidate: 3600 }
    });

    if (!ndlResponse.ok) {
      throw new Error('国立国会図書館APIへのアクセスに失敗しました。');
    }

    const xmlText = await ndlResponse.text();
    const itemMatch = xmlText.match(/<item[^>]*>([\s\S]*?)<\/item>/i);
    
    if (!itemMatch) {
      return NextResponse.json({ success: false, error: '該当する書籍が見つかりませんでした。' });
    }
    const itemXml = itemMatch[1];

    let title = extractScopedTag(itemXml, 'title').replace(/\s*-\s*国立国会図書館サーチ.*/i, '').trim();

    let volume = extractScopedTag(itemXml, 'dcndl:volumeTitle') || extractScopedTag(itemXml, 'dcndl:volume') || '';
    if (!volume) {
      const volumeMatch = title.match(/(?:第\s*(\d+)\s*巻|[\[〔（\(](\d+)[\]〕）\)]|vol\.?\s*(\d+)|\b(\d+)\s*巻)/i);
      if (volumeMatch) {
        volume = volumeMatch[1] || volumeMatch[2] || volumeMatch[3] || volumeMatch[4];
        title = title.replace(/(?:第\s*\d+\s*巻|[\[〔（\(]\d+[\]〕）\)]|vol\.?\s*\d+|\b\d+\s*巻)/i, '').trim();
      }
    }
    if (!volume) volume = '1(単)';

    const subTitle = extractSubTitle(itemXml);
    let sortTitle = extractScopedTag(itemXml, 'dcndl:titleTranscription') || title;

    let series = extractScopedTag(itemXml, 'dcndl:seriesTitle') || '';
    if (!series) {
      const seriesMatch = title.match(/^[【\[（\(](.+?)[】\]）\)]/);
      if (seriesMatch) series = seriesMatch[1];
    }

    let authors = extractScopedTag(itemXml, 'dc:creator').replace(/,\s*/g, ' ').replace(/\s*[著]\s*/g, '').trim();
    const publisher = extractScopedTag(itemXml, 'dc:publisher');

    let rawDate = extractScopedTag(itemXml, 'dcterms:issued') || extractScopedTag(itemXml, 'dc:date') || '';
    const dateMatch = rawDate.replace(/[.\/]/g, '-').match(/(\d{4})-(\d{1,2})/);
    const releaseDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}` : rawDate.trim();

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