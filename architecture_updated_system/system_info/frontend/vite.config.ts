import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dashboard is a developer/operator tool: it binds to loopback in dev and
// proxies API calls to the scanner service so no CORS/origin is exposed.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 8820,
    proxy: {
      "/api": "http://127.0.0.1:8810",
      "/health": "http://127.0.0.1:8810",
    },
  },
});
