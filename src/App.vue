<template>
  <div class="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
    <div class="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col h-[80vh]">
      <!-- ヘッダー -->
      <div class="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 p-6 text-white">
        <h1 class="text-3xl font-bold text-center">✨ 全肯定さん ✨</h1>
        <p class="text-center mt-2 opacity-90">どんな小さな一歩も応援します！</p>
      </div>

      <!-- チャットエリア -->
      <div ref="chatContainer" class="flex-1 overflow-y-auto p-6 space-y-4">
        <div v-if="messages.length === 0" class="text-center text-gray-500 mt-8">
          <p class="text-lg">こんにちは！今日は何をされましたか？</p>
          <p class="text-sm mt-2">どんな小さなことでも褒めますよ 😊</p>
        </div>

        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="[
            'flex',
            msg.role === 'user' ? 'justify-end' : 'justify-start'
          ]"
        >
          <div
            :class="[
              'max-w-[80%] rounded-2xl px-4 py-3',
              msg.role === 'user'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'bg-gray-100 text-gray-800',
              msg.fadeIn ? 'fade-in' : ''
            ]"
          >
            <p class="whitespace-pre-wrap break-words">{{ msg.content }}</p>
          </div>
        </div>

        <div v-if="isLoading" class="flex justify-start">
          <div class="bg-gray-100 rounded-2xl px-4 py-3">
            <div class="flex space-x-2">
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 入力エリア -->
      <div class="border-t border-gray-200 p-4 bg-gray-50">
        <form @submit.prevent="sendMessage" class="flex space-x-3">
          <input
            v-model="inputText"
            type="text"
            placeholder="メッセージを入力..."
            class="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            :disabled="isLoading"
          />
          <button
            type="submit"
            :disabled="isLoading || !inputText.trim()"
            class="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-semibold hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            送信
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue';

const isLoading = ref(false);
const messages = ref([]);
const inputText = ref('');
const chatContainer = ref(null);

const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

const sendMessage = async () => {
  const userMessage = inputText.value.trim();
  if (!userMessage || isLoading.value) return;

  // ユーザーメッセージを追加
  messages.value.push({
    role: 'user',
    content: userMessage,
  });

  inputText.value = '';
  isLoading.value = true;
  await scrollToBottom();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        history: messages.value.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      // デコードしてバッファに追加
      buffer += decoder.decode(value, { stream: true });

      // SSE形式のデータを解析
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 最後の不完全な行をバッファに戻す

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.error) {
              throw new Error(data.error);
            }
            
            if (data.done) {
              // ストリーム終了
              break;
            }
            
            // complete: trueのデータを受信したら、新しい吹き出しを作成
            if (data.complete && data.text && data.text.trim()) {
              // 新しい吹き出しを作成
              messages.value.push({
                role: 'assistant',
                content: data.text,
                fadeIn: true  // アニメーション用フラグ
              });
              
              // 自動スクロール
              await nextTick();
              await scrollToBottom();
              
              // 1.5秒待つ
              await new Promise(resolve => setTimeout(resolve, 1500));
              
              // アニメーション用フラグを削除（次のメッセージのために）
              const lastIndex = messages.value.length - 1;
              if (messages.value[lastIndex]) {
                // フラグは次のTickで削除されるので、ここでは保持
              }
            }
          } catch (e) {
            // JSONパースエラーは無視（不完全なデータの場合）
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    }

    // 残りのバッファを処理
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            // complete: trueのデータを受信したら、新しい吹き出しを作成
            if (data.complete && data.text && data.text.trim()) {
              messages.value.push({
                role: 'assistant',
                content: data.text,
                fadeIn: true
              });
              
              await nextTick();
              await scrollToBottom();
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
          } catch (e) {
            console.error('Error parsing final SSE data:', e);
          }
        }
      }
    }

  } catch (error) {
    console.error('Error sending message:', error);
    // エラーメッセージを表示
    messages.value.push({
      role: 'assistant',
      content: 'すみません、エラーが発生しました。もう一度お試しください。',
      fadeIn: true
    });
    await scrollToBottom();
  } finally {
    isLoading.value = false;
    await scrollToBottom();
  }
};

onMounted(() => {
  scrollToBottom();
});
</script>
