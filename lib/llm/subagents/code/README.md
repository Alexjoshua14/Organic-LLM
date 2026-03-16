# Code Subagent Architecture

> Swarm-of-experts subsystem for code intelligence, orchestrated by Aion.

---

## Overview

The Code Subagent is a **two-layer agent hierarchy** that gives Aion (Layer 0) deep code expertise. Rather than bloating Aion's tool surface with dozens of code-specific tools, we introduce a **Layer 1 orchestrator** that owns all code-related reasoning, and a set of **Layer 2 specialist agents** that handle niche domains.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 0 — Aion (main user-facing LLM)                      │
│  Detects code-related intent → delegates to L1              │
└──────────────────────────┬──────────────────────────────────┘
                           │  tool call: invoke_code_agent
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 — Code Agent (heavyweight LLM)                     │
│  Understands code, translates code↔speech, orchestrates L2  │
└───┬────────┬────────┬────────┬────────┬────────┬────────┬───┘
    │        │        │        │        │        │        │
    ▼        ▼        ▼        ▼        ▼        ▼        ▼
┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
│GitHub││Local ││Archi-││Dia-  ││Secu- ││A11y  ││  …   │
│Agent ││Files ││tect  ││grams ││rity  ││Agent ││      │
│      ││Agent ││Agent ││Agent ││Agent ││      ││      │
└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘
  Layer 2 Specialists (lightweight / medium-weight LLMs)
```

---

## Design Principles

1. **Best-model-at-the-time for L1** — The Layer 1 agent always runs on the highest-quality available model (currently `gpt-5.2` / `claude-opus-4-6`) to maximize raw intelligence for code comprehension, explanation, and orchestration decisions. As frontier models improve, L1 automatically benefits.

2. **Right-sized models for L2** — Each specialist uses the lightest model that meets its quality bar. GitHub API calls don't need Opus; diagram generation doesn't need GPT-5. This keeps latency low and cost manageable.

3. **Minimal agent count** — Group related capabilities into a single L2 agent when quality isn't sacrificed. Prefer one "Source Control Agent" (GitHub + local git) over separate GitHub and Git agents.

4. **Tool-native integration** — L1 is exposed to Aion as a single AI SDK `tool()`. L2 specialists are exposed to L1 as tools. This keeps the existing `streamText` / tool-call architecture intact and avoids custom RPC.

5. **Streaming transparency** — L1 and L2 progress is surfaced to the user via `data-notification` writer events, so the user sees "Analyzing code...", "Checking GitHub...", etc.

6. **Stateless by default** — Each agent invocation is self-contained. Long-lived state (repo metadata, file caches) lives in external stores, not in agent memory.

---

## Layer 0 → Layer 1 Interface

### How Aion invokes the Code Agent

Aion receives a new tool in its toolkit:

```typescript
// lib/llm/subagents/code/tool.ts
import { tool } from "ai";
import { z } from "zod";

export const invokeCodeAgentTool = tool({
  description:
    "Delegate a code-related task to the Code Agent, a specialized sub-intelligence " +
    "for understanding, explaining, generating, reviewing, and managing code. Use this " +
    "when the user's request involves source code, repositories, architecture, diagrams, " +
    "code security, accessibility audits, or any programming-related task that benefits " +
    "from deep code expertise.",
  inputSchema: z.object({
    task: z
      .string()
      .describe(
        "A clear, self-contained description of what the Code Agent should do. " +
        "Include all relevant context — code snippets, file paths, repo URLs, " +
        "constraints — so the agent can act without further clarification."
      ),
    context: z
      .object({
        codeSnippet: z.string().optional().describe("Inline code the user provided"),
        language: z.string().optional().describe("Programming language if known"),
        repoUrl: z.string().optional().describe("GitHub/remote repo URL if relevant"),
        filePaths: z.array(z.string()).optional().describe("Local file paths if relevant"),
      })
      .optional()
      .describe("Structured context extracted from the user's message"),
    priority: z
      .enum(["low", "normal", "high"])
      .default("normal")
      .describe("Urgency — affects model selection and timeout"),
  }),
  execute: async ({ task, context, priority }) => {
    // Implementation calls the L1 Code Agent (see below)
  },
});
```

### When Aion should delegate vs. handle directly

| Signal | Action |
|--------|--------|
| User pastes code and asks "what does this do?" | **Aion handles directly** (pure comprehension, Aion's model is already strong) |
| User pastes code and asks "refactor this for security" | **Delegate to L1** (needs security specialist) |
| "Show me recent changes on my GitHub repo" | **Delegate to L1** → L1 delegates to GitHub specialist |
| "Create an architecture diagram for this service" | **Delegate to L1** → L1 delegates to Diagram specialist |
| "Is this code accessible?" | **Delegate to L1** → L1 delegates to A11y specialist |
| General programming question (no tool needed) | **Aion handles directly** |

The heuristic: Aion handles **pure reasoning about code** (explanation, translation, Q&A). It delegates when the task requires **external tools** (GitHub API, file system, diagram rendering) or **specialist knowledge** (security audit, a11y review, architecture patterns).

---

## Layer 1 — Code Agent

### Identity

The Code Agent is the **generalist code intelligence**. It is the best available LLM, tuned for:

- **Code comprehension** — reading, explaining, translating code to/from natural language
- **Orchestration** — deciding which L2 specialist(s) to invoke, composing their outputs
- **Code generation** — writing, refactoring, completing code when no specialist is needed
- **Synthesis** — combining results from multiple specialists into a coherent response

### Model Selection Strategy

```typescript
// lib/llm/subagents/code/models.ts
export const CODE_AGENT_MODELS = {
  // L1 always uses the best available model for maximum intelligence
  layer1: {
    primary: "openai/gpt-5.2",
    fallback: "anthropic/claude-opus-4-6",
  },

  // L2 models are right-sized per specialist
  layer2: {
    github:    { primary: "openai/gpt-5-mini",  fallback: "google/gemini-3-flash" },
    localFiles:{ primary: "openai/gpt-5-mini",  fallback: "google/gemini-3-flash" },
    architect: { primary: "openai/gpt-5.2",     fallback: "anthropic/claude-sonnet-4.5" },
    diagrams:  { primary: "openai/gpt-5-mini",  fallback: "google/gemini-3-flash" },
    security:  { primary: "anthropic/claude-sonnet-4.5", fallback: "openai/gpt-5" },
    a11y:      { primary: "openai/gpt-5-mini",  fallback: "google/gemini-3-flash" },
  },
} as const;
```

The L1 model should be periodically benchmarked and swapped to whatever frontier model scores highest on code reasoning (HumanEval, SWE-bench, etc.).

### System Prompt (sketch)

```
You are the Code Agent, Layer 1 of the code intelligence subsystem within Organic LLM.

Your role:
- Understand and explain code in any programming language
- Orchestrate specialist sub-agents for tasks requiring external tools or domain expertise
- Synthesize multi-agent results into coherent, user-friendly responses
- Generate, refactor, and review code when no specialist is needed

You have access to the following specialist tools:
- github_agent: GitHub API operations (repos, PRs, commits, issues, diffs)
- local_files_agent: Local filesystem operations (read, search, diff, recent changes)
- architect_agent: Software architecture analysis, design patterns, system design
- diagrams_agent: Mermaid/PlantUML diagram generation and rendering
- security_agent: Security audit, vulnerability detection, OWASP guidance
- a11y_agent: Accessibility audit (WCAG compliance, screen reader, ARIA)

Decision framework:
1. If the task is pure code understanding or generation → handle it yourself
2. If the task needs external data (GitHub, files) → delegate to the appropriate specialist
3. If the task needs domain expertise (security, a11y, architecture) → delegate
4. If the task spans multiple domains → invoke specialists in parallel, then synthesize
5. Always return a unified, coherent response to the caller
```

### Execution Flow

```
User message → Aion
  │
  ├─ Aion detects code intent
  ├─ Aion calls invoke_code_agent tool with task + context
  │
  ├─ L1 Code Agent receives task
  │   ├─ Analyzes: can I handle this alone?
  │   │   ├─ YES → generates response directly
  │   │   └─ NO → identifies needed specialist(s)
  │   │        ├─ Calls specialist tool(s) (parallel when independent)
  │   │        ├─ Receives specialist results
  │   │        └─ Synthesizes final response
  │   │
  │   └─ Returns structured result to Aion
  │
  └─ Aion incorporates result into user-facing response
```

---

## Layer 2 — Specialist Agents

### Agent Catalog

Each L2 specialist is implemented as a tool available to L1. Internally, each tool either calls an LLM with a specialist system prompt, or directly executes deterministic logic (API calls, file reads).

---

#### 1. Source Control Agent (`github_agent`)

**Scope:** GitHub API + local git operations (grouped to avoid split-brain on VCS tasks)

**Capabilities:**
- Fetch repo metadata, README, file tree
- List/read PRs, issues, commits, diffs
- Compare branches, show recent changes
- Search code across repos (GitHub code search API)
- Local git log, git diff, git status

**Model:** `gpt-5-mini` (mostly structured API calls, minimal reasoning)

**Tools/APIs:**
- GitHub REST/GraphQL API (via `octokit` or direct fetch)
- Local `git` CLI via sandboxed exec
- Exa code search as fallback for broader queries

**Example invocations:**
- "Show me the last 5 commits on `main`"
- "What changed in PR #42?"
- "Find all files importing `useAuth` in the repo"

---

#### 2. Local Files Agent (`local_files_agent`)

**Scope:** Local filesystem access for the user's project(s)

**Capabilities:**
- Read file contents (with token-aware truncation)
- Search files by name or content (ripgrep-style)
- Show recent file modifications
- Diff files or versions
- List directory structures

**Model:** `gpt-5-mini` (mostly deterministic file I/O, LLM used for summarization)

**Tools/APIs:**
- Node.js `fs` APIs (sandboxed to allowed directories)
- `glob` / `fast-glob` for pattern matching
- `diff` library for file comparison

**Example invocations:**
- "What's in `src/components/Header.tsx`?"
- "Find all TODO comments in the project"
- "Show me files changed in the last 24 hours"

---

#### 3. Architect Agent (`architect_agent`)

**Scope:** Software architecture analysis, design patterns, system design

**Capabilities:**
- Analyze codebase structure and suggest improvements
- Recommend design patterns for given problems
- Evaluate architectural trade-offs (monolith vs. microservices, etc.)
- Generate architecture decision records (ADRs)
- Review system designs for scalability, maintainability

**Model:** `gpt-5.2` (requires strong reasoning — architecture is L1-tier intelligence)

**Note:** This specialist is intentionally heavyweight. Architecture questions require deep reasoning comparable to L1 itself. It exists as a separate agent to keep its system prompt focused and to accumulate architecture-specific few-shot examples over time.

**Example invocations:**
- "How should I structure the authentication layer?"
- "Evaluate this microservice boundary"
- "Suggest a caching strategy for this API"

---

#### 4. Diagrams Agent (`diagrams_agent`)

**Scope:** Diagram generation (Mermaid, PlantUML, ASCII)

**Capabilities:**
- Generate Mermaid diagrams from natural language or code
- Generate sequence diagrams, class diagrams, ER diagrams, flowcharts
- Convert code structure to visual diagrams
- Edit/refine existing diagrams

**Model:** `gpt-5-mini` (diagram syntax is well-defined; mini handles it well)

**Output format:** Returns Mermaid/PlantUML source that the frontend can render.

**Example invocations:**
- "Create a sequence diagram for the auth flow"
- "Generate a class diagram from these TypeScript interfaces"
- "Show me a flowchart of the checkout process"

---

#### 5. Security Agent (`security_agent`)

**Scope:** Code security analysis, vulnerability detection, remediation

**Capabilities:**
- Static analysis for common vulnerabilities (injection, XSS, CSRF, etc.)
- OWASP Top 10 compliance checking
- Dependency vulnerability scanning (advisory databases)
- Security-focused code review
- Remediation suggestions with code fixes
- Secrets detection (API keys, tokens in code)

**Model:** `claude-sonnet-4.5` (security requires careful, conservative reasoning — Anthropic models excel here)

**Example invocations:**
- "Audit this Express middleware for security issues"
- "Check this SQL query for injection vulnerabilities"
- "Are there any known CVEs in my dependencies?"

---

#### 6. Accessibility Agent (`a11y_agent`)

**Scope:** Web accessibility auditing and remediation

**Capabilities:**
- WCAG 2.1/2.2 compliance analysis
- ARIA attribute validation
- Color contrast checking
- Screen reader compatibility review
- Keyboard navigation audit
- Accessibility-focused code suggestions

**Model:** `gpt-5-mini` (a11y rules are well-defined; can be largely rule-based with LLM polish)

**Tools/APIs:**
- `axe-core` for automated checks (when running against live HTML)
- WCAG guideline reference database

**Example invocations:**
- "Is this form component accessible?"
- "Check color contrast for these hex values"
- "Add proper ARIA labels to this navigation"

---

## Implementation Plan

### Phase 1: Foundation (scaffold + L1)

```
lib/llm/subagents/code/
├── README.md                  ← this file
├── tool.ts                    ← invoke_code_agent tool (Aion's entry point)
├── agent.ts                   ← L1 Code Agent core (system prompt, model, execution loop)
├── models.ts                  ← model configuration and selection
├── types.ts                   ← shared types (CodeAgentTask, CodeAgentResult, etc.)
└── specialists/
    └── (empty, added in Phase 2)
```

**Deliverables:**
- [ ] `types.ts` — Define `CodeAgentTask`, `CodeAgentResult`, `SpecialistResult`
- [ ] `models.ts` — Model config with primary/fallback per layer
- [ ] `agent.ts` — L1 agent using AI SDK `generateText` with system prompt
- [ ] `tool.ts` — Aion-facing tool that invokes L1
- [ ] Wire `invoke_code_agent` into Aion's tool kit in `aion-handler.ts`
- [ ] Add `data-notification` events for transparency ("Code Agent analyzing...")

### Phase 2: First specialists (GitHub + Local Files)

```
lib/llm/subagents/code/specialists/
├── github.ts                  ← Source control agent
├── local-files.ts             ← Local filesystem agent
└── index.ts                   ← barrel export + specialist registry
```

**Deliverables:**
- [ ] `github.ts` — GitHub API integration + local git
- [ ] `local-files.ts` — Sandboxed file read/search/diff
- [ ] Register both as tools available to L1
- [ ] End-to-end test: "What changed in my last 3 commits?" flows through L0 → L1 → L2

### Phase 3: Remaining specialists

```
lib/llm/subagents/code/specialists/
├── github.ts
├── local-files.ts
├── architect.ts
├── diagrams.ts
├── security.ts
├── a11y.ts
└── index.ts
```

**Deliverables:**
- [ ] `architect.ts` — Architecture analysis agent
- [ ] `diagrams.ts` — Mermaid/PlantUML generation
- [ ] `security.ts` — Security audit agent
- [ ] `a11y.ts` — Accessibility audit agent
- [ ] Parallel specialist invocation support in L1

### Phase 4: Optimization & polish

- [ ] Latency profiling: measure L0→L1→L2 round-trip times
- [ ] Caching layer for repeated specialist queries (e.g., repo file tree)
- [ ] Model benchmarking pipeline: auto-evaluate L1/L2 model choices
- [ ] Streaming support: L2 results stream through L1 back to Aion
- [ ] Error recovery: L1 gracefully handles L2 failures with fallback responses
- [ ] Cost tracking: per-agent token usage logging

---

## Communication Protocol

### L1 → L2 Tool Call Contract

Every L2 specialist returns a consistent shape:

```typescript
// lib/llm/subagents/code/types.ts
export type SpecialistResult = {
  success: boolean;
  agent: string;           // e.g., "github", "security"
  data: string;            // primary response content (human-readable)
  structured?: unknown;    // optional machine-readable data (JSON, diagram source, etc.)
  error?: string;          // error message if success=false
  metadata?: {
    model: string;         // which model was used
    tokensUsed?: number;   // token consumption
    durationMs?: number;   // wall-clock time
  };
};
```

### L1 → L0 Return Contract

L1 returns to Aion:

```typescript
export type CodeAgentResult = {
  success: boolean;
  response: string;        // synthesized, user-facing response
  specialistsUsed: string[]; // which L2 agents were invoked
  diagrams?: string[];     // any generated diagram source (Mermaid, etc.)
  codeBlocks?: Array<{
    language: string;
    code: string;
    filePath?: string;
  }>;
  error?: string;
  metadata?: {
    totalDurationMs: number;
    l1Model: string;
    l2Calls: Array<{
      agent: string;
      model: string;
      durationMs: number;
    }>;
  };
};
```

---

## Security & Sandboxing

- **File system access** is restricted to user-configured project directories (no `/etc`, no `~/.ssh`)
- **GitHub API** requires user-provided PAT or OAuth token, stored encrypted
- **Code execution** — agents do NOT execute arbitrary code; they analyze statically
- **Secret detection** — all agent outputs are scanned for accidental secret leakage before surfacing to the user
- **Rate limiting** — L2 specialists have per-minute invocation caps to prevent runaway loops

---

## Future Considerations

- **Agent memory** — L2 specialists could accumulate project-specific knowledge (e.g., "this repo uses Redux Toolkit") to improve responses over time, stored in Mem0
- **Multi-repo support** — L2 GitHub agent could work across multiple repos simultaneously
- **Custom specialists** — Allow users to define their own L2 agents with custom system prompts for domain-specific expertise (e.g., a "Django Agent" or "React Native Agent")
- **Agent-to-agent communication** — L2 agents could coordinate directly for complex cross-domain tasks (e.g., security agent asks architect agent about intended data flow)
- **Confidence scoring** — L1 returns confidence scores, allowing Aion to decide whether to surface the result directly or ask for clarification
