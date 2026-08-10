// NotionAPI.ts

namespace NotionAPI {
  const headers = {
    'Authorization': `Bearer ${Config.NOTION_TOKEN}`,
    'Notion-Version': Config.NOTION_VERSION,
    'Content-Type': 'application/json'
  };

  export function findBook(itemId: string): any {
    const url = `https://api.notion.com/v1/databases/${Config.NOTION_BOOK_DB_ID}/query`;
    const payload = {
      filter: { property: '商品ID', rich_text: { equals: itemId } }
    };
    const res = _post(url, payload);
    return res.results.length > 0 ? res.results[0] : null;
  }

  export function findSeries(seriesName: string): any {
    const url = `https://api.notion.com/v1/databases/${Config.NOTION_BOOK_DB_ID}/query`;
    const payload = {
      filter: { property: '名前', title: { equals: seriesName } }
    };
    const res = _post(url, payload);
    return res.results.length > 0 ? res.results[0] : null;
  }

  export function createSeries(seriesName: string): string {
    const url = `https://api.notion.com/v1/pages`;
    const payload = {
      parent: { database_id: Config.NOTION_BOOK_DB_ID },
      properties: {
        '名前': { title: [{ text: { content: seriesName } }] }
      }
    };
    const res = _post(url, payload);
    return res.id;
  }

  export function createBook(itemId: string, title: string, parentSeriesId: string | null): string {
    const url = `https://api.notion.com/v1/pages`;
    const payload: any = {
      parent: { database_id: Config.NOTION_BOOK_DB_ID },
      properties: {
        '名前': { title: [{ text: { content: title } }] },
        '商品ID': { rich_text: [{ text: { content: itemId } }] }
      }
    };
    if (parentSeriesId) {
      payload.properties['シリーズ'] = { relation: [{ id: parentSeriesId }] };
    }
    const res = _post(url, payload);
    return res.id;
  }

  export function findMemo(bookPageId: string, pageNumber: number): any {
    const url = `https://api.notion.com/v1/databases/${Config.NOTION_MEMO_DB_ID}/query`;
    const payload = {
      filter: {
        and: [
          { property: 'DMMページ番号', number: { equals: pageNumber } },
          { property: '書籍', relation: { contains: bookPageId } }
        ]
      }
    };
    const res = _post(url, payload);
    return res.results.length > 0 ? res.results[0] : null;
  }

  export function createMemo(bookPageId: string, pageNumber: number, memoText: string): any {
    const url = `https://api.notion.com/v1/pages`;
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
    
    const payload: any = {
      parent: { database_id: Config.NOTION_MEMO_DB_ID },
      properties: {
        '名前': { title: [{ text: { content: `📝 p.${pageNumber} (${timestamp})` } }] },
        'DMMページ番号': { number: pageNumber },
        '書籍': { relation: [{ id: bookPageId }] }
      }
    };

    if (memoText && memoText.trim() !== "") {
      payload.children = [
        {
          object: 'block', type: 'quote',
          quote: { rich_text: [{ text: { content: memoText } }] }
        }
      ];
    }
    return _post(url, payload);
  }

  export function archivePage(pageId: string): void {
    const url = `https://api.notion.com/v1/pages/${pageId}`;
    const payload = { archived: true };
    UrlFetchApp.fetch(url, {
      method: 'patch',
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  }

  function _post(url: string, payload: any): any {
    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: 'post',
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    if (json.error) {
      throw new Error(`Notion API Error: ${json.message}`);
    }
    return json;
  }
}