import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    headers: {
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), display-capture=(), microphone=(self)",
    },
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || "http://localhost:4000",
        changeOrigin: true,
      },
      "/health": {
        target: process.env.API_PROXY_TARGET || "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
