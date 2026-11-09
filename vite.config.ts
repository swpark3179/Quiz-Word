import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 포트를 고정한다 — 진행 기록(localStorage)은 출처(포트 포함)별로 저장되므로 포트가 바뀌면 기록이 안 보인다.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5179, strictPort: true },
  preview: { port: 5179, strictPort: true },
  // 단어 데이터를 번들에 함께 넣으므로 청크가 크다 (로컬 전용이라 문제 없음)
  build: { chunkSizeWarningLimit: 12000 },
});
