import { describe, expect, test } from "bun:test";

import {
  processingTextBurnCharGap,
  processingTextBurnIncomingDelay,
  processingTextBurnOutgoingDelay,
} from "@/lib/chat/processing-text-burn-timing";

describe("processingTextBurn timing", () => {
  test("incoming delay starts at 0.15s and staggers by 0.03s", () => {
    expect(processingTextBurnIncomingDelay(0)).toBeCloseTo(0.15);
    expect(processingTextBurnIncomingDelay(1)).toBeCloseTo(0.18);
    expect(processingTextBurnIncomingDelay(2)).toBeCloseTo(0.21);
  });

  test("outgoing delay staggers by 0.025s", () => {
    expect(processingTextBurnOutgoingDelay(0)).toBeCloseTo(0);
    expect(processingTextBurnOutgoingDelay(1)).toBeCloseTo(0.025);
    expect(processingTextBurnOutgoingDelay(2)).toBeCloseTo(0.05);
  });

  test("char gaps account for 0.08s char duration on the first index", () => {
    // incoming@0 (0.15) − outgoing@0 (0) − charDuration (0.08) = 0.07
    expect(processingTextBurnCharGap(0)).toBeCloseTo(0.07);
    expect(processingTextBurnCharGap(1)).toBeCloseTo(0.155);
    expect(processingTextBurnCharGap(2)).toBeCloseTo(0.16);
  });
});
