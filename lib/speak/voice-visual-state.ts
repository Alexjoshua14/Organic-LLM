import type { SpeakToolClientEffect } from "@/lib/speak/types";

/**
 * Visual output a voice session has produced: display text, gen-UI blocks, web previews, and
 * per-surface UI state.
 *
 * This used to live as `useState` inside `LiveVoiceStage`. Once the session outlives the page,
 * so must its output — a card the agent rendered while you were on `/speak` should still be
 * there when you come back from Arcadia. Keeping it a pure reducer also makes the merge rules
 * (remount keys, surface upserts) testable without a peer connection.
 */
export type VoiceVisualState = {
  displayText: string | null;
  genUiBlocks: Array<{ instanceId: string; block: unknown; remountKey: number }>;
  webPreview: { url: string; title?: string } | null;
  uiStateBySurface: Record<string, Array<{ id: string; data: Record<string, unknown> }>>;
};

export const EMPTY_VOICE_VISUAL_STATE: VoiceVisualState = {
  displayText: null,
  genUiBlocks: [],
  webPreview: null,
  uiStateBySurface: {},
};

/**
 * Folds one effect into the state.
 *
 * `remountKey` increments rather than the block being replaced in place: gen-UI blocks own
 * internal state, and a re-render of the same `instanceId` means "this content changed, start
 * over" — which React only honours if the key changes.
 */
export function applyVoiceEffect(
  state: VoiceVisualState,
  effect: SpeakToolClientEffect
): VoiceVisualState {
  switch (effect.type) {
    case "display_text":
      return { ...state, displayText: effect.text };

    case "gen_ui": {
      const existing = state.genUiBlocks.find((b) => b.instanceId === effect.instanceId);

      return {
        ...state,
        genUiBlocks: existing
          ? state.genUiBlocks.map((b) =>
              b.instanceId === effect.instanceId
                ? {
                    instanceId: effect.instanceId,
                    block: effect.block,
                    remountKey: b.remountKey + 1,
                  }
                : b
            )
          : [
              ...state.genUiBlocks,
              { instanceId: effect.instanceId, block: effect.block, remountKey: 0 },
            ],
      };
    }

    case "refresh_component":
      return {
        ...state,
        genUiBlocks: state.genUiBlocks.map((b) =>
          b.instanceId === effect.instanceId ? { ...b, remountKey: b.remountKey + 1 } : b
        ),
      };

    case "upsert_ui_state": {
      const current = state.uiStateBySurface[effect.surfaceId] ?? [];
      const byId = new Map(current.map((i) => [i.id, i]));

      for (const item of effect.items) {
        byId.set(item.id, item);
      }

      return {
        ...state,
        uiStateBySurface: { ...state.uiStateBySurface, [effect.surfaceId]: [...byId.values()] },
      };
    }

    case "web_preview":
      return { ...state, webPreview: { url: effect.url, title: effect.title } };

    default:
      return state;
  }
}

export function applyVoiceEffects(
  state: VoiceVisualState,
  effects: SpeakToolClientEffect[]
): VoiceVisualState {
  return effects.reduce(applyVoiceEffect, state);
}
