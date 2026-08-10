// // DmmAPI.ts

// namespace DmmAPI {
//   export function fetchBookInfo(itemId: string): BookMeta {
//     const url = `https://api.dmm.com/affiliate/v3/ItemList?api_id=${Config.DMM_API_ID}&affiliate_id=${Config.DMM_AFFILIATE_ID}&site=DMM.com&service=ebook&cid=${itemId}`;
    
//     const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
//     const json = JSON.parse(response.getContentText());
    
//     if (!json.result || !json.result.items || json.result.items.length === 0) {
//       throw new Error("DMM APIで商品が見つかりませんでした。");
//     }

//     const item = json.result.items[0];
//     let seriesName: string | null = null;

//     if (item.iteminfo && item.iteminfo.series && item.iteminfo.series.length > 0) {
//       seriesName = item.iteminfo.series[0].name;
//     }

//     return {
//       title: item.title,
//       seriesName: seriesName
//     };
//   }
// }

// DmmAPI.ts (モック版: API審査完了までの仮組み)

namespace DmmAPI {
  export function fetchBookInfo(itemId: string): BookMeta {
    // 外部APIを叩かず、固定のダミーデータを返す
    console.log(`[Mock] DMM API called for itemId: ${itemId}`);
    
    return {
      title: `【テスト用】モック書籍 (ID: ${itemId})`,
      seriesName: "テストシリーズ"
    };
  }
}