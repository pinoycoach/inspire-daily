import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No key is ever put into the page: the server (server.ts) makes every AI and database call.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
