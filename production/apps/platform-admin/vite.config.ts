import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      // The tag generator's hotel picker reads the user-service hotels list.
      "/api/user": {
        target: "https://love-laundry-user-service.vercel.app",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/user/, ""),
      },
    },
  },
});
