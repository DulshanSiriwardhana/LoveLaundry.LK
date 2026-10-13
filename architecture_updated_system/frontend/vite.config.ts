import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 8101,
    proxy: {
      // Proxied to the recreated backend in development.
      "/api": "http://127.0.0.1:8100",
      "/auth": "http://127.0.0.1:8100",
      "/users": "http://127.0.0.1:8100",
    },
  },
});
