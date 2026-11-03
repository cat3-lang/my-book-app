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

function extractAllTagContent(xml: string, tagName: string): string[] {
  const safeTagName = tagName.replace(':', '\\:');
  const regex = new RegExp(`<${safeTagName}[^>]*>([^]*?)</${safeTagName}>`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const cleaned = match[1]
      .replace(/<!\[CDATA\[([^]*?)\]\]>/g, '$1')
      .replace(/<\/?[^>]+(>|$)/g, "")
      .trim();
    if (cleaned) results.push(cleaned);
  }
  return results;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get('isbn')?.replace(/-/g, '');

  if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) {
    return NextResponse.json({ success: false, error: '不正なISBNコードです。' }, { status: 400 });
  }

  let bdSummary = '';
  let bdSubtitle = '';
  let bdPublishDate = '';

  // ==========================================
  // 0. openBD APIから詳細データを確実に取得
  // ==========================================
  try {
    const bdUrl = `https://api.openbd.jp/v1/get?isbn=${isbn}`;
    const bdResponse = await fetch(bdUrl, { next: { revalidate: 3600 } });
    if (bdResponse.ok) {
      const bdData = await bdResponse.json();
      if (bdData && bdData[0]) {
        const bookInfo = bdData[0];
        
        bdSummary = bookInfo.summary?.description || '';
        if (!bdSummary && bookInfo.onix?.CollateralDetail?.TextContent) {
          const textContents = bookInfo.onix.CollateralDetail.TextContent;
          const targetText = textContents.find((tc: any) => tc.TextType === '03' || tc.TextType === '02' || tc.TextType === '01');
          if (targetText) bdSummary = targetText.Text || '';
        }

        bdSubtitle = bookInfo.summary?.subtitle || '';
        if (!bdSubtitle && bookInfo.onix?.DescriptiveDetail?.TitleDetail?.TitleElement) {
          const titleElem = bookInfo.onix.DescriptiveDetail.TitleDetail.TitleElement;
          if (Array.isArray(titleElem)) {
            bdSubtitle = titleElem.find((el: any) => el.Subtitle)?.Subtitle || '';
          } else {
            bdSubtitle = titleElem.Subtitle || '';
          }
        }

        bdPublishDate = bookInfo.summary?.pubdate || '';
      }
    }
  } catch (bdError) {
    console.error('openBD API Fetch Error:', bdError);
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
      if (bdSummary || bdSubtitle) {
        return NextResponse.json({
          success: true,
          title: '',
          subTitle: bdSubtitle,
          sortTitle: '',
          volume: '1（単）',
          series: '',
          authors: '',
          publisher: '',
          releaseDate: bdPublishDate || '',
          summary: bdSummary || ""
        });
      }
      return NextResponse.json({ success: false, error: '該当する書籍が見つかりませんでした。' });
    }
    const itemXml = itemMatch[1];

    let rawTitle = extractScopedTag(itemXml, 'title');
    rawTitle = rawTitle.replace(/\s*-\s*国立国会図書館サーチ.*/i, '').trim();

    let volume = extractScopedTag(itemXml, 'dcndl:volumeTitle') || extractScopedTag(itemXml, 'dcndl:volume') || '';
    if (!volume) {
      const volumeMatch = rawTitle.match(/(?:第\s*(\d+)\s*巻|[\[〔（\(](\d+)[\]〕）\)]|vol\.?\s*(\d+)|\b(\d+)\s*巻)/i);
      if (volumeMatch) {
        volume = volumeMatch[1] || volumeMatch[2] || volumeMatch[3] || volumeMatch[4];
        rawTitle = rawTitle.replace(/(?:第\s*\d+\s*巻|[\[〔（\(]\d+[\]〕）\)]|vol\.?\s*\d+|\b\d+\s*巻)/i, '').trim();
      }
    }
    if (!volume) {
      volume = '1（単）';
    }

    // ==========================================
    // 2. タイトルとサブタイトルの分離処理
    // ==========================================
    let title = rawTitle;
    let subTitle = extractScopedTag(itemXml, 'dcndl:subTitle') || extractScopedTag(itemXml, 'subTitle') || bdSubtitle || '';

    if (!subTitle) {
      const colonSplit = rawTitle.split(/[:：\s*[-–—]\s*]/);
      if (colonSplit.length > 1 && colonSplit[1].trim().length > 0) {
        title = colonSplit[0].trim();
        subTitle = colonSplit.slice(1).join(' ').trim();
      }
    }

    let sortTitle = extractScopedTag(itemXml, 'dcndl:titleTranscription') || extractScopedTag(itemXml, 'titleTranscription') || title;
    sortTitle = sortTitle.replace(/[\s ]+[ア-ン0-9０-９]+\s*$/, '').trim();

    let series = extractScopedTag(itemXml, 'dcndl:seriesTitle') || extractScopedTag(itemXml, 'seriesTitle');
    if (!series) {
      const seriesMatch = title.match(/^[【\[（\(](.+?)[】\]）\)]/);
      if (seriesMatch) series = seriesMatch[1];
    }

    let authors = extractScopedTag(itemXml, 'dc:creator') || extractScopedTag(itemXml, 'author');
    authors = authors.replace(/,\s*/g, ' ').replace(/\s*[著]\s*/g, '').trim();

    const publisher = extractScopedTag(itemXml, 'dc:publisher') || extractScopedTag(itemXml, 'publisher');

    let releaseDate = extractScopedTag(itemXml, 'dc:date') || extractScopedTag(itemXml, 'dcterms:issued') || extractScopedTag(itemXml, 'pubDate') || bdPublishDate;
    releaseDate = releaseDate.replace(/[.\/]/g, '-');
    if (/^\d{4}-\d{2}$/.test(releaseDate)) releaseDate += '-01';
    if (/^\d{4}$/.test(releaseDate)) releaseDate += '-01-01';

    // ==========================================
    // 3. あらすじの抽出と補完
    // ==========================================
    let summary = '';
    const descriptions = extractAllTagContent(itemXml, 'description');
    
    for (const desc of descriptions) {
      if (desc && !desc.includes("タイトル：") && !desc.includes("責任表示：") && !desc.includes("出版者:") && desc.length > 10) {
        summary = desc;
        break;
      }
    }

    if (!summary) {
      summary = extractScopedTag(itemXml, 'dcndl:abstract');
    }

    if (bdSummary && bdSummary.length > (summary?.length || 0)) {
      summary = bdSummary;
    }

    summary = summary ? summary.replace(/<\/?[^>]+(>|$)/g, "").trim() : "";

    return NextResponse.json({
      success: true,
      title,
      subTitle,
      sortTitle,
      volume,
      series,
      authors,
      publisher,
      releaseDate,
      summary: summary || bdSummary || ""
    });

  } catch (error: any) {
    console.error('Book fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}