export type ExternalContentFetchMode = "auto" | "exa-only" | "direct";

/** Who initiated the fetch — affects confirmation requirements for direct mode. */
export type ExternalContentInitiator = "server" | "user" | "model";

export type ExternalContentSource = "exa" | "origin";

export type ExternalContentFetchResult = {
  ok: true;
  text: string;
  finalUrl: string;
  source: ExternalContentSource;
  truncated: boolean;
};

export type ExternalContentFetchError = {
  ok: false;
  reason: string;
  code?:
    | "unsafe_url"
    | "dns_blocked"
    | "fetch_failed"
    | "content_type"
    | "size_exceeded"
    | "redirect_blocked"
    | "confirmation_required"
    | "confirmation_invalid"
    | "empty_content"
    | "exa_failed";
};

export type FetchExternalContentResult = ExternalContentFetchResult | ExternalContentFetchError;

export type UntrustedContentKind =
  | "webpage"
  | "web_search_result"
  | "source_snippet"
  | "source_title"
  | "raw_user_input";

export type FetchConfirmationRequest = {
  url: string;
  hostname: string;
  reason?: string;
};

export type ConfirmedFetchToken = {
  url: string;
  issuedAt: number;
  nonce: string;
  expiresAt: number;
  signature: string;
};

export type FetchExternalContentOptions = {
  mode?: ExternalContentFetchMode;
  maxChars?: number;
  initiatedBy?: ExternalContentInitiator;
  confirmation?: ConfirmedFetchToken;
};
