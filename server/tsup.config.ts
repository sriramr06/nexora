import { defineConfig } from "tsup";

// Bundles the server into dist/index.js.
// @nexora/shared is TypeScript source, so it is bundled in (noExternal)
// instead of being required at runtime.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  sourcemap: true,
  clean: true,
  noExternal: ["@nexora/shared"],
});
