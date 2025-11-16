import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true
    })
  ],
  define: {
    "process.env": {},
    global: "globalThis"
  },
  resolve: {
    dedupe: ["@coral-xyz/anchor", "@solana/web3.js", "bn.js"]
  },
  optimizeDeps: {
    include: ["buffer", "process"]
  },
  server: {
    port: 5173
  }
});


