import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries (keep minimal)
          vendor: ['react', 'react-dom'],
          
          // Landing page specific (keep minimal)
          landing: ['next-themes'],
          
          // Core routing separate from app logic
          routing: ['react-router-dom'],
          
          // Authentication and providers (only loaded when needed)
          auth: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
          
          // UI libraries (split by usage)
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          toast: ['@radix-ui/react-toast'],
          tooltip: ['@radix-ui/react-tooltip'],
          
          // Content rendering (heavy for internal pages)
          icons: ['lucide-react'],
          markdown: ['react-markdown', 'react-syntax-highlighter', 'remark-gfm'],
          
          // Forms (internal pages only)
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          
          // Charts and analytics
          charts: ['recharts'],
          
          // File processing (heavy utilities)
          fileProcessing: ['mammoth', 'pdfjs-dist', 'tesseract.js', 'browser-image-compression'],
        },
        assetFileNames: (assetInfo) => {
          if (!assetInfo.name) return `assets/[name]-[hash][extname]`;
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
  },
}));
