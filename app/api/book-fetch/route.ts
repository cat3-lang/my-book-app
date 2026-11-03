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
    // 0. openBD APIから詳細データを取得（あらすじ・サブタイトルの補完）
    // ==========================================
    let bdSummary = '';
    let bdSubtitle = '';
    try {
      const bdUrl = `https://api.openbd.jp/v1/get?isbn=${isbn}`;
      const bdResponse = await fetch(bdUrl, { next: { revalidate: 3600 } });
      if (bdResponse.ok) {
        const bdData = await bdResponse.json();
        if (bdData && bdData[0]) {
          const bookInfo = bdData[0];
          // あらすじ
          bdSummary = bookInfo.summary?.description || '';
          if (!bdSummary && bookInfo.onix?.CollateralDetail?.TextContent) {
            const textContents = bookInfo.onix.CollateralDetail.TextContent;
            const targetText = textContents.find((tc: any) => tc.TextType === '03' || tc.TextType === '02');
            if (targetText) bdSummary = targetText.Text || '';
          }
          // サブタイトル
          bdSubtitle = bookInfo.summary?.subtitle || '';
          if (!bdSubtitle && bookInfo.onix?.DescriptiveDetail?.TitleDetail?.TitleElement) {
            const titleElem = bookInfo.onix.DescriptiveDetail.TitleDetail.TitleElement;
            if (Array.isArray(titleElem)) {
              bdSubtitle = titleElem.find((el: any) => el.Subtitle)?.Subtitle || '';
            } else {
              bdSubtitle = titleElem.Subtitle || '';
            }
          }
        }
      }
    } catch (bdError) {
      console.error('openBD API Fetch Error:', bdError);
    }

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

    let rawTitle = extractTagContent(itemXml, 'title');
    rawTitle = rawTitle.replace(/\s*-\s*国立国会図書館サーチ.*/i, '').trim();

    // 巻数の抽出
    let volume = extractScopedTag(itemXml, 'dcndl:volumeTitle') || extractScopedTag(itemXml, 'dcndl:volume') || '';
    if (!volume) {
      const volumeMatch = rawTitle.match(/(?:第\s*(\d+)\s*巻|[\[〔（\(](\d+)[\]〕）\)]|vol\.?\s*(\d+)|\b(\d+)\s*巻)/i);
      if (volumeMatch) {
        volume = volumeMatch[1] || volumeMatch[2] || volumeMatch[3] || volumeMatch[4];
        rawTitle = rawTitle.replace(/(?:第\s*\d+\s*巻|[\[〔（\(]\d+[\]〕）\)]|vol\.?\s*\d+|\b\d+\s*巻)/i, '').trim();
      }
    }

    // ==========================================
    // 2. タイトルとサブタイトルの分離処理
    // ==========================================
    let title = rawTitle;
    let subTitle = extractScopedTag(itemXml, 'dcndl:subTitle') || extractScopedTag(itemXml, 'subTitle') || bdSubtitle || '';

    // もし専用タグに無くて、タイトルの中に「 : 」や「 ‐ 」が含まれている場合（例: "とんでもスキルで異世界放浪メシ : 豚の生姜焼き×伝説の魔獣"）
    if (!subTitle) {
      const colonSplit = rawTitle.split(/[:：\s*[-–—]\s*]/);
      if (colonSplit.length > 1) {
        title = colonSplit[0].trim();
        subTitle = colonSplit.slice(1).join(' ').trim();
      }
    }

    // フリガナ
    let sortTitle = extractScopedTag(itemXml, 'dcndl:titleTranscription') || extractScopedTag(itemXml, 'titleTranscription') || title;
    sortTitle = sortTitle.replace(/[\s ]+[ア-ン0-9０-９]+\s*$/, '').trim();

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

    // 発売日
    let releaseDate = extractScopedTag(itemXml, 'dc:date') || extractScopedTag(itemXml, 'dcterms:issued') || extractScopedTag(itemXml, 'pubDate');
    releaseDate = releaseDate.replace(/[.\/]/g, '-');
    if (/^\d{4}-\d{2}$/.test(releaseDate)) releaseDate += '-01';
    if (/^\d{4}$/.test(releaseDate)) releaseDate += '-01-01';

    // ==========================================
    // 3. あらすじの抽出と補完
    // ==========================================
    let summary = '';
    const ndlDesc = extractScopedTag(itemXml, 'description');
    
    if (ndlDesc && !ndlDesc.includes("タイトル：") && !ndlDesc.includes("責任表示：") && !ndlDesc.includes("タイトル:") && !ndlDesc.includes("責任表示:") && ndlDesc.length > 15) {
      summary = ndlDesc;
    } else {
      summary = extractScopedTag(itemXml, 'dcndl:abstract');
    }

    // もしNDL側があらすじ不十分であればopenBDのあらすじを採用
    if ((!summary || summary.length < 15 || summary.includes("：") || summary.includes(":")) && bdSummary) {
      summary = bdSummary;
    }

    summary = summary.replace(/<\/?[^>]+(>|$)/g, "").trim();

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
      summary: summary || "あらすじ情報はありません"
    });

  } catch (error: any) {
    console.error('Book fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}