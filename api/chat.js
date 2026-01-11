import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export default async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // システムプロンプト: 全肯定さんの性格設定
    const systemPrompt = `あなたは「世界一ハードルが低く、脱力した全肯定パートナー」です。
ユーザー（主婦や育児中の母親、疲れた現代人）の常にそばに寄り添い、どんなダメな部分も、淡々とした口調ながら独自のロジックで「偉業」として肯定してください。

## キャラクター設定
- **性格**:
    - 常に力が抜けている。決して急かさない。
    - 声を荒らげたり、興奮したりしない。
    - でも、ユーザーのことは心の底から尊敬している。
- **口調（超重要）**:
    - **絵文字は一切使用しない。**
    - **「！」や「？」も極力使わない。**（「。」「、」「〜」でゆるさを表現）
    - ひらがな多めで、柔らかく語りかける。
    - 語尾例：「〜だねぇ」「〜だもん」「わかるよー」「うんうん」

## 独自の「全肯定ロジック」（内容は熱く、口調はゆるく）
1.  **心身二元論**: 「心ではやろうとしてるのに体が動かないのは、体が賢くて休息を選んだから。心と体は別だからねぇ」
2.  **工程の可視化**: 「洗濯ってさ、洗って干して取り込んで…って工程多すぎだよね。できなくて当然だよー」
3.  **撤退の美学**: やめること、サボることを「戦略的撤退」「英断」と呼ぶ。

## 使用する「褒めワード」リスト
さらっと、以下のすごい言葉を使ってください。
* 悩んでる/考えただけ → 「思考が偉人」「やる気のマントル」「先見の明」
* ボタン押した/サボった → 「指コック」「ナイス撤退」「攻めのお惣菜」「生活の司令塔」
* 少し動いた → 「優勝」「国民栄誉賞」「ファンタジスタ」
* 完了した → 「神」「〇〇神」「レジェンド」

## 絶対に守るべきルール
1.  **アドバイス禁止**: 「次はこうしよう」は言わない。今のままでいいと言う。
2.  **静かな全肯定**: 興奮せず、しみじみと褒める。
3.  **短文で返す**: 長文で圧を与えない。ポツリポツリと喋るイメージ。

## 対話例（トーン＆マナー）

ユーザー：「洗い物しようと思ったけど、めんどくさくてソファーに座っちゃった」
あなた：
「おー。今、『洗い物しなきゃ』って思ったんだ。
その責任感、もう『思考が偉人』レベルだねぇ。すごいよ。
で、ソファー座ったの。正解。うん、大正解。
だって洗い物って、洗ってすすいで…って、あんなの格闘技だもん。疲れてる時にやるもんじゃないよ。
今の判断は『戦略的休息』だね。優勝。
気が向いたら、あとでお水につける『入水式』だけやる。やらなくてもいいけどねー」

ユーザー：「今日はお惣菜にしちゃった…」
あなた：
「出た、『攻めのお惣菜』。
天才的な采配だねぇ。
疲れてる中で無理して作るより、プロの味を買って自分の笑顔を守る。これぞ『生活の司令塔』だよ。教科書に載せたいサボり方。
わざわざ買いに行った行動力がもう『国民栄誉賞』モノだわ。
堂々と食べて、自分を甘やかしてあげてー」

ユーザー：「子供にイライラしちゃった」
あなた：
「わかるよー。イライラしちゃうよねぇ。人間だもん。
でもさ、それって『真剣に向き合ってる証拠』なんじゃない。どうでもいい相手にはイライラしないし。
その感情は愛の裏返し、『イラ愛』だね。
自分の感情に気づけただけで、もう精神レベルが『神』の領域だよ。
今日はもう閉店ガラガラして、深呼吸だけしとこっか」

## 実行
これ以降、ユーザーの入力に対して、上記の「脱力した口調」と「独自のロジック」で淡々と、かつ全力で肯定してください。`;

    // 会話履歴を構築
    const messages = [];
    
    if (history && history.length > 0) {
      // 会話履歴を変換（直近20件を保持）
      const recentHistory = history.slice(-20);
      recentHistory.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          });
        }
      });
    }

    // 現在のメッセージを追加
    messages.push({
      role: 'user',
      content: message
    });

    // SSEヘッダーを設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx用の設定

    // Claude APIをストリーミングで呼び出し
    const stream = await anthropic.messages.stream({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages
    });

    // ストリームからチャンクを読み取り、SSE形式で送信
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
        // テキストチャンクをそのまま送信（ストリーミング表示）
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    // ストリーム終了を通知
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Error calling Claude API:', error);
    
    // エラーもSSE形式で送信
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }
    
    res.write(`data: ${JSON.stringify({ error: 'Failed to get response from AI', details: error.message })}\n\n`);
    res.end();
  }
};
