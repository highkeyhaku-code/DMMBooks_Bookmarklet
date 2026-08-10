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

    // トースト通知を表示する関数（CSSも動的に適用）
    function showToast(message, type = 'success') {
        const existingToast = document.getElementById('dmm-notion-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = 'dmm-notion-toast';
        toast.innerText = message;

        // 成功は緑、エラーは赤、情報は青（すべて少しだけ透過させて目立たなくする）
        const bgColor = type === 'success' ? 'rgba(76, 175, 80, 0.9)' : 
                        type === 'error'   ? 'rgba(244, 67, 54, 0.9)' : 
                                             'rgba(33, 150, 243, 0.9)';

        Object.assign(toast.style, {
            position: 'fixed',
            top: '16px',         // 上部配置
            left: '50%',         // 中央寄せの準備
            backgroundColor: bgColor,
            color: 'white',
            padding: '6px 16px', // 極小サイズ
            borderRadius: '20px',// スタイリッシュなピル形状
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: '12px',    // 小さなフォント
            fontWeight: 'bold',
            zIndex: '999999',
            opacity: '0',
            transform: 'translate(-50%, -10px)', // X軸は-50%で中央寄せ、Y軸は少し上に隠す
            transition: 'all 0.3s ease-out',
            pointerEvents: 'none', // ★追加：トーストの下の要素をクリック可能にする
            whiteSpace: 'nowrap'   // テキストの折り返しを防ぐ
        });

        document.body.appendChild(toast);

        // フワッと下がりながら表示
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translate(-50%, 0)';
        });

        // 2.5秒後にスッと上がりながら消える（読書の邪魔にならないよう少し早めに消す）
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -10px)';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    // --- オフラインリトライ用キュー管理 ---
    const QUEUE_KEY = 'dmm_notion_retry_queue';

    // キューに保存する
    function saveToQueue(payload) {
        let queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        payload._timestamp = new Date().toISOString(); // いつ保存したかの記録
        queue.push(payload);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        console.log(`📦 未送信データをローカルに退避しました。現在キュー: ${queue.length}件`);
    }

    // キューから取り出して再送を試みる
    function flushRetryQueue() {
        let queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        if (queue.length === 0) return;

        console.log(`🔄 未送信データ（${queue.length}件）の再送を開始します...`);

        // 一旦キューを空にする（再送失敗したら再びキューに戻すため）
        localStorage.setItem(QUEUE_KEY, JSON.stringify([]));

        queue.forEach(payload => {
            // バックグラウンドで静かに再送
            fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => console.log("✅ 過去の未送信データを同期しました:", data))
            .catch(err => {
                console.warn("⚠️ 再送に失敗しました。再度キューに戻します。");
                saveToQueue(payload); // 失敗したら再びキューへ
            });
        });
    }

    // --- 更新版: GASへ送信する共通関数 ---
    function sendToGAS(payload) {
        payload.itemId = getCid();
        if (!payload.itemId) {
            console.error("商品ID(cid)が取得できませんでした。");
            return;
        }

        // ★送信前に、溜まっているキューがあれば一緒に流し込む
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
            console.log("✅ Notion同期完了:", data);
            showToast("✅ 保存完了", "success");
        })
        .catch(err => {
            console.error("❌ Notion同期エラー:", err);
            showToast("❌ 送信エラー (退避済)", "error");
            // ★ エラー時はキューに保存する
            saveToQueue(payload);
        });
    }

    // ★ ブックマークレット起動時にも一度キューをチェックする
    flushRetryQueue();

    // クリックイベントの監視（Shadow DOM貫通版）
    document.addEventListener('click', function(event) {
        // 1. publus-controllerのShadow DOMを取得
        const publus = document.querySelector('publus-controller');
        const shadow = publus ? publus.shadowRoot : null;
        if (!shadow) return; // ビューアが見つからなければ何もしない

        // 2. クリックされた要素の「本当の階層（パス）」を取得
        const path = event.composedPath();

        // 3. 「しおりを追加する」ボタンがパスの中に含まれているかチェック
        const addBtn = path.find(el => el.matches && el.matches('button[aria-label="今表示しているページの「しおり」を追加する"]'));
        if (addBtn && !addBtn.disabled) {
            // Shadow DOMの中からページ番号を取得
            const pageIndicator = shadow.querySelector('.pages-indicator-rect .current');
            const pageNum = extractPageNum(pageIndicator);
            sendToGAS({ action: 'create', pageNumber: pageNum });
            return;
        }

        // 4. しおり一覧での「確定ボタン」がパスの中に含まれているかチェック
        const saveBtn = path.find(el => el.matches && el.matches('button[aria-label="このしおりの名前を確定する"]'));
        if (saveBtn) {
            const inputElement = shadow.querySelector('#name-input');
            if (inputElement) {
                const detailSpan = inputElement.closest('.bookmark-content').querySelector('.bookmark-detail span');
                const pageNum = extractPageNum(detailSpan);
                sendToGAS({ action: 'update', pageNumber: pageNum, memoText: inputElement.value });
            }
            return;
        }
    }, true);

    // Enterキーでの更新監視（Shadow DOM貫通版）
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            const publus = document.querySelector('publus-controller');
            const shadow = publus ? publus.shadowRoot : null;
            if (!shadow) return;

            // Shadow DOM内でのフォーカスされている要素を取得
            const activeElement = shadow.activeElement;
            if (activeElement && activeElement.id === 'name-input') {
                const detailSpan = activeElement.closest('.bookmark-content').querySelector('.bookmark-detail span');
                const pageNum = extractPageNum(detailSpan);
                sendToGAS({ action: 'update', pageNumber: pageNum, memoText: activeElement.value });
                
                activeElement.blur(); // フォーカスを外す
            }
        }
    }, true);
})();