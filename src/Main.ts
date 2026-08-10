// Main.ts

function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  try {
    if (!e.postData || !e.postData.contents) {
      throw new Error("No payload provided.");
    }

    const payload = JSON.parse(e.postData.contents) as Payload;
    const { action, itemId, pageNumber, memoText } = payload;

    // 1. 書籍ページの特定（なければDMMから情報取得して作成）
    const bookPageId = getOrCreateBookPage(itemId);

    // 2. アクションに応じたメモDBのCRUD処理
    if (action === 'create') {
      const existingMemo = NotionAPI.findMemo(bookPageId, pageNumber);
      if (!existingMemo) {
        NotionAPI.createMemo(bookPageId, pageNumber, "");
      }
    } 
    else if (action === 'update') {
      const existingMemo = NotionAPI.findMemo(bookPageId, pageNumber);
      if (existingMemo) {
        NotionAPI.archivePage(existingMemo.id);
      }
      NotionAPI.createMemo(bookPageId, pageNumber, memoText || "");
    } 
    else if (action === 'delete') {
      const existingMemo = NotionAPI.findMemo(bookPageId, pageNumber);
      if (existingMemo) {
        NotionAPI.archivePage(existingMemo.id);
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