import { describe, expect, test } from "bun:test";

import { PARTICLE_VERTEX_SHADER } from "@/app/sandbox/prototypes/memory-ingest/_lib/lens/shaders/particle.vert";
import { FIELD_ABSORPTION_GLSL } from "@/app/sandbox/prototypes/memory-ingest/_lib/lens/shaders/fields/absorption";
import { FIELD_TENDRIL_REACH_GLSL } from "@/app/sandbox/prototypes/memory-ingest/_lib/lens/shaders/fields/tendrilReach";

describe("tier0 tendril/absorption shader wiring", () => {
  test("displacement contributions are strictly weight-gated", () => {
    expect(PARTICLE_VERTEX_SHADER).toContain(
      "disp += wAbsorption * fieldAbsorption(aRest, uAnisotropy, uPhaseFlow);"
    );
    expect(PARTICLE_VERTEX_SHADER).toContain(
      "disp += wTendrilReach * fieldTendrilReach(aRest, aId, uAnisotropy, uPhaseFlow);"
    );
  });

  test("field chunks define required entrypoints", () => {
    expect(FIELD_ABSORPTION_GLSL).toContain("vec3 fieldAbsorption(");
    expect(FIELD_TENDRIL_REACH_GLSL).toContain("vec3 fieldTendrilReach(");
  });
});
