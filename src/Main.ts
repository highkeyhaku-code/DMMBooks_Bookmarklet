// Main.ts

function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  try {
    if (!e.postData || !e.postData.contents) {
      throw new Error("No payload provided.");
    }

    const payload = JSON.parse(e.postData.contents) as Payload;
    const { action, itemId, pageNumber, memoText, createdAt, bookmarks } = payload;

    // 1. 書籍ページの特定（なければDMMから情報取得して作成）
    const bookPageId = getOrCreateBookPage(itemId);

    // ==========================================
    // 2. フルシンク処理 (action: 'sync')
    // ==========================================
    if (action === 'sync' && bookmarks) {
      // ① Notion上にある対象書籍の全メモを取得
      const existingMemos = NotionAPI.findAllMemos(bookPageId);
      
      // ② 高速な突合のため、キーを「DMM作成日時」、値を「Notionページ情報」としたMapを作成
      const existingMap = new Map();
      existingMemos.forEach((memo: any) => {
        const dateStr = memo.properties['DMM作成日時']?.rich_text[0]?.plain_text;
        if (dateStr) existingMap.set(dateStr, memo);
      });

      // ③ フロントから来たリスト（DMM側の正データ）をループ
      for (const b of bookmarks) {
        if (existingMap.has(b.createdAt)) {
          // --- 既存メモの Update 判定 ---
          const targetMemo = existingMap.get(b.createdAt);
          const currentNum = targetMemo.properties['DMMページ番号']?.number;
          const currentName = targetMemo.properties['メモ名']?.title[0]?.text?.content;

          // ページ番号のズレ（文字サイズ変更）や、名前が変わっていれば上書き
          if (currentNum !== b.pageNumber || currentName !== b.name) {
            NotionAPI.updateMemo(targetMemo.id, b.name, b.pageNumber);
          }
          
          // 処理が終わったものはMapから消す
          existingMap.delete(b.createdAt);
        } else {
          // --- 新規メモの Create ---
          NotionAPI.createMemo(bookPageId, b.pageNumber, b.name, b.createdAt);
        }
      }

      // ④ 削除判定 (Delete)
      // Mapに残っている＝「Notionには存在するが、DMM側にはもう無い」ためアーカイブする
      existingMap.forEach((targetMemo: any) => {
        NotionAPI.archivePage(targetMemo.id);
      });
    } 
    // ==========================================
    // 3. 個別の名前更新処理 (action: 'update')
    // ==========================================
    else if (action === 'update' && createdAt) {
      // フロントから「作成日時」が送られてきた場合のみ、そのキーで特定して更新
      const memo = NotionAPI.findMemoByCreatedAt(bookPageId, createdAt);
      if (memo) {
        NotionAPI.updateMemo(memo.id, memoText || "", pageNumber || 0);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error: any) {
    console.error(error);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 商品IDからNotionの書籍ページIDを取得（なければ作成）
 */
function getOrCreateBookPage(itemId: string): string {
  const bookPage = NotionAPI.findBook(itemId);
  if (bookPage) return bookPage.id;

  const bookInfo = DmmAPI.fetchBookInfo(itemId);
  let parentSeriesId: string | null = null;

  if (bookInfo.seriesName) {
    const seriesPage = NotionAPI.findSeries(bookInfo.seriesName);
    if (seriesPage) {
      parentSeriesId = seriesPage.id;
    } else {
      parentSeriesId = NotionAPI.createSeries(bookInfo.seriesName);
    }
  }

  return NotionAPI.createBook(itemId, bookInfo.title, parentSeriesId);
}