# Scope voice startup to one connection attempt

Date: 2026-10-29

## Context

Microphone preparation already waits for browser permission before minting a session. However,
React's `connecting` state is not a synchronous lock: two Starts in one render, or a late
`/active` response holding an older closure, can begin overlapping permission requests. A
cancelled request can also reject after a newer connection starts and tear that connection
down. The same stale-continuation problem exists during minting, SDP negotiation, and retry
backoff.

## Decision

The voice hook locks startup with a ref before its first asynchronous operation. A connection
generation advances on Start and teardown; each continuation checks that it still belongs to
the current generation before updating state, retrying, or reporting an error. A late mint
still releases its own server session. Auto-resume discovery yields to any Start or End that
happened while discovery was pending. Transport callbacks additionally check their transport's
identity so a failed SDP attempt cannot affect its replacement within the same retry sequence.

Permission approval continues the original attempt; denial keeps the existing recovery
message without minting a session. End and unmount invalidate pending work. The existing one
retry for SDP server errors remains unchanged.

## Validation

`tests/unit/voice-microphone.test.ts` covers delayed approval and denial, overlapping Starts,
late auto-resume discovery, cancellation during permission and minting, and an old permission
rejection after a new connection. `tests/unit/voice-connection-lifecycle.test.ts` covers late
mint failure, cancellation during negotiation and retry backoff, successful SDP retry, and
callbacks from a replaced transport. These are mocked lifecycle tests; first-use permission
and two-way audio on a physical HTTPS browser remain manual validation.
