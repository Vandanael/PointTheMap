import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  publicDir: "public",
  build: {
    outDir: "dist",
  },
  resolve: {
    alias: {
      '@lib': resolve(__dirname, './lib'),
    },
  },
});
