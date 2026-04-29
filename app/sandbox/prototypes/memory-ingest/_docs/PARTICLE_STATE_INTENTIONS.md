# Particle state intentions (living doc)

**Purpose:** Capture *why* each visual state exists and how it should *feel*, separate from implementation details. **Implementation** lives in `[../_lib/lens/recipes.ts](../_lib/lens/recipes.ts)` and shaders — this file is for product / motion art direction.

**How to maintain:** When you add or rename a state, add a row. If intention is not decided yet, leave **Intention** blank or write `TBD`. When motion ships or changes, update **Current motion notes** so the doc stays honest.

**Naming:** In design writeups, `**idle` and `idle_ready` are the same state.** The codebase and FSM use the identifier `idle_ready` only; there is no separate `idle` enum value.

---

## Visual grammar (reference)


| Axis            | Meaning (target)                    |
| --------------- | ----------------------------------- |
| Inward          | Reading, gathering, considering     |
| Settled / pulse | Committing, resolving               |
| Lateral         | Connecting                          |
| Sweeping        | Reviewing holistically              |
| Outward         | Speaking, presenting, reaching away |



| Tempo         | Meaning (target)                             |
| ------------- | -------------------------------------------- |
| Slow          | Ambient, background                          |
| Medium        | Engaged work                                 |
| Brief / sharp | Punctuation moments                          |
| Held          | Suspended tension (e.g. draft not committed) |


---

## Implemented states (v1 codebase)

These names match `ParticleFieldVisualState` in `[../_lib/types.ts](../_lib/types.ts)`.


| State                 | Intention                                                                   | Current motion notes (high level)                                                                                        |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `idle_ready` (`idle`) | Calm presence: system is ready, not pressuring. Standing by.                | Slow tempo; breath + light curl; very low jitter; rounded-cube-heavy scaffold.                                           |
| `listening`           | User is composing; Archivist is receiving. Subtle orientation toward input. | Slightly higher tempo than `idle_ready`; breath + curl; anisotropy points “toward user” for lean; low jitter.            |
| `ingesting`           | Request in flight / parsing; strong inward pull while work streams.         | High tempo; strong **absorption** along −Z anisotropy; curl moderate; cube weight reduced so pull reads.                 |
| `searching_memory`    | Consulting existing record before responding; inward reach.                 | Inward **tendrilReach** with −Z anisotropy; curl + coherence tuned for “probing”; tendril mask on subset of particles.   |
| `reasoning`           | Heavier cognitive / reasoning stream (distinct from generic ingest).        | Looser scaffold (lower cube weight), higher **sphere** + **clusterAttract**; slow tempo, very high coherence; more curl. |
| `web_search`          | Outward, exploratory reach (web / search tool).                             | High tempo, low coherence; outward **tendrilReach** with +Z anisotropy; higher curl + slight jitter.                     |
| `writing_memory`      | Receipt: something was filed; brief crystallize then return to calm.        | High cube weight, strong breath, low curl; high coherence; settle / pulse feel (plus existing glow pulse hook).          |


---

## Named in design exploration, **not** in v1 code yet

Use this section for states from narrative specs that are **not** members of `ParticleFieldVisualState` today. When implemented, move the row up and wire FSM + recipe.


| State (proposed) | Intention                                                                   | Current motion notes |
| ---------------- | --------------------------------------------------------------------------- | -------------------- |
| `composing`      | Draft memory candidate; held, not committed. Gathering / suspended tension. | —                    |
| `weaving`        | Link two memories; lateral connection between two loci.                     | —                    |
| `reconciling`    | Dream-pass audit; slow holistic sweep.                                      | —                    |
| `flagging`       | Bookmark / follow-up without commit; micro-pulse.                           | —                    |
| `responding`     | Generic model turn / outward speech.                                        | —                    |


---

## Cross-reference: FSM → visual (today)

Rough mapping from `[../_lib/memory-ingest-fsm.ts](../_lib/memory-ingest-fsm.ts)` (stream events, not exhaustive):

- Draft empty → `idle_ready`; draft has text → `listening`.
- Submit / streaming early → `ingesting`.
- `AI_ACTION` / `Reasoning` → `reasoning`; `Search` → `web_search`; `Memory` → `searching_memory`; tools fall through to ingest/search depending on tool name and tier.
- Finish with memory enabled → `writing_memory`; receipt done / error → `idle_ready`.

When intentions above drift from this mapping, update **either** this doc **or** the FSM — keep them aligned deliberately.