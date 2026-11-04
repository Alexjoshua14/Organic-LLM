import type { ChatEffortLevel } from "@/lib/schemas/chat-effort";
import type { ContextEffortLevel } from "@/lib/memory/context-effort";

/**
 * Everything CoreInput lets the user dial before a send. A snapshot of this shape is what
 * gets cached per scope (thread, area, side thread) and morphed between.
 *
 * Markdown preview is deliberately absent: it describes the draft, not the turn.
 */
export type CoreInputSettings = {
  modelId: string;
  effort: ChatEffortLevel;
  contextEffort: ContextEffortLevel;
  webSearch: boolean;
  memories: boolean;
  speechFriendly: boolean;
};

export type CoreInputSettingField = keyof CoreInputSettings;

/**
 * Order fields change in during a morph. Model leads because effort and context effort are
 * clamped against it; the toggles follow left-to-right as they sit in the footer.
 */
export const CORE_INPUT_SETTING_FIELDS: readonly CoreInputSettingField[] = [
  "modelId",
  "effort",
  "contextEffort",
  "webSearch",
  "memories",
  "speechFriendly",
];

export function changedSettingFields(
  from: CoreInputSettings,
  to: CoreInputSettings
): CoreInputSettingField[] {
  return CORE_INPUT_SETTING_FIELDS.filter((field) => from[field] !== to[field]);
}

export function settingsEqual(a: CoreInputSettings, b: CoreInputSettings): boolean {
  return changedSettingFields(a, b).length === 0;
}
