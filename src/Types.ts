// Types.ts

// ペイロードの型定義（フルシンク用の bookmarks 配列と、個別更新用の createdAt を追加）
interface Payload {
  action: 'sync' | 'update' | 'create' | 'delete';
  itemId: string;
  pageNumber?: number;
  memoText?: string;
  createdAt?: string; // 個別更新用のキー
  bookmarks?: Array<{
    name: string;
    pageNumber: number;
    createdAt: string;
  }>;
}

// DMM APIから取得する書籍情報の型
interface BookMeta {
  title: string;
  seriesName: string | null;
}