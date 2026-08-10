// Config.example.ts
// Copy this file to `src/Config.ts`.
// Secret values (NOTION_TOKEN, NOTION_BOOK_DB_ID, etc.) should be configured in GAS Script Properties.

namespace Config {
  // 機密情報はGASのスクリプトプロパティから取得する
  const props = PropertiesService.getScriptProperties();

  // Notion関連
  export const NOTION_TOKEN = props.getProperty('NOTION_TOKEN') || '';
  export const NOTION_BOOK_DB_ID = props.getProperty('NOTION_BOOK_DB_ID') || '';
  export const NOTION_MEMO_DB_ID = props.getProperty('NOTION_MEMO_DB_ID') || '';

  // DMM関連
  export const DMM_API_ID = props.getProperty('DMM_API_ID') || '';
  export const DMM_AFFILIATE_ID = props.getProperty('DMM_AFFILIATE_ID') || '';

  // 機密でない固定の設定値はそのまま記述
  export const NOTION_VERSION = '2026-03-11';
}

// Required GAS Script Properties keys:
// - NOTION_TOKEN
// - NOTION_BOOK_DB_ID
// - NOTION_MEMO_DB_ID
// - DMM_API_ID
// - DMM_AFFILIATE_ID