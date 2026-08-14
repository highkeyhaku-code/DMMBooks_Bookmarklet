javascript:(function(){
    // 二重起動防止
    if(window.__dmmNotionSyncActive) {
        alert("すでにNotion同期機能は起動しています。");
        return;
    }
    window.__dmmNotionSyncActive = true;
    console.log("🚀 Notion同期ブックマークレット起動");

    const GAS_URL = ""; // ★ここにGASのウェブアプリURLを貼る

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

    // トースト通知を表示する関数
    function showToast(message, type = 'success') {
        const existingToast = document.getElementById('dmm-notion-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = 'dmm-notion-toast';
        toast.innerText = message;

        const bgColor = type === 'success' ? 'rgba(76, 175, 80, 0.9)' : 
                        type === 'error'   ? 'rgba(244, 67, 54, 0.9)' : 
                                             'rgba(33, 150, 243, 0.9)';

        Object.assign(toast.style, {
            position: 'fixed',
            top: '16px',
            left: '50%',
            backgroundColor: bgColor,
            color: 'white',
            padding: '6px 16px',
            borderRadius: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: '999999',
            opacity: '0',
            transform: 'translate(-50%, -10px)',
            transition: 'all 0.3s ease-out',
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
        });

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translate(-50%, 0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -10px)';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    // --- オフラインリトライ用キュー管理 ---
    const QUEUE_KEY = 'dmm_notion_retry_queue';

    function saveToQueue(payload) {
        let queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        payload._timestamp = new Date().toISOString();
        queue.push(payload);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        console.log(`📦 未送信データをローカルに退避しました。現在キュー: ${queue.length}件`);
    }

    function flushRetryQueue() {
        let queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        if (queue.length === 0) return;

        console.log(`🔄 未送信データ（${queue.length}件）の再送を開始します...`);
        localStorage.setItem(QUEUE_KEY, JSON.stringify([]));

        queue.forEach(payload => {
            fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => console.log("✅ 過去の未送信データを同期しました:", data))
            .catch(err => {
                console.warn("⚠️ 再送に失敗しました。再度キューに戻します。");
                saveToQueue(payload);
            });
        });
    }

    // --- GASへ送信する共通関数 ---
    function sendToGAS(payload) {
        payload.itemId = getCid();
        if (!payload.itemId) {
            console.error("商品ID(cid)が取得できませんでした。");
            return;
        }

        flushRetryQueue();

        console.log("📤 Notionへ送信中:", payload);
        showToast("🔄 送信中...", "info");

        fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.json();
        })
        .then(data => {
            if(data.status === 'success') {
                console.log("✅ Notion同期完了:", data);
                showToast("✅ 保存完了", "success");
            } else {
                throw new Error(data.message || "Unknown Error");
            }
        })
        .catch(err => {
            console.error("❌ Notion同期エラー:", err);
            showToast("❌ 送信エラー (退避済)", "error");
            saveToQueue(payload);
        });
    }

    flushRetryQueue();

    // ==========================================
    // 1. 【新規】フルシンク用のデータ抽出関数
    // ==========================================
    function extractAllBookmarks(shadowRoot) {
        const listItems = shadowRoot.querySelectorAll('li.list-item');
        const bookmarks = [];

        listItems.forEach(li => {
            const nameEl = li.querySelector('.bookmark-name');
            const name = nameEl ? nameEl.innerText.trim() : '';

            const pageSpan = li.querySelector('.bookmark-detail span:not(.date)');
            const pageMatch = pageSpan ? pageSpan.innerText.match(/\d+/) : null;
            const pageNum = pageMatch ? parseInt(pageMatch[0], 10) : 0;

            const dateEl = li.querySelector('.bookmark-detail .date');
            const createdAt = dateEl ? dateEl.innerText.trim() : '';

            // 必須データ（作成日時とページ番号）が揃っている場合のみ配列に追加
            if (createdAt && pageNum > 0) {
                bookmarks.push({
                    name: name,
                    pageNumber: pageNum,
                    createdAt: createdAt
                });
            }
        });
        return bookmarks;
    }

    // ==========================================
    // 2. 【改修】MutationObserverによる「しおり一覧」の描画監視 ＋ 差分チェック
    // ==========================================
    const publus = document.querySelector('publus-controller');
    const shadow = publus ? publus.shadowRoot : null;

    if (shadow) {
        let syncTimeout = null;
        let lastSyncedBookmarksString = ""; 
        const targetNode = shadow;

        const observer = new MutationObserver((mutations) => {
            let isBookmarkListRendered = false;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    if (shadow.querySelector('li.list-item')) {
                        isBookmarkListRendered = true;
                        break;
                    }
                }
            }

            if (isBookmarkListRendered) {
                clearTimeout(syncTimeout);
                syncTimeout = setTimeout(() => {
                    // ★ 新規追加：現在「しおりの名前」を編集中（input要素が存在）なら処理を中断
                    if (shadow.querySelector('#name-input')) {
                        // console.log("✏️ しおり編集中のため同期を一時スキップします");
                        return; 
                    }

                    const bookmarks = extractAllBookmarks(shadow);
                    
                    if (bookmarks.length > 0) {
                        const currentBookmarksString = JSON.stringify(bookmarks);
                        
                        if (currentBookmarksString !== lastSyncedBookmarksString) {
                            console.log(`🔄 しおりデータの変化を検知。${bookmarks.length}件のフルシンクを開始します。`);
                            
                            lastSyncedBookmarksString = currentBookmarksString;
                            
                            sendToGAS({ 
                                action: 'sync', 
                                bookmarks: bookmarks 
                            });
                        }
                    }
                }, 500); 
            }
        });

        observer.observe(targetNode, {
            childList: true,
            subtree: true
        });
    }

    // ==========================================
    // 3. クリックイベントの監視（トースト通知のみ）
    // ==========================================
    document.addEventListener('click', function(event) {
        const publus = document.querySelector('publus-controller');
        const shadow = publus ? publus.shadowRoot : null;
        if (!shadow) return;

        const path = event.composedPath();

        // ① しおり追加時のトースト通知（実際の同期は一覧オープン時のフルシンクに任せる）
        const addBtn = path.find(el => el.matches && el.matches('button[aria-label="今表示しているページの「しおり」を追加する"]'));
        if (addBtn && !addBtn.disabled) {
            console.log("📝 しおりの追加を検知しました（一覧を開いた時に同期されます）");
            showToast("✅ しおりを追加しました（一覧オープン時に同期）", "success");
            return;
        }

        // ※ 編集ボタン（saveBtn）の監視は不要になったため削除
        // ※ しおり削除ボタンの監視もフルシンクに任せるため不要
    }, true);
})();