import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'src/client',
  plugins: [viteSingleFile()],
  build: {
    outDir: '../../dist',
    emptyOutDir: false, // server側のビルド結果を消さないようにfalseにする
  },
});
