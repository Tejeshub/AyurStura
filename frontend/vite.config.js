/** Vite config - React plugin and frontend port 3000 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://ayurstura.onrender.com',
        changeOrigin: true,
      },
    },
  },
});
