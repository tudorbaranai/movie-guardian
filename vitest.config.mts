// Unit tests: Vitest + React Testing Library, set up as in the Next.js guide
// (node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md).
// Run them with `npm test`.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Understand the "@/lib/..." import shortcut defined in tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    // A pretend browser (document, window, inputs…) for components to render in.
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
