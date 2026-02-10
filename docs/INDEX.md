# Documentation Index

Structured index of project documentation. Use this to find the right doc; use [PROJECT_KNOWLEDGE.md](./PROJECT_KNOWLEDGE.md) for goals, design, and architecture.

---

## Entry points

| Doc                                            | Description                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| [PROJECT_KNOWLEDGE.md](./PROJECT_KNOWLEDGE.md) | **Holistic view:** vision, design pillars, architecture map, feature → doc links. |
| [../README.md](../README.md)                   | Project overview, roadmap (v0–v5), principles, setup.                             |

---

## Architecture & design

| Doc                                                                                            | Description                                                                                        |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [SYNTAX_ARCHITECTURE.md](./SYNTAX_ARCHITECTURE.md)                                             | Extended markdown directives: `::name{ key="val" }` grammar, layers, LLM → parser → resolution.    |
| [chat-llm-transparency.md](./chat-llm-transparency.md)                                         | How chat exposes model process: `data-aiAction`, reasoning/tool/search UI, backend → client flow.  |
| [speak-page-architecture.md](./speak-page-architecture.md)                                     | Speak page: component tree, state machine (DisplayMode), data flow, TTS stream, playback.          |
| [speak-page-workflow.md](./speak-page-workflow.md)                                             | Speak workflow and step-by-step flow.                                                              |
| [../app/rabbitholes/rabbithole-architecture.md](../app/rabbitholes/rabbithole-architecture.md) | Rabbit Holes: `useRabbitHoles` hook, session vs node, nodesById/path/edges, actions, dependencies. |

---

## UI & presence

| Doc                                                                                    | Description                                                                                        |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [organic-presence.md](./organic-presence.md)                                           | Organic presence components: OrganicPresence, Compact, Adaptive; props, states, design philosophy. |
| [organic-presence-integration-examples.md](./organic-presence-integration-examples.md) | Code examples for integrating presence in home, speak, etc.                                        |
| [adaptive-background.md](./adaptive-background.md)                                     | Adaptive background behavior and integration.                                                      |
| [adaptive-background-timing.md](./adaptive-background-timing.md)                       | Timing and animation details for adaptive background.                                              |
| [../components/ambient/README.md](../components/ambient/README.md)                     | Ambient components (local to `components/ambient/`).                                               |

---

## Rabbit Holes

| Doc                                                                              | Description                                           |
| -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [rabbit-hole-session-size-estimate.md](./rabbit-hole-session-size-estimate.md)   | Session size estimates and constraints.               |
| [rabbit-hole-localstorage-quota-fix.md](./rabbit-hole-localstorage-quota-fix.md) | LocalStorage quota handling for rabbit hole sessions. |

---

## TTS & Speak

| Doc                                                                      | Description                                        |
| ------------------------------------------------------------------------ | -------------------------------------------------- |
| [tts-token-tracker.md](./tts-token-tracker.md)                           | TTS token tracker: design and behavior.            |
| [tts-token-tracker-summary.md](./tts-token-tracker-summary.md)           | Short summary of token tracker.                    |
| [tts-token-tracker-visual-guide.md](./tts-token-tracker-visual-guide.md) | Visual guide for token tracker.                    |
| [tts-token-tracker-maintenance.md](./tts-token-tracker-maintenance.md)   | Maintenance and extension notes for token tracker. |

---

## Security, integrations, migrations

| Doc                                                                                      | Description                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| [e2ee.md](./e2ee.md)                                                                     | End-to-end encryption approach and design. |
| [MCPsequenceDiagram.md](./MCPsequenceDiagram.md)                                         | MCP sequence and integration diagram.      |
| [migrations/ai_jobs_table.sql](./migrations/ai_jobs_table.sql)                           | SQL migration: AI jobs table.              |
| [migrations/rabbit_hole_sessions_table.sql](./migrations/rabbit_hole_sessions_table.sql) | SQL migration: rabbit hole sessions table. |

---

## Prototypes & fixtures

| Doc                                                                                                | Description                    |
| -------------------------------------------------------------------------------------------------- | ------------------------------ |
| [../app/prototypes/markdown-directives/README.md](../app/prototypes/markdown-directives/README.md) | Markdown directives prototype. |
| [../tests/fixtures/README.md](../tests/fixtures/README.md)                                         | Test fixtures and usage.       |

---

## Dev logs (historical)

| Doc                                                                                        | Description                               |
| ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| [../dev-logs/tts-logs-9-6-2025.md](../dev-logs/tts-logs-9-6-2025.md)                       | TTS flow and timing notes (Sept 6, 2025). |
| [../dev-logs/tts-time-trial-logs-9-7-2025.md](../dev-logs/tts-time-trial-logs-9-7-2025.md) | TTS time trial logs (Sept 7, 2025).       |

---

_When adding a new doc, add it here and, if it describes a major feature, link it from [PROJECT_KNOWLEDGE.md](./PROJECT_KNOWLEDGE.md) §5._
