import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    lumen: "src/lumen/index.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  splitting: false,
  clean: true,
  external: ["react", "react/jsx-runtime"],
  // esbuild drops module directives; the hooks and shell are client components in Next.js.
  // No `treeshake`: its Rollup pass strips this banner. esbuild already drops unused code.
  banner: { js: '"use client";' },
});
