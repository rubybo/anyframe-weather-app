import { defineConfig } from "vite";
import { anyframe } from "anyframe-compiler/vite";

export default defineConfig({
  plugins: [anyframe()],
  server: {
    host: "127.0.0.1",
    port: 43123,
    strictPort: true,
  },
});
