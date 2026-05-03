import { defineConfig } from 'vite';

// GitHub Pages (alt yol): CI’da BASE_URL=/depo-adı/ verilir. Yerelde tanımlı değilse kök: '/'
export default defineConfig({
  base: process.env.BASE_URL || '/',
  resolve: {
    dedupe: ['three']
  },
  server: {
    port: 5173,
    open: false
  }
});
