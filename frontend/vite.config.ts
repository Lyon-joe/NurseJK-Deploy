// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // Ensure this matches your backend process port
        changeOrigin: true, // Crucial for backend hosts
        secure: false,      // Necessary if using self-signed certs or HTTP
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Optional: verify if your backend expects the /api prefix
      },
    },
  },
});