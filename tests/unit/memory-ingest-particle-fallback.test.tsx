import { beforeAll, describe, expect, test } from "bun:test";
import { cleanup } from "@testing-library/react";

import { render } from "../helpers/render";

let ParticleField: typeof import("@/app/sandbox/prototypes/memory-ingest/_components/ParticleField").ParticleField;

beforeAll(async () => {
  ({ ParticleField } = await import("@/app/sandbox/prototypes/memory-ingest/_components/ParticleField"));
});

describe("ParticleField reduced motion", () => {
  test("forceReducedMotion renders stand-in instead of WebGL canvas", async () => {
    const { getByTestId, queryByTestId } = render(
      <ParticleField forceReducedMotion intensity={0.5} state="idle_ready" />
    );
    expect(getByTestId("memory-particle-reduced")).toBeTruthy();
    expect(queryByTestId("memory-particle-webgl")).toBeNull();
    cleanup();
  });
});
