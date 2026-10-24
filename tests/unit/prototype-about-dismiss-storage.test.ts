import {
  dismissPrototypeAboutChip,
  dismissPrototypeAboutChipInRecord,
  isPrototypeAboutChipDismissed,
  parsePrototypeAboutDismissRecord,
  PROTOTYPE_ABOUT_DISMISS_STORAGE_KEY,
  readPrototypeAboutDismissRecord,
} from "@/lib/sandbox/prototype-about-dismiss-storage";

describe("prototype about dismiss storage", () => {
  test("parsePrototypeAboutDismissRecord rejects invalid payloads", () => {
    expect(parsePrototypeAboutDismissRecord(null)).toEqual({});
    expect(parsePrototypeAboutDismissRecord("not-json")).toEqual({});
    expect(parsePrototypeAboutDismissRecord("[]")).toEqual({});
    expect(parsePrototypeAboutDismissRecord(JSON.stringify({ "needs-input": false }))).toEqual({});
    expect(
      parsePrototypeAboutDismissRecord(JSON.stringify({ "needs-input": true, extra: true }))
    ).toEqual({ "needs-input": true });
  });

  test("dismissing one chip does not dismiss the other", () => {
    const mockStorage: Storage = {
      length: 0,
      clear() {},
      getItem: () => null,
      key: () => null,
      removeItem() {},
      setItem() {},
    };
    const store: Record<string, string> = {};

    mockStorage.getItem = (key) => store[key] ?? null;
    mockStorage.setItem = (key, value) => {
      store[key] = value;
    };

    expect(isPrototypeAboutChipDismissed({}, "needs-input")).toBe(false);
    expect(isPrototypeAboutChipDismissed({}, "what-is-this")).toBe(false);

    dismissPrototypeAboutChip(mockStorage, "needs-input");

    const afterNeedsInput = readPrototypeAboutDismissRecord(mockStorage);
    expect(isPrototypeAboutChipDismissed(afterNeedsInput, "needs-input")).toBe(true);
    expect(isPrototypeAboutChipDismissed(afterNeedsInput, "what-is-this")).toBe(false);
    expect(store[PROTOTYPE_ABOUT_DISMISS_STORAGE_KEY]).toBe(
      JSON.stringify({ "needs-input": true })
    );

    dismissPrototypeAboutChip(mockStorage, "what-is-this");

    const afterBoth = readPrototypeAboutDismissRecord(mockStorage);
    expect(isPrototypeAboutChipDismissed(afterBoth, "needs-input")).toBe(true);
    expect(isPrototypeAboutChipDismissed(afterBoth, "what-is-this")).toBe(true);
  });

  test("dismissPrototypeAboutChipInRecord is immutable", () => {
    const base = { "needs-input": true } as const;
    const next = dismissPrototypeAboutChipInRecord(base, "what-is-this");

    expect(base).toEqual({ "needs-input": true });
    expect(next).toEqual({ "needs-input": true, "what-is-this": true });
  });
});
