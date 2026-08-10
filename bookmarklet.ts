javascript:(function(){
    // 二重起動防止
    if(window.__dmmNotionSyncActive) {
        alert("すでにNotion同期機能は起動しています。");
        return;
    }
    window.__dmmNotionSyncActive = true;
    console.log("🚀 Notion同期ブックマークレット起動");

    const GAS_URL = "YOUR_GAS_WEB_APP_URL"; // ★ここにGASのウェブアプリURLを貼る

    // URLから商品ID(cid)を抽出
    function getCid() {
        const match = location.href.match(/cid=([^&]+)/);
        return match ? match[1] : null;
    }

    // 要素からページ番号を抽出するヘルパー
    function extractPageNum(element) {
        if (!element) return 0;
        const match = element.innerText.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    }

    // GASへ送信する共通関数（CORS回避対応）
    function sendToGAS(payload) {
        payload.itemId = getCid();
        if (!payload.itemId) {
            console.error("商品ID(cid)が取得できませんでした。");
            return;
        }

        console.log("📤 Notionへ送信中:", payload);

        fetch(GAS_URL, {
            method: 'POST',
            // 【重要】CORS事前リクエストを回避するため text/plain を指定
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => console.log("✅ Notion同期完了:", data))
        .catch(err => console.error("❌ Notion同期エラー:", err));
    }

    // クリックイベントの監視（イベントデリゲーション）
    document.addEventListener('click', function(event) {
        // 1. 【追加】「しおりを追加する」ボタン
        const addBtn = event.target.closest('button[aria-label="今表示しているページの「しおり」を追加する"]');
        if (addBtn) {
            // 追加ボタン押下時は、画面下部のスライダー等からページ数を取得（※要検証）
            // DMMビューアの仕様上、左下のページ表示などを取得する想定
            const pageIndicator = document.querySelector('.pages-indicator-rect .current');
            const pageNum = extractPageNum(pageIndicator);
            sendToGAS({ action: 'create', pageNumber: pageNum });
            return;
        }

        // 2. 【更新】しおり一覧での「確定ボタン」
        const saveBtn = event.target.closest('button[aria-label="このしおりの名前を確定する"]');
        const sideSheet = event.target.closest('.side-sheet-container');
        if (saveBtn && sideSheet) {
            const inputElement = document.getElementById('name-input');
            if (inputElement) {
                // 編集中のアイテムのページ番号を取得
                const detailSpan = inputElement.closest('.bookmark-content').querySelector('.bookmark-detail span');
                const pageNum = extractPageNum(detailSpan);
                sendToGAS({ action: 'update', pageNumber: pageNum, memoText: inputElement.value });
            }
            return;
        }

        // 3. 【削除】「選択したしおりを削除する」ボタン
        const deleteBtn = event.target.closest('button[aria-label="選択したしおりを削除する"]');
        if (deleteBtn && !deleteBtn.disabled && sideSheet) {
            // チェックが入っている項目のページ番号をすべて取得
            const checkedItems = sideSheet.querySelectorAll('md-checkbox[data-aria-checked="true"]');
            checkedItems.forEach(checkbox => {
                const listItem = checkbox.closest('.list-item');
                const detailSpan = listItem.querySelector('.bookmark-detail span');
                const pageNum = extractPageNum(detailSpan);
                // 複数選択削除に対応するため、ループで送信
                sendToGAS({ action: 'delete', pageNumber: pageNum });
            });
            return;
        }
    }, true);

    // Enterキーでの更新監視
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.id === 'name-input') {
                const sideSheet = activeElement.closest('.side-sheet-container');
                if (sideSheet) {
                    const detailSpan = activeElement.closest('.bookmark-content').querySelector('.bookmark-detail span');
                    const pageNum = extractPageNum(detailSpan);
                    sendToGAS({ action: 'update', pageNumber: pageNum, memoText: activeElement.value });
                }
            }
        }
    }, true);
})();