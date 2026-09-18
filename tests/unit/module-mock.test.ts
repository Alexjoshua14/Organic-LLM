import { describe, expect, test } from "bun:test";

import { mockModulePreservingReal } from "../helpers/module-mock";
import * as subject from "../helpers/module-mock-subject";

const SPECIFIER = "../helpers/module-mock-subject";

/**
 * Pins the behaviour the helper exists for. Bun applies `mock.module` process-wide, so a
 * partial stub that is never reverted reaches every file loaded afterwards — including the
 * mocked module's own test. That failed CI three times while passing on macOS, where test
 * file order differs, so these assertions stand in for a local reproduction.
 */
describe("mockModulePreservingReal", () => {
  test("applies overrides, keeps untouched exports, and restores", async () => {
    const stub = () => "stubbed-greeting";

    const restore = mockModulePreservingReal(SPECIFIER, subject, { subjectGreeting: stub });

    const mocked = await import(SPECIFIER);

    expect(mocked.subjectGreeting()).toBe("stubbed-greeting");
    // Exports the caller did not override survive; a bare stub would drop this one.
    expect(mocked.subjectFarewell()).toBe("real-farewell");

    restore();

    const restored = await import(SPECIFIER);

    expect(restored.subjectGreeting()).toBe("real-greeting");
    expect(restored.subjectFarewell()).toBe("real-farewell");
  });
});
