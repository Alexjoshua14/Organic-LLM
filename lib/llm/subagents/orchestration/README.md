# Orchestration Layer — Thoughts

> How Aion routes to subagents, how subagents coordinate, and cross-cutting strategy.

---

## Routing Logic

<!-- 
  How does Aion decide which L1 to invoke?
  Keyword-based? Intent classification? LLM self-routing?
  What if a request spans multiple domains? (e.g., "review this code for security and generate an architecture diagram")
  Parallel fan-out to multiple L1 agents?
-->


## Model Strategy

<!-- 
  How to decide which model each agent uses?
  Static config? Dynamic selection based on task complexity?
  Benchmarking pipeline — how often to re-evaluate model assignments?
  Cost-quality tradeoff framework?
-->


## Agent Communication Patterns

<!-- 
  Strictly hierarchical (L0→L1→L2) or can agents talk laterally?
  Can L2 agents call other L2 agents? (e.g., security agent asks local files agent to read a config)
  Message format between layers — structured JSON? Natural language? Both?
-->


## Streaming & Latency

<!-- 
  How to stream L2 results through L1 back to L0?
  Progressive rendering — show partial results as specialists complete?
  Timeout strategy per layer?
-->


## State & Context Passing

<!-- 
  What context does Aion pass to L1? Full conversation? Just the relevant excerpt?
  Token budget allocation — how much context can each layer consume?
  Caching: can L1 cache project metadata to avoid re-fetching?
-->


## Observability & Debugging

<!-- 
  Agent trace format — how to log the full L0→L1→L2 chain?
  User-facing transparency — does the user see which agents were involved?
  Developer debugging — how to replay a failed agent chain?
-->


## Future Patterns

<!-- 
  Agent loops (L1 calls L2, evaluates result, calls again with refinement)?
  Agent voting (multiple L2s answer the same question, L1 picks best)?
  Human-in-the-loop (agent pauses for user confirmation before proceeding)?
  Anything else that doesn't fit elsewhere?
-->

