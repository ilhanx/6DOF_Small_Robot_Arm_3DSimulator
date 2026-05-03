import { defineConfig } from 'vite';

// GitHub Pages: CI’da BASE_URL=/depo-adı/ verilir.
// Yerelde boş bırakılınca './' → dist’i dosya sisteminden açarken asset yolları kırılmaz (yine de öneri: npm run dev / preview).
export default defineConfig({
  base: process.env.BASE_URL || './',
  resolve: {
    dedupe: ['three']
  },
  server: {
    port: 5173,
    open: false
  }
});
