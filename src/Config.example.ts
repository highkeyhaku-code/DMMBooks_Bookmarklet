// Config.example.ts
// Copy this file to `src/Config.ts` and fill in real secret values.
// Do NOT commit `src/Config.ts` to version control — add it to .gitignore.

namespace Config {
  // Notion
  export const NOTION_TOKEN = 'your-notion-token'; // ex: secret_xxx
  export const NOTION_BOOK_DB_ID = 'your-notion-book-db-id';
  export const NOTION_MEMO_DB_ID = 'your-notion-memo-db-id';
  export const NOTION_VERSION = '2022-06-28';

  // DMM
  export const DMM_API_ID = 'your-dmm-api-id';
  export const DMM_AFFILIATE_ID = 'your-dmm-affiliate-id';
}

// Example usage:
// 1. Copy this file: `cp src/Config.example.ts src/Config.ts`
// 2. Replace placeholder values with your real tokens/IDs.