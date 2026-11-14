# Realtime context and usage cost controls

Status: Accepted for implementation; deployment follows PR review.

## Decision

Limit each Realtime response to 8,000 post-instruction conversation tokens. Retain 80% when
trimming, creating headroom between truncations. Keep shared instructions ahead of dynamic
session context, and skip screen-item replacement when the resolved text has not changed.
Actual screen changes still replace the old item so awareness remains current.

Read `cached_tokens_details` to distinguish cached text from cached audio and price each at
its modality's rate. Heartbeats and normal disconnects send measured usage, including an
explicit zero during quiet intervals. Missing reports from abandoned sessions retain the
existing conservative estimate; zero usage is not inferred from a missing report.

Round cumulative session minutes for the daily allowance. Rounding every 30-second heartbeat
separately consumed one minute per half-minute, prematurely exhausting the allowance. Short
sessions still consume a whole minute unit.

## Tradeoffs and limits

The smaller conversation window forgets older live details sooner; stored transcripts and the
existing resume preamble remain intact. Truncation can still cause cache misses. Caching is
best effort, and genuine screen-context replacement can invalidate the affected prefix.

These changes reduce repeated provider input and correct application estimates. They do not
change session deadlines, idle behavior, account caps, or the cost of newly generated speech.
Input transcription is billed separately and remains outside the application token meter.
Client-reported usage is still the existing metering trust boundary; this is not a provider
invoice reconciliation system.

## Validation

Regression coverage checks cached-audio pricing and accumulation, unchanged screen revisions,
zero-usage heartbeats, final-response settlement, and minute consumption across heartbeat cadences.

## Source

[OpenAI Realtime cost optimization](https://developers.openai.com/api/docs/guides/voice-latency-cost)
documents silence filtering, prefix caching, modality-specific usage and bounded truncation.
