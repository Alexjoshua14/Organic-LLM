import { describe, expect, it } from "bun:test";

import {
  formatHoursDay,
  formatHoursRange,
  formatHoursRangeString,
  formatTimeOfDay,
} from "@/components/chat/gen-ui/blocks/restaurant-card/restaurant-card-utils";

describe("restaurant-card hour formatting", () => {
  it("formats 24-hour times as compact 12-hour labels", () => {
    expect(formatTimeOfDay("10:00")).toBe("10am");
    expect(formatTimeOfDay("22:30")).toBe("10:30 pm");
    expect(formatTimeOfDay("00:00")).toBe("12am");
    expect(formatTimeOfDay("12:00")).toBe("12pm");
  });

  it("normalizes existing 12-hour input", () => {
    expect(formatTimeOfDay("5:30 PM")).toBe("5:30 pm");
    expect(formatTimeOfDay("10:00 PM")).toBe("10pm");
  });

  it("formats hour ranges", () => {
    expect(formatHoursRange("10:00", "22:30")).toBe("10am – 10:30 pm");
    expect(formatHoursRangeString("10:00 - 22:30")).toBe("10am – 10:30 pm");
  });

  it("formats closed and open days", () => {
    expect(
      formatHoursDay({
        day: "monday",
        open: "10:00",
        close: "22:30",
      })
    ).toBe("10am – 10:30 pm");
    expect(formatHoursDay({ day: "monday", closed: true })).toBe("Closed");
  });
});
