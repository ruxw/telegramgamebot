import { defineConfig } from 'vite';
import path from 'path';
export default defineConfig({
  server: { port: 5173, host: true, fs: { allow: [path.resolve(__dirname, '..')] },
    proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } } },
  build: { outDir: 'dist', emptyOutDir: true }
});
