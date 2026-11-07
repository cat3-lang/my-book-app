import { NextResponse } from 'next/server';

// タグ抽出用のヘルパーを外に出して再生成を防ぐ
const getTagContent = (xml: string, tag: string): string => {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
  return match ? match[1].trim().replace(/<\/?[^>]+(>|$)/g, '') : ''; // 抽出時にタグ除去も一括で行う
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get('isbn')?.replace(/-/g, '');

  if (!isbn || (isbn.length !== 10 && isbn.length !== 13)) {
    return NextResponse.json({ success: false, error: '不正なISBNコードです。' }, { status: 400 });
  }

  // タイムアウト用シグナルを1行で生成（Next.js/Node.js環境で利用可能）
  const signal = AbortSignal.timeout(5000);

  try {
    const ndlUrl = `https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${isbn}`;
    const ndlResponse = await fetch(ndlUrl, {
      headers: { 'Accept': 'application/xml', 'User-Agent': 'BookManagerApp/1.0' },
      signal,
      next: { revalidate: 3600 }
    });

    if (!ndlResponse.ok) {
      throw new Error('国立国会図書館APIへのアクセスに失敗しました。');
    }

    const xmlText = await ndlResponse.text();
    const title = getTagContent(xmlText, 'title');

    // タイトルがない ＝ 該当書籍なし
    if (!title) {
      return NextResponse.json({ success: false, error: '該当する書籍が見つかりませんでした。' });
    }

    // 発売日の整形（短くスッキリ配置）
    const pubDate = getTagContent(xmlText, 'pubDate') || getTagContent(xmlText, 'date');
    const cleanDate = pubDate.replace(/\D/g, ''); // [^0-9] より \D の方が軽量
    const releaseDate = cleanDate.length >= 6 
      ? `${cleanDate.slice(0, 4)}-${cleanDate.slice(4, 6)}` 
      : cleanDate.slice(0, 4);

    return NextResponse.json({
      success: true,
      title,
      authors: getTagContent(xmlText, 'author'),
      publisher: getTagContent(xmlText, 'publisher'),
      releaseDate,
    });

  } catch (err: any) {
    console.error('API Fetch Error:', err);
    // タイムアウト起因のエラーか、それ以外（500）かを優しく判定
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    return NextResponse.json(
      { success: false, error: isTimeout ? 'タイムアウトが発生しました。再度お試しください。' : '書籍情報の取得に失敗しました。' },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
