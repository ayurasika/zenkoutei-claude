<template>
  <div class="min-h-screen bg-cream flex flex-col font-jp text-stone-700">
    <!-- 上部マスコットエリア（タイトルなし） -->
    <header class="flex flex-col items-center pt-10 pb-4 shrink-0">
      <img
        :src="mascotImage"
        :key="mascotState"
        alt=""
        class="w-28 h-28 object-contain fade-in"
      />
    </header>

    <!-- チャットエリア -->
    <main
      ref="chatContainer"
      class="flex-1 overflow-y-auto px-6 pb-40 max-w-xl w-full mx-auto"
    >
      <div v-if="messages.length === 0" class="text-center text-stone-400 mt-12 text-sm leading-relaxed">
        <p>きょうは、どんな一日でしたか。</p>
      </div>

      <div class="space-y-5">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="['flex', msg.role === 'user' ? 'justify-end' : 'justify-start']"
        >
          <div
            :class="[
              'max-w-[78%] px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words',
              msg.role === 'user'
                ? 'bg-paleblue text-stone-700 rounded-2xl rounded-br-md'
                : 'bg-white text-stone-700 rounded-2xl rounded-bl-md border border-stone-100',
              msg.fadeIn ? 'fade-in' : ''
            ]"
          >
            {{ msg.content }}
          </div>
        </div>

        <div v-if="isLoading" class="flex justify-start">
          <div class="bg-white border border-stone-100 rounded-2xl rounded-bl-md px-4 py-3">
            <div class="flex space-x-1.5">
              <div class="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce"></div>
              <div class="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
              <div class="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 入力エリア（タブの真上に固定） -->
    <div class="fixed bottom-14 left-0 right-0 bg-cream/95 backdrop-blur-sm border-t border-stone-100">
      <form
        @submit.prevent="sendMessage"
        class="max-w-xl mx-auto flex items-center gap-3 px-5 py-3"
      >
        <input
          v-model="inputText"
          type="text"
          placeholder="きょうのことを、すこしだけ。"
          class="flex-1 px-4 py-2.5 bg-white border border-stone-200 rounded-full text-[14px] placeholder:text-stone-300 focus:outline-none focus:border-stone-300"
          :disabled="isLoading"
        />
        <button
          type="submit"
          :disabled="isLoading || !inputText.trim()"
          class="w-10 h-10 flex items-center justify-center bg-paleblue rounded-full text-stone-600 disabled:opacity-40 transition-opacity"
          aria-label="送信"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/>
            <polyline points="5 12 12 5 19 12"/>
          </svg>
        </button>
      </form>
    </div>

    <!-- 下部タブメニュー（見た目のみ） -->
    <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 h-14 flex items-center justify-around">
      <button class="flex flex-col items-center text-stone-500 text-[10px]" aria-label="きろく">
        <span class="text-base leading-none">○</span>
        <span class="mt-0.5">きろく</span>
      </button>
      <button class="flex flex-col items-center text-stone-400 text-[10px]" aria-label="はなす">
        <span class="text-base leading-none">◇</span>
        <span class="mt-0.5">はなす</span>
      </button>
      <button class="flex flex-col items-center text-stone-400 text-[10px]" aria-label="わたし">
        <span class="text-base leading-none">△</span>
        <span class="mt-0.5">わたし</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import mascotSit from './assets/mascot-sit.svg';
import mascotSleep from './assets/mascot-sleep.svg';
import mascotFish from './assets/mascot-fish.svg';

const isLoading = ref(false);
const messages = ref([]);
const inputText = ref('');
const chatContainer = ref(null);

const mascotState = ref('idle');

const mascotImage = computed(() => {
  switch (mascotState.value) {
    case 'thinking': return mascotSleep;
    case 'happy':    return mascotFish;
    default:         return mascotSit;
  }
});

const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

const sendMessage = async () => {
  const userMessage = inputText.value.trim();
  if (!userMessage || isLoading.value) return;

  messages.value.push({ role: 'user', content: userMessage });
  inputText.value = '';
  isLoading.value = true;
  mascotState.value = 'thinking';

  await scrollToBottom();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        history: messages.value.map(m => ({ role: m.role, content: m.content })),
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.error) throw new Error(data.error);
          if (data.done) break;

          if (data.complete && data.text && data.text.trim()) {
            messages.value.push({
              role: 'assistant',
              content: data.text,
              fadeIn: true,
            });
            await new Promise(r => setTimeout(r, 1500));
          }
        } catch (e) {
          console.error('Error parsing SSE data:', e);
        }
      }
    }

    if (buffer.trim()) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.complete && data.text && data.text.trim()) {
            messages.value.push({
              role: 'assistant',
              content: data.text,
              fadeIn: true,
            });
            await new Promise(r => setTimeout(r, 1500));
          }
        } catch (e) {
          console.error('Error parsing final SSE data:', e);
        }
      }
    }
  } catch (error) {
    console.error('Error sending message:', error);
    messages.value.push({
      role: 'assistant',
      content: 'すみません、すこし通信に失敗しました。もういちどお試しください。',
      fadeIn: true,
    });
  } finally {
    isLoading.value = false;
    mascotState.value = 'happy';
  }
};
</script>
