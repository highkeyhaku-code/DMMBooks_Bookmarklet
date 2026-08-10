// build-bookmarklet.js
const fs = require('fs');
const { minify } = require('terser');

(async () => {
  try {
    // 1. 元のブックマークレットのコードを読み込む（ファイル名は適宜合わせてください）
    const sourceCode = fs.readFileSync('bookmarklet.ts', 'utf8');

    // 2. Terserで圧縮（コメント削除、変数名の短縮など）
    const minified = await minify(sourceCode, {
      compress: true,
      mangle: true // 変数名を1文字などに短縮して極限まで軽くする
    });

    // 3. ブックマークレット用に "javascript:" を付与
    const finalCode = `javascript:${minified.code}`;

    // 4. 出力フォルダ（dist等）に保存
    if (!fs.existsSync('./dist')) fs.mkdirSync('./dist');
    fs.writeFileSync('./dist/bookmarklet.min.js', finalCode);

    console.log('✅ ブックマークレットの圧縮が完了しました！');
    console.log('出力先: ./dist/bookmarklet.min.js');
  } catch (error) {
    console.error('❌ 圧縮エラー:', error);
  }
})();