import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    
    // مهم جداً: تعريف متغيرات VITE فقط
    define: {
      __GEMINI_API_KEY__: JSON.stringify(env.VITE_GEMINI_API_KEY),
      __API_KEY__: JSON.stringify(env.VITE_API_KEY),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
