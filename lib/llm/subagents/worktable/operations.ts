import { randomUUID } from "crypto";

import {
  WORKTABLE_LIMITS,
  type ContextBundle,
  type ResolvedWorktableItem,
  type Worktable,
  type WorktableItem,
} from "@/lib/llm/subagents/worktable/types";

/** Result of a pure worktable edit. Callers persist `worktable` only when `ok`. */
export type WorktableOutcome<T> =
  | { ok: true; worktable: Worktable; value: T }
  | { ok: false; error: string };

type BundleFields = { name?: string; purpose?: string | null; instructions?: string | null };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function shortId(prefix: string, taken: ReadonlySet<string>, newId: () => string): string {
  // Short ids are easier for the model to repeat back; lengthen on the rare collision.
  for (let length = 6; ; length += 2) {
    const id = `${prefix}-${newId().replace(/-/g, "").slice(0, length)}`;

    if (!taken.has(id)) return id;
    if (length > 32) return `${prefix}-${taken.size}-${newId()}`;
  }
}

const defaultNewId = () => randomUUID();

function cleanOptional(value: string | null | undefined, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value?.trim() ?? "";

  return trimmed ? trimmed.slice(0, max) : null;
}

/** Bundle by exact id, else by case-insensitive name. */
export function findBundle(worktable: Worktable, ref: string): ContextBundle | undefined {
  const wanted = ref.trim();
  const lower = wanted.toLowerCase();

  return (
    worktable.bundles.find((b) => b.id === wanted) ??
    worktable.bundles.find((b) => b.name.toLowerCase() === lower)
  );
}

function withBundle(
  worktable: Worktable,
  ref: string,
  edit: (bundle: ContextBundle) => ContextBundle | string
): WorktableOutcome<ContextBundle> {
  const bundle = findBundle(worktable, ref);

  if (!bundle) return fail(`No bundle "${ref}" on the worktable.`);
  const next = edit(bundle);

  if (typeof next === "string") return fail(next);

  return {
    ok: true,
    worktable: {
      ...worktable,
      bundles: worktable.bundles.map((b) => (b.id === bundle.id ? next : b)),
    },
    value: next,
  };
}

function nameTaken(worktable: Worktable, name: string, exceptId?: string): boolean {
  const lower = name.toLowerCase();

  return worktable.bundles.some((b) => b.id !== exceptId && b.name.toLowerCase() === lower);
}

function stampItems(
  items: ReadonlyArray<ResolvedWorktableItem>,
  taken: Set<string>,
  now: string,
  newId: () => string
): WorktableItem[] {
  return items.map((item) => {
    const id = shortId("it", taken, newId);

    taken.add(id);

    return { ...item, id, addedAt: now, updatedAt: now };
  });
}

export function createBundle(
  worktable: Worktable,
  args: BundleFields & { name: string; items?: ReadonlyArray<ResolvedWorktableItem> },
  now: string,
  newId: () => string = defaultNewId
): WorktableOutcome<ContextBundle> {
  const name = args.name.trim().slice(0, WORKTABLE_LIMITS.nameChars);
  const items = args.items ?? [];

  if (!name) return fail("A bundle needs a name.");
  if (nameTaken(worktable, name)) return fail(`A bundle named "${name}" already exists.`);
  if (worktable.bundles.length >= WORKTABLE_LIMITS.bundles) {
    return fail(
      `The worktable holds at most ${WORKTABLE_LIMITS.bundles} bundles. Delete one first.`
    );
  }
  if (items.length > WORKTABLE_LIMITS.itemsPerBundle) {
    return fail(`A bundle holds at most ${WORKTABLE_LIMITS.itemsPerBundle} items.`);
  }

  const bundle: ContextBundle = {
    id: shortId("wt", new Set(worktable.bundles.map((b) => b.id)), newId),
    name,
    purpose: cleanOptional(args.purpose, WORKTABLE_LIMITS.purposeChars) ?? null,
    instructions: cleanOptional(args.instructions, WORKTABLE_LIMITS.instructionsChars) ?? null,
    items: stampItems(items, new Set(), now, newId),
    createdAt: now,
    updatedAt: now,
    sendCount: 0,
    lastSentAt: null,
  };

  return {
    ok: true,
    worktable: { ...worktable, bundles: [...worktable.bundles, bundle] },
    value: bundle,
  };
}

export function updateBundle(
  worktable: Worktable,
  ref: string,
  fields: BundleFields,
  now: string
): WorktableOutcome<ContextBundle> {
  return withBundle(worktable, ref, (bundle) => {
    const name = fields.name?.trim().slice(0, WORKTABLE_LIMITS.nameChars);

    if (fields.name !== undefined && !name) return "A bundle needs a name.";
    if (name && nameTaken(worktable, name, bundle.id))
      return `A bundle named "${name}" already exists.`;
    const purpose = cleanOptional(fields.purpose, WORKTABLE_LIMITS.purposeChars);
    const instructions = cleanOptional(fields.instructions, WORKTABLE_LIMITS.instructionsChars);

    return {
      ...bundle,
      ...(name ? { name } : {}),
      ...(purpose !== undefined ? { purpose } : {}),
      ...(instructions !== undefined ? { instructions } : {}),
      updatedAt: now,
    };
  });
}

export function addBundleItems(
  worktable: Worktable,
  ref: string,
  items: ReadonlyArray<ResolvedWorktableItem>,
  now: string,
  newId: () => string = defaultNewId
): WorktableOutcome<ContextBundle> {
  return withBundle(worktable, ref, (bundle) => {
    if (bundle.items.length + items.length > WORKTABLE_LIMITS.itemsPerBundle) {
      return `A bundle holds at most ${WORKTABLE_LIMITS.itemsPerBundle} items; "${bundle.name}" has ${bundle.items.length}.`;
    }

    return {
      ...bundle,
      items: [
        ...bundle.items,
        ...stampItems(items, new Set(bundle.items.map((i) => i.id)), now, newId),
      ],
      updatedAt: now,
    };
  });
}

/** Replace one item's content in place; it keeps its id and position. */
export function replaceBundleItem(
  worktable: Worktable,
  ref: string,
  itemId: string,
  item: ResolvedWorktableItem,
  now: string
): WorktableOutcome<ContextBundle> {
  return withBundle(worktable, ref, (bundle) => {
    if (!bundle.items.some((i) => i.id === itemId)) return `No item ${itemId} in "${bundle.name}".`;

    return {
      ...bundle,
      items: bundle.items.map((i) => (i.id === itemId ? { ...i, ...item, updatedAt: now } : i)),
      updatedAt: now,
    };
  });
}

export function removeBundleItems(
  worktable: Worktable,
  ref: string,
  itemIds: ReadonlyArray<string>,
  now: string
): WorktableOutcome<ContextBundle> {
  return withBundle(worktable, ref, (bundle) => {
    const drop = new Set(itemIds);
    const missing = itemIds.filter((id) => !bundle.items.some((i) => i.id === id));

    if (missing.length > 0) return `No item ${missing.join(", ")} in "${bundle.name}".`;

    return { ...bundle, items: bundle.items.filter((i) => !drop.has(i.id)), updatedAt: now };
  });
}

export function deleteBundle(worktable: Worktable, ref: string): WorktableOutcome<ContextBundle> {
  const bundle = findBundle(worktable, ref);

  if (!bundle) return fail(`No bundle "${ref}" on the worktable.`);

  return {
    ok: true,
    worktable: { ...worktable, bundles: worktable.bundles.filter((b) => b.id !== bundle.id) },
    value: bundle,
  };
}

/** Record that these bundles went out with a dispatch. */
export function markBundlesSent(
  worktable: Worktable,
  bundleIds: ReadonlyArray<string>,
  now: string
): Worktable {
  const sent = new Set(bundleIds);

  return {
    ...worktable,
    bundles: worktable.bundles.map((b) =>
      sent.has(b.id) ? { ...b, sendCount: b.sendCount + 1, lastSentAt: now } : b
    ),
  };
}

/** Count one automatic dispatch against the cap; refuses once the cap is spent. */
export function reserveAutonomousDispatch(
  worktable: Worktable,
  cap: number
): WorktableOutcome<number> {
  if (worktable.autonomousDispatches >= cap) {
    return fail(
      `Automatic turns may dispatch at most ${cap} times until the user speaks again. Tell the user what you would send next instead.`
    );
  }
  const used = worktable.autonomousDispatches + 1;

  return { ok: true, worktable: { ...worktable, autonomousDispatches: used }, value: used };
}
