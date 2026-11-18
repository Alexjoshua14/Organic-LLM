/**
 * Bundles a browser test fixture that imports app components. Next-only modules the browser
 * fixture can't run are stubbed: `next/font/*` returns an empty font (class and variable names).
 * Component CSS imports are dropped; the spec serves the compiled app CSS itself
 * (tests/fixtures/build-app-css.ts), as Next would.
 * Usage: bun tests/fixtures/build-browser-fixture.ts <entry.tsx> <outfile.js>
 */
const [entry, outfile] = process.argv.slice(2);

if (!entry || !outfile) throw new Error("usage: build-browser-fixture.ts <entry> <outfile>");

const result = await Bun.build({
  entrypoints: [entry],
  target: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "drop-css-imports",
      setup(build) {
        build.onLoad({ filter: /\.css$/ }, () => ({ contents: "", loader: "js" }));
      },
    },
    {
      name: "next-font-stub",
      setup(build) {
        build.onResolve({ filter: /^next\/font\// }, (args) => ({
          path: args.path,
          namespace: "next-font-stub",
        }));
        build.onLoad({ filter: /.*/, namespace: "next-font-stub" }, () => ({
          contents:
            "const font = () => ({ className: '', variable: '', style: {} });\n" +
            "export default font;\n" +
            "export const Fira_Code = font, Inter = font, Commissioner = font;",
          loader: "js",
        }));
      },
    },
  ],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await Bun.write(outfile, await result.outputs.find((o) => o.kind === "entry-point")!.text());
