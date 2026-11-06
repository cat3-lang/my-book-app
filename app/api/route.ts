import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get('isbn')?.replace(/-/g, '');

  if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) {
    return NextResponse.json({ success: false, error: '不正なISBNコードです。' }, { status: 400 });
  }

  try {
    // タイムアウト設定（3秒以内に応答がない場合は処理を中断して高速化）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const ndlUrl = `https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${isbn}`;
    const ndlResponse = await fetch(ndlUrl, {
      headers: { 'Accept': 'application/xml', 'User-Agent': 'BookManagerApp/1.0' },
      signal: controller.signal,
      next: { revalidate: 3600 }
    });

    clearTimeout(timeoutId);

    if (!ndlResponse.ok) {
      throw new Error('国立国会図書館APIへのアクセスに失敗しました。');
    }

    const xmlText = await ndlResponse.text();

    // 簡易かつ高速なXMLタグ抽出ヘルパー
    const getTagContent = (xml: string, tag: string) => {
      const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
      return match ? match[1].trim() : '';
    };

    // タイトル、著者、出版社の抽出
    const title = getTagContent(xmlText, 'title');
    const authors = getTagContent(xmlText, 'author');
    const publisher = getTagContent(xmlText, 'publisher');
    const pubDate = getTagContent(xmlText, 'pubDate') || getTagContent(xmlText, 'date');

    if (!title) {
      return NextResponse.json({ success: false, error: '該当する書籍が見つかりませんでした。' });
    }

    // 発売日の整形（YYYY-MM-DD や YYYY-MM に合わせる）
    let releaseDate = '';
    if (pubDate) {
      const cleanDate = pubDate.replace(/[^0-9]/g, '');
      if (cleanDate.length >= 6) {
        releaseDate = `${cleanDate.substring(0, 4)}-${cleanDate.substring(4, 6)}`;
      } else if (cleanDate.length >= 4) {
        releaseDate = cleanDate.substring(0, 4);
      }
    }

    return NextResponse.json({
      success: true,
      title: title.replace(/<\/?[^>]+(>|$)/g, ''),
      authors: authors.replace(/<\/?[^>]+(>|$)/g, ''),
      publisher: publisher.replace(/<\/?[^>]+(>|$)/g, ''),
      releaseDate: releaseDate,
    });

  } catch (err: any) {
    console.error('API Fetch Error:', err);
    return NextResponse.json({ success: false, error: '書籍情報の取得に失敗しました（タイムアウトまたはネットワークエラー）。' }, { status: 500 });
  }
}