import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react.ts",
    webgl: "src/webgl.ts",
    "layout-relaxation": "src/layout-relaxation.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  clean: true,
  external: ["react", "react/jsx-runtime", "zod", "three"],
});
