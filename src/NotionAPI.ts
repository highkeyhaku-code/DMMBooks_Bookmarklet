// NotionAPI.ts
namespace NotionAPI {
    const headers = {
        'Authorization': `Bearer ${Config.NOTION_TOKEN}`,
        'Notion-Version': Config.NOTION_VERSION,
        'Content-Type': 'application/json'
    };

    export function findBook(itemId: string) {
        const url = `https://api.notion.com/v1/databases/${Config.NOTION_BOOK_DB_ID}/query`;
        const payload = {
            filter: { property: '商品ID', rich_text: { equals: itemId } }
        };
        const res = _post(url, payload);
        return res.results?.length > 0 ? res.results[0] : null; // 安全なアクセス
    }

    export function findSeries(seriesName: string) {
        const url = `https://api.notion.com/v1/databases/${Config.NOTION_BOOK_DB_ID}/query`;
        const payload = {
            // ★修正: '名前' -> 'タイトル'
            filter: { property: 'タイトル', title: { equals: seriesName } } 
        };
        const res = _post(url, payload);
        return res.results?.length > 0 ? res.results[0] : null;
    }

    export function createSeries(seriesName: string) {
        const url = `https://api.notion.com/v1/pages`;
        const payload = {
            parent: { database_id: Config.NOTION_BOOK_DB_ID },
            properties: {
                // ★修正: '名前' -> 'タイトル'
                'タイトル': { title: [{ text: { content: seriesName } }] }
            }
        };
        const res = _post(url, payload);
        return res.id;
    }

    export function createBook(itemId: string, title: string, parentSeriesId: string | null) {
        const url = `https://api.notion.com/v1/pages`;
        const payload: any = {
            parent: { database_id: Config.NOTION_BOOK_DB_ID },
            properties: {
                // ★修正: '名前' -> 'タイトル'
                'タイトル': { title: [{ text: { content: title } }] },
                '商品ID': { rich_text: [{ text: { content: itemId } }] }
            }
        };
        if (parentSeriesId) {
            // ★修正: 'シリーズ' -> '親（シリーズ）'
            payload.properties['親（シリーズ）'] = { relation: [{ id: parentSeriesId }] };
        }
        const res = _post(url, payload);
        return res.id;
    }

    export function findMemo(bookPageId: string, pageNumber: number) {
        const url = `https://api.notion.com/v1/databases/${Config.NOTION_MEMO_DB_ID}/query`;
        const payload = {
            filter: {
                and: [
                    { property: 'DMMページ番号', number: { equals: pageNumber } },
                    // ★修正: '書籍' -> '書籍DB'
                    { property: '書籍DB', relation: { contains: bookPageId } }
                ]
            }
        };
        const res = _post(url, payload);
        return res.results?.length > 0 ? res.results[0] : null;
    }

    export function createMemo(bookPageId: string, pageNumber: number, memoText: string) {
        const url = `https://api.notion.com/v1/pages`;
        const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
        const payload: any = {
            parent: { database_id: Config.NOTION_MEMO_DB_ID },
            properties: {
                // ★修正: '名前' -> 'メモ名'
                'メモ名': { title: [{ text: { content: `📝 p.${pageNumber} (${timestamp})` } }] },
                'DMMページ番号': { number: pageNumber },
                // ★修正: '書籍' -> '書籍DB'
                '書籍DB': { relation: [{ id: bookPageId }] }
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

    export function archivePage(pageId: string) {
        const url = `https://api.notion.com/v1/pages/${pageId}`;
        const payload = { archived: true };
        UrlFetchApp.fetch(url, {
            method: 'patch',
            headers: headers,
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });
    }

    function _post(url: string, payload: any) {
        const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
            method: 'post',
            headers: headers,
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        };
        const response = UrlFetchApp.fetch(url, options);
        const json = JSON.parse(response.getContentText());
        
        // ★修正: Notion APIの真のエラーをキャッチしてフロントへ返す
        if (json.object === 'error') {
            throw new Error(`Notion API Error (${json.status}): ${json.message}`);
        }
        return json;
    }
}