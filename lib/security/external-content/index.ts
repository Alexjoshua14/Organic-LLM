export type {
  ConfirmedFetchToken,
  ExternalContentFetchMode,
  ExternalContentFetchResult,
  ExternalContentFetchError,
  ExternalContentInitiator,
  ExternalContentSource,
  FetchConfirmationRequest,
  FetchExternalContentOptions,
  FetchExternalContentResult,
  UntrustedContentKind,
} from "./types";

export {
  assertSafePublicHttpsUrl,
  isBlockedHostAddress,
  isBlockedIPv4,
  isBlockedIPv6,
  isIpLiteralHost,
  type SafeUrlResult,
} from "./safe-url";

export {
  assertSafePublicHttpsUrlResolved,
  resolveAndAssertSafeHost,
  type DnsLookupFn,
  type ResolveHostResult,
} from "./safe-url-resolved";

export { safeFetch, type SafeFetchFn, type SafeFetchOptions } from "./safe-fetch";

export { extractReadableText, normalizeWhitespace, stripControlAndZeroWidth } from "./extract-text";

export {
  UNTRUSTED_EXTERNAL_CONTENT_GUARDRAIL,
  buildPromptSafeRawInputBlock,
  sanitizeRawUserInput,
  sanitizeUntrustedText,
  wrapUntrustedContent,
  wrapWebSearchResultsForModel,
} from "./untrusted";

export {
  buildFetchConfirmationRequest,
  createConfirmedFetchToken,
  requiresModelFetchConfirmation,
  verifyFetchConfirmation,
  type VerifyFetchConfirmationResult,
} from "./confirm";

export {
  fetchExternalContent,
  fetchExternalContentText,
  type FetchExternalContentParams,
} from "./fetch-external-content";
