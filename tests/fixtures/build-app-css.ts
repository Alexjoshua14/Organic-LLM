/**
 * Compiles the app's stylesheet (styles/globals.css through Tailwind, as Next does) for browser
 * fixtures, so a harness renders with the real tokens and utilities.
 * Usage: bun tests/fixtures/build-app-css.ts <outfile.css> [extra.css ...]
 */
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const [outfile, ...extras] = process.argv.slice(2);

if (!outfile) throw new Error("usage: build-app-css.ts <outfile> [extra.css ...]");
const from = "styles/globals.css";
const result = await postcss([tailwind()]).process(await Bun.file(from).text(), { from });
const extra = await Promise.all(extras.map((path) => Bun.file(path).text()));

await Bun.write(outfile, [result.css, ...extra].join("\n"));
