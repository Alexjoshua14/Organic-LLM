"use client";

import type { RefObject } from "react";

import { useLumenRim, useLumenRimHostRef } from "@coalescence-labs/design/lumen";

export function useChatStyleCardLumenHostRef() {
  return useLumenRimHostRef();
}

/** Sync lumen rim band metrics for Arcadia style picker cards. */
export function useChatStyleCardLumen(
  hostRef: RefObject<HTMLSpanElement | null>,
  enabled: boolean
) {
  useLumenRim(hostRef, { target: ".chat-style-card", enabled });
}
