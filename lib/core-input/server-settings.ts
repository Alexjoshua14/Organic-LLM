import "server-only";

import type { CoreInputScope } from "./scopes";

import { cookies } from "next/headers";

import {
  CORE_INPUT_COOKIE_NAME,
  decodeSettingsCookie,
  resolveCookieSettings,
} from "./settings-cookie";

/** Request-local only: the cookie is a display hint, never an authorization source. */
export async function readCoreInputInitialSettings(scope: CoreInputScope) {
  const cookieStore = await cookies();

  return resolveCookieSettings(
    decodeSettingsCookie(cookieStore.get(CORE_INPUT_COOKIE_NAME)?.value),
    scope
  );
}
