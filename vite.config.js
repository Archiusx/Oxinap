import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import compression from "vite-plugin-compression";

export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: "gzip", ext: ".gz" }),
    compression({ algorithm: "brotliCompress", ext: ".br" }),
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — tiny, loads first
          "vendor-react": ["react", "react-dom"],
          // Firebase — large but cached after first load
          "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore"],
          // Supabase
          "vendor-supabase": ["@supabase/supabase-js"],
          // Charts — only loaded when dashboard widgets render
          "vendor-charts": ["recharts"],
        },
      },
    },
  },
});
