import type { FieldName, ModulatorName, StateName, StateRecipe } from "./fieldLibrary";

import { ALL_FIELD_NAMES, ALL_MODULATOR_NAMES } from "./fieldLibrary";
import { RECIPES } from "./recipes";
import { resolveDuration } from "./transitions";
import { easeInOutCubic } from "./easing";

export function cloneRecipe(r: StateRecipe): StateRecipe {
  const fields = { ...r.fields };
  const modulators: StateRecipe["modulators"] = {};

  for (const k of ALL_MODULATOR_NAMES) {
    const v = r.modulators[k];

    if (v === undefined) continue;
    modulators[k] = Array.isArray(v) ? ([...v] as [number, number, number]) : v;
  }

  return { fields, modulators };
}

function modulatorScalarOrVec(
  m: StateRecipe["modulators"],
  name: ModulatorName
): [number, number, number] {
  const v = m[name];

  if (v === undefined) return [0, 0, 0];
  if (Array.isArray(v)) return v;

  return [v, v, v];
}

/** Lerp every field in the union of keys; missing → 0 at that side. */
export function lerpRecipe(a: StateRecipe, b: StateRecipe, t: number): StateRecipe {
  const fields: StateRecipe["fields"] = {};

  for (const k of ALL_FIELD_NAMES) {
    const va = a.fields[k as FieldName] ?? 0;
    const vb = b.fields[k as FieldName] ?? 0;

    fields[k as FieldName] = va + (vb - va) * t;
  }

  const modulators: StateRecipe["modulators"] = {};

  for (const name of ALL_MODULATOR_NAMES) {
    const [ax, ay, az] = modulatorScalarOrVec(a.modulators, name);
    const [bx, by, bz] = modulatorScalarOrVec(b.modulators, name);

    if (name === "anisotropy") {
      modulators.anisotropy = [ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t];
    } else {
      const av = a.modulators[name];
      const bv = b.modulators[name];
      const as = typeof av === "number" ? av : Array.isArray(av) ? av[0] : 0;
      const bs = typeof bv === "number" ? bv : Array.isArray(bv) ? bv[0] : 0;

      modulators[name] = as + (bs - as) * t;
    }
  }

  return { fields, modulators };
}

export class StateManager {
  private current: StateRecipe;
  private target: StateRecipe;
  private from: StateRecipe;
  private startTime = 0;
  private durationMs = 0;
  private currentName: StateName = "idle_ready";

  constructor(initial: StateName = "idle_ready") {
    this.currentName = initial;
    this.current = cloneRecipe(RECIPES[initial]);
    this.target = this.current;
    this.from = this.current;
  }

  getCurrentName(): StateName {
    return this.currentName;
  }

  /** Request a transition. Interrupts any in-flight transition. */
  transitionTo(next: StateName, now: number): void {
    if (next === this.currentName && this.isSettled(now)) return;
    this.from = cloneRecipe(this.current);
    this.target = cloneRecipe(RECIPES[next]);
    this.durationMs = resolveDuration(this.currentName, next);
    this.startTime = now;
    this.currentName = next;
  }

  /** Call every frame. Updates `current` in place. */
  update(now: number): StateRecipe {
    const t = this.durationMs === 0 ? 1 : Math.min(1, (now - this.startTime) / this.durationMs);
    const eased = easeInOutCubic(t);

    this.current = lerpRecipe(this.from, this.target, eased);

    return this.current;
  }

  isSettled(now: number): boolean {
    if (this.durationMs === 0) return true;

    return (now - this.startTime) / this.durationMs >= 1 - 1e-9;
  }
}
