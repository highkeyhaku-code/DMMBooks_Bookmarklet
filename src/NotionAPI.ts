// NotionAPI.ts
namespace NotionAPI {
    const headers = {
        'Authorization': `Bearer ${Config.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
    };

    function normalizeNotionId(rawId: string) {
        if (!rawId) return "";
        const clean = rawId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        const hex = clean.replace(/[^0-9a-f]/g, "");
        return hex; 
    }

    const BOOK_DB = normalizeNotionId(Config.NOTION_BOOK_DB_ID);
    const MEMO_DB = normalizeNotionId(Config.NOTION_MEMO_DB_ID);

    // ==========================================
    // 書籍関連のAPI
    // ==========================================
    export function findBook(itemId: string) {
        const url = `https://api.notion.com/v1/databases/${BOOK_DB}/query`;
        const payload = {
            filter: { property: '商品ID', rich_text: { equals: itemId } }
        };
        const res = _post(url, payload);
        return res.results?.length > 0 ? res.results[0] : null;
    }

    export function findSeries(seriesName: string) {
        const url = `https://api.notion.com/v1/databases/${BOOK_DB}/query`;
        const payload = {
            filter: { property: 'タイトル', title: { equals: seriesName } } 
        };
        const res = _post(url, payload);
        return res.results?.length > 0 ? res.results[0] : null;
    }

    export function createSeries(seriesName: string) {
        const url = `https://api.api.notion.com/v1/pages`;
        const payload = {
            parent: { database_id: BOOK_DB },
            properties: {
                'タイトル': { title: [{ text: { content: seriesName } }] }
            }
        };
        const res = _post(url, payload);
        return res.id;
    }

    export function createBook(itemId: string, title: string, parentSeriesId: string | null) {
        const url = `https://api.notion.com/v1/pages`;
        const payload: any = {
            parent: { database_id: BOOK_DB },
            properties: {
                'タイトル': { title: [{ text: { content: title } }] },
                '商品ID': { rich_text: [{ text: { content: itemId } }] }
            }
        };
        if (parentSeriesId) {
            payload.properties['親（シリーズ）'] = { relation: [{ id: parentSeriesId }] };
        }
        const res = _post(url, payload);
        return res.id;
    }

    // ==========================================
    // メモ（しおり）関連のAPI【フルシンク対応版】
    // ==========================================

    /**
     * 【新規】対象の書籍に紐づくすべてのメモを取得する（Sync用）
     */
    export function findAllMemos(bookPageId: string) {
        const url = `https://api.notion.com/v1/databases/${MEMO_DB}/query`;
        const payload = {
            filter: { property: '書籍DB', relation: { contains: bookPageId } }
        };
        const res = _post(url, payload);
        // 結果が存在しない場合は空配列を返す
        return res.results || [];
    }

    /**
     * 【新規】作成日時をキーにして特定のメモを探す（Update用）
     */
    export function findMemoByCreatedAt(bookPageId: string, createdAt: string) {
        const url = `https://api.notion.com/v1/databases/${MEMO_DB}/query`;
        const payload = {
            filter: {
                and: [
                    { property: 'DMM作成日時', rich_text: { equals: createdAt } },
                    { property: '書籍DB', relation: { contains: bookPageId } }
                ]
            }
        };
        const res = _post(url, payload);
        return res.results?.length > 0 ? res.results[0] : null;
    }

    /**
     * 【改修】新しいメモを作成する（DMM作成日時と名前を追加）
     */
    export function createMemo(bookPageId: string, pageNumber: number, memoName: string, createdAt: string, memoText?: string) {
        const url = `https://api.notion.com/v1/pages`;
        const payload: any = {
            parent: { database_id: MEMO_DB },
            properties: {
                'メモ名': { title: [{ text: { content: memoName || `📝 p.${pageNumber}` } }] },
                'DMMページ番号': { number: pageNumber },
                'DMM作成日時': { rich_text: [{ text: { content: createdAt } }] },
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

    /**
     * 【新規】既存のメモの名前とページ番号を上書き更新する
     */
    export function updateMemo(pageId: string, memoName: string, pageNumber: number) {
        const url = `https://api.notion.com/v1/pages/${pageId}`;
        const payload = {
            properties: {
                'メモ名': { title: [{ text: { content: memoName } }] },
                'DMMページ番号': { number: pageNumber }
            }
        };
        return _patch(url, payload);
    }

    export function archivePage(pageId: string) {
        const url = `https://api.notion.com/v1/pages/${pageId}`;
        const payload = { archived: true };
        _patch(url, payload); // _patch 関数を使うように修正
    }

    // ==========================================
    // 汎用通信ヘルパー
    // ==========================================
    function _post(url: string, payload: any) {
        const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
            method: 'post',
            headers: headers,
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        };
        const response = UrlFetchApp.fetch(url, options);
        const json = JSON.parse(response.getContentText());
        
        if (json.object === 'error') {
            throw new Error(`Notion API Error (${json.status}) [URL: ${url}]: ${json.message}`);
        }
        return json;
    }

    /**
     * 【新規】プロパティの上書きやアーカイブに使う PATCH リクエスト用ヘルパー
     */
    function _patch(url: string, payload: any) {
        const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
            method: 'patch',
            headers: headers,
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        };
        const response = UrlFetchApp.fetch(url, options);
        const json = JSON.parse(response.getContentText());
        
        if (json.object === 'error') {
            throw new Error(`Notion API Error (${json.status}) [URL: ${url}]: ${json.message}`);
        }
        return json;
    }
}