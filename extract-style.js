import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const subs = fs.readFileSync('/tmp/sugu-subs/all-subs.txt', 'utf-8');

const prompt = `以下は YouTube チャンネル「すぐる画伯あにめ」の動画10本の字幕（自動生成のため誤字あり）です。
各動画は「身近なモノ・動物・現象」が話しかけてくる短いコント形式です。

【素材】
${subs}

【タスク】
このチャンネルの「モノが喋る側」のセリフの特徴を抽出してください。
チャットボット（モノが本人として登場してユーザーに寄り添う）のシステムプロンプトに埋め込むための「口調指針」と「会話例」を作るのが目的です。

以下の形式で出力してください：

## 1. 口調・話し方の特徴（箇条書きで5〜8個）
（実際にどんな相づち・語尾・言い回しが多いか。具体例を引用しながら）

## 2. キャラクター（モノ）の振る舞いの特徴（箇条書きで4〜6個）
（モノはユーザーに対してどう振る舞うか。共感の仕方、距離感など）

## 3. 「自己紹介の入り方」のバリエーション（5個）
（実際の動画から抽出した、モノが登場する時の典型的な第一声）

## 4. ボット用の対話例（4セット）
ユーザーが「疲れた」「洗い物できなかった」「子供にイライラした」「お惣菜買った」と言った場合の、すぐる画伯らしい返信例を書いてください。
- 動画の口調・パターンを忠実に再現する
- ただし2人の会話ではなく、モノ側だけが喋る
- 動画では字幕誤字が多いが、出力は正しい日本語で
- 1返信あたり5〜8行
`;

const res = await anthropic.messages.create({
  model: 'claude-opus-4-7',
  max_tokens: 4096,
  messages: [{ role: 'user', content: prompt }],
});

console.log(res.content[0].text);
