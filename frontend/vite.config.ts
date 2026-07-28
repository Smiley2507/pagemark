/// <reference types="vitest/config" />
import path from "path";
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function vendorChunk(id: string) {
  if (!id.includes('/node_modules/')) return undefined;
  const packageChunk = () => {
    const [, packagePath = 'vendor'] = id.split('/node_modules/');
    const parts = packagePath.split('/');
    const packageName = parts[0]?.startsWith('@') ? `${parts[0]}-${parts[1]}` : parts[0];
    return `vendor-${packageName.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  };
  if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router-dom/')) {
    return 'vendor-react';
  }
  if (id.includes('/@tanstack/')) return 'vendor-query';
  if (id.includes('/@tiptap/') || id.includes('/prosemirror-')) {
    return 'vendor-editor';
  }
  if (
    id.includes('/react-markdown/') ||
    id.includes('/remark-') ||
    id.includes('/rehype-') ||
    id.includes('/micromark') ||
    id.includes('/mdast-') ||
    id.includes('/hast-') ||
    id.includes('/lowlight/') ||
    id.includes('/katex/')
  ) {
    return 'vendor-markdown';
  }
  if (id.includes('/recharts/') || id.includes('/d3-')) return 'vendor-charts';
  return packageChunk();
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1400,
    rolldownOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
});
