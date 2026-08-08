import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    emptyOutDir: false,
    outDir: path.resolve("eagle-plugin/dist"),
    lib: {
      entry: path.resolve("privacy-app/main.jsx"),
      name: "MaxPrivacyEditor",
      formats: ["iife"],
      fileName: () => "privacy-editor.js",
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: (asset) => asset.name?.endsWith(".css") ? "privacy-editor.css" : "[name][extname]",
      },
    },
  },
});
