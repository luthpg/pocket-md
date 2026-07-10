import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const getBaseUrl = () => {
  if (process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY) {
    const repoName = process.env.GITHUB_REPOSITORY.split('/')[1];
    return `/${repoName}/`;
  }
  // ローカル開発環境（npm run dev など）ではルートパスにする
  return '/';
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: getBaseUrl(),
  server: {
    forwardConsole: true,
  },
  /*optimizeDeps: {
    exclude: ['zenn-markdown-html'],
  },
  build: {
    commonjsOptions: {
      include: [/zenn-markdown-html/],
    },
  },
  resolve: {
    preserveSymlinks: true,
  },*/
})
