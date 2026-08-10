// Types.ts

// フロントエンド（ブックマークレット）から送られてくるデータの型
interface Payload {
  action: 'create' | 'update' | 'delete';
  itemId: string;
  pageNumber: number;
  memoText?: string;
}

// DMM APIから取得する書籍情報の型
interface BookMeta {
  title: string;
  seriesName: string | null;
}