#!/usr/bin/env -S bun --no-env-file
/**
 * Entry point behind `bun run test`, `test:unit`, and `test:integration`. Owns the preload list
 * and suite paths so package.json only names the script.
 *
 * The shebang carries `--no-env-file`: Bun loads .env.local into any script it runs, and the test
 * child would inherit it. Run the file directly (as package.json does), not as `bun scripts/...`.
 *
 * Prints failures and a summary only; console output from the code under test is silenced
 * (see tests/quiet-preload.ts).
 *
 * Usage:
 *   bun run test                                 unit, then integration
 *   bun run test:unit                            unit only
 *   bun run test:integration                     integration only
 *   bun run test:unit tests/unit/foo.test.ts     just that file; a substring filter works too
 *   bun run test:unit -t "test name"             the suite, filtered by test name
 *   bun run test:unit --verbose                  console output and passing tests (-v, or TEST_VERBOSE=1)
 */
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

// Bun loads .env.local into any script it runs, and the test child would inherit it, service-role
// keys included. A plain `bun test` skips .env.local, so tests must start without it.
if (!process.execArgv.includes("--no-env-file")) {
  console.error("Run this as scripts/run-tests.ts or through `bun run test`, not `bun scripts/run-tests.ts`.");
  process.exit(2);
}

const PRELOADS = ["./tests/jsdom-preload.ts", "./tests/preload.ts", "./tests/quiet-preload.ts"];

const SUITES = {
  unit: ["tests/unit", "tests/getNMessages.test.ts", "tests/organicStateProtocol.test.ts"],
  integration: ["tests/integration"],
} as const;

type SuiteName = keyof typeof SUITES;

// `bun test` flags that take their value as the next argument. Any other argument that does not
// start with "-" is a path or filter, and replaces the suite's default paths.
const VALUE_FLAGS = new Set([
  "-t",
  "--test-name-pattern",
  "--timeout",
  "--rerun-each",
  "--retry",
  "--seed",
  "--coverage-reporter",
  "--coverage-dir",
  "--reporter",
  "--reporter-outfile",
  "--max-concurrency",
  "--path-ignore-patterns",
  "--changed",
  "--parallel",
  "--parallel-delay",
  "--shard",
  "--timings",
  "--preload",
  "-r",
]);

const argv = process.argv.slice(2);

if (argv[0] === "--") argv.shift();

const suiteArg = argv[0] === "unit" || argv[0] === "integration" ? (argv.shift() as SuiteName) : null;

const verbose =
  argv.includes("--verbose") ||
  argv.includes("-v") ||
  ["1", "true"].includes(process.env.TEST_VERBOSE ?? "");

const rest = argv.filter((arg) => arg !== "--verbose" && arg !== "-v");

const flags: string[] = [];
const filters: string[] = [];

rest.forEach((arg, i) => {
  const isFlagValue = i > 0 && VALUE_FLAGS.has(rest[i - 1]);

  (arg.startsWith("-") || isFlagValue ? flags : filters).push(arg);
});

async function run(paths: readonly string[]): Promise<number> {
  const proc = Bun.spawn(
    [
      process.execPath,
      "test",
      ...PRELOADS.flatMap((preload) => ["--preload", preload]),
      ...(verbose ? [] : ["--only-failures"]),
      ...flags,
      ...paths,
    ],
    {
      cwd: ROOT,
      env: verbose ? { ...process.env, TEST_VERBOSE: "1" } : process.env,
      stdio: ["inherit", "inherit", "inherit"],
    }
  );

  const code = await proc.exited;

  // A child killed by a signal has no exit code. Never let that read as a pass.
  return proc.signalCode ? 1 : code;
}

async function main(): Promise<number> {
  if (filters.length > 0) return run(filters);

  const names = suiteArg ? [suiteArg] : (Object.keys(SUITES) as SuiteName[]);

  for (const name of names) {
    if (!suiteArg) console.log(`== ${name} ==`);

    const code = await run(SUITES[name]);

    if (code !== 0) return code;
  }

  return 0;
}

process.exit(await main());
