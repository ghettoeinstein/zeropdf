import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "production-csp",
      apply: "build",
      transformIndexHtml(html) {
        return html.replace("connect-src 'self'", "connect-src 'none'");
      },
    },
  ],
  build: { target: "es2022" },
});
