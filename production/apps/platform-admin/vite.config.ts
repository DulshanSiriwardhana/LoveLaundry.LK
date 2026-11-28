import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Local development may proxy /api/user to a service supplied by the
  // environment. No service host is hardcoded in source. On Vercel, set
  // VITE_USER_API_URL to the deployed user-service URL instead.
  const userProxyTarget = env.USER_SERVICE_URL;

  return {
    plugins: [react()],
    server: {
      port: 5180,
      proxy: userProxyTarget
        ? {
            "/api/user": {
              target: userProxyTarget,
              changeOrigin: true,
              rewrite: (path: string) => path.replace(/^\/api\/user/, ""),
            },
          }
        : undefined,
    },
  };
});
