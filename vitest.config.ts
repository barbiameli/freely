import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  // tsconfig.json sets jsx: "preserve" for Next's own compiler, which Vite's
  // default transform can't execute as-is — it needs to be told to transform
  // JSX itself for the handful of integration tests that import a
  // page/component module directly (e.g. the Public Quote page).
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "node",
    globals: true,
  },
});
