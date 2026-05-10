import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { myfatoorahDevProxy } from "./vite-myfatoorah-plugin";

export default defineConfig(({ mode }) => {
  // Vite only auto-exposes VITE_* env vars to client code. Here we explicitly
  // load all env vars (prefix "") so server-side keys like MYFATOORAH_API_KEY
  // are available to the dev-server plugin without ever being bundled into
  // the browser.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      myfatoorahDevProxy({
        env: {
          MYFATOORAH_API_KEY: env.MYFATOORAH_API_KEY,
          MYFATOORAH_BASE_URL: env.MYFATOORAH_BASE_URL,
          MYFATOORAH_RETURN_BASE: env.MYFATOORAH_RETURN_BASE,
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
  };
});
