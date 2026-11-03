import { NextResponse } from 'next/server';

// コロンを含むタグ（例: dcndl:volumeTitle など）を安全に抽出するヘルパー関数
function extractScopedTag(xml: string, tagName: string): string {
  const safeTagName = tagName.replace(':', '\\:');
  const regex = new RegExp(`<${safeTagName}[^>]*>([^]*?)</${safeTagName}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  
  return match[1]
    .replace(/<!\[CDATA\[([^]*?)\]\]>/g, '$1')
    .replace(/<\/?[^>]+(>|$)/g, "") // 破損していた正規表現記述を修正
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
    // 0. 裏側でopenBD APIを並行して叩く（最速化）
    // ==========================================
    let bdSummary = '';
    let bdSubtitle = '';
    try {
      const bdUrl = `https://openbd.jp{isbn}`;
      const bdResponse = await fetch(bdUrl, { next: { revalidate: 3600 } });
      if (bdResponse.ok) {
        const bdData = await bdResponse.json();
        if (bdData && bdData[0]) {
          const bookInfo = bdData[0];
          // あらすじ（紹介文）の取得
          bdSummary = bookInfo.summary?.description || '';
          if (!bdSummary && bookInfo.onix?.CollateralDetail?.TextContent) {
            // ONIX詳細データから出版社公式の紹介文を探す
            const textContents = bookInfo.onix.CollateralDetail.TextContent;
            const targetText = textContents.find((tc: any) => tc.TextType === '03' || tc.TextType === '02');
            if (targetText) bdSummary = targetText.Text || '';
          }
          // サブタイトルの取得（1巻などのサブタイトル補完用）
          bdSubtitle = bookInfo.summary?.subtitle || '';
          if (!bdSubtitle && bookInfo.onix?.DescriptiveDetail?.TitleDetail?.TitleElement) {
            bdSubtitle = bookInfo.onix.DescriptiveDetail.TitleDetail.TitleElement.Subtitle || '';
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

    let title = extractTagContent(itemXml, 'title');
    title = title.replace(/\s*-\s*国立国会図書館サーチ.*/i, '').trim();

    // NDLから巻次を、無ければopenBD側のサブタイトルも考慮して連動抽出
    let volumeTitle = extractScopedTag(itemXml, 'dcndl:volumeTitle') || bdSubtitle || '';
    let volume = extractScopedTag(itemXml, 'dcndl:volume') || '';

    if (!volume) {
      const volumeMatch = title.match(/(?:第\s*(\d+)\s*巻|[\[〔（\(](\d+)[\]〕）\)]|vol\.?\s*(\d+)|\b(\d+)\s*巻)/i);
      if (volumeMatch) {
        volume = volumeMatch[1] || volumeMatch[2] || volumeMatch[3] || volumeMatch[4];
        title = title.replace(/(?:第\s*\d+\s*巻|[\[〔（\(]\d+[\]〕）\)]|vol\.?\s*\d+|\b\d+\s*巻)/i, '').trim();
      }
    }

    // 【9784800267160等のサブタイトル補正】
    // volumeTitleが純粋な数字（巻数）ではなく、日本語テキスト（サブタイトル）を含んでいる場合
    if (volumeTitle && Array.from(volumeTitle).some(c => !"0123456789０１２３４５６７８９".includes(c))) {
      // 1巻のように、もしサブタイトルの中に巻数表記（"1" や "①" など）が混ざっていたら除去して綺麗にする
      let cleanSubtitle = volumeTitle.replace(/[\s　]*[\(（\[〔]?\s*(?:1|１|①)\s*[\)）\]〕]?\s*$/, '').trim();
      
      if (cleanSubtitle) {
        if (title.includes(cleanSubtitle)) {
          title = title.replace(cleanSubtitle, '').trim();
        }
        title = `${title} 〜${cleanSubtitle}〜`;
      }
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
    // 2. あらすじの救出（openBDの相乗り補完）
    // ==========================================
    let summary = '';
    const ndlDesc = extractScopedTag(itemXml, 'description');
    
    // NDL側がただのデータ一覧（タイトル：〜）ではなく、20文字以上の純粋な文章であれば採用
    if (ndlDesc && !ndlDesc.includes("タイトル：") && !ndlDesc.includes("責任表示：") && !ndlDesc.includes("タイトル:") && !ndlDesc.includes("責任表示:") && ndlDesc.length > 20) {
      summary = ndlDesc;
    } else {
      summary = extractScopedTag(itemXml, 'dcndl:abstract');
    }

    // NDL側から取得できない、または使い物にならない箇条書きの場合はopenBDのあらすじに切り替え
    if (!summary || summary.length < 15 || summary.includes("：") || summary.includes(":")) {
      if (bdSummary) {
        summary = bdSummary;
      }
    }

    // 最終クリーニング（残ったHTMLタグの除去と整形）
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
