import { expect, test } from "bun:test";
import { NoObjectGeneratedError } from "ai";

import { describeStageDesignFailure } from "@/lib/stage/design-failure";
import { StageLayoutError } from "@/lib/stage/layout";

test("reports layout rejection without misidentifying it as a provider error", () => {
  expect(
    describeStageDesignFailure(new StageLayoutError("Widgets require a one-cell gap"))
  ).toEqual({
    code: "layout",
    message: "Widgets require a one-cell gap. Try another arrangement or retry.",
  });
});

test("distinguishes truncated designer output while keeping raw generated content private", () => {
  const provider = new NoObjectGeneratedError({
    text: "private draft",
    finishReason: "length",
    response: { id: "test", timestamp: new Date(), modelId: "test" },
    usage: {} as never,
  });
  const result = describeStageDesignFailure(
    new Error("Stage generation failed", { cause: provider })
  );
  expect(result.code).toBe("output-limit");
  expect(result.message).toContain("fewer pieces");
  expect(JSON.stringify(result)).not.toContain("private draft");
});

test("does not expose unknown provider errors, credentials, or response bodies", () => {
  const result = describeStageDesignFailure(new Error("private provider body and credentials"));
  expect(result).toEqual({
    code: "unknown",
    message: "Design could not finish. Retry when ready.",
  });
  expect(describeStageDesignFailure(new DOMException("private request", "TimeoutError")).code).toBe(
    "timeout"
  );
});
