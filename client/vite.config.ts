import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Shared vendor chunks stay cacheable across deploys. `recharts` is its
        // own chunk so it is only requested by the chart routes that lazy-load
        // it, never by the root page.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts')) return 'charts';
          if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
          if (id.includes('react-router') || id.includes('/react/') || id.includes('/react-dom/')) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
  },
});
