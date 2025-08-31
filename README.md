# Organic LLM

Organic LLM is both a UI Lab (reimagining human–AI chat interactions) and a Cognition Lab (prototyping memory + context systems).

• UI Pillars: organic-futuristic-modernism, glass/gradient/particle aesthetics, fluid chat.

• Cognition Pillars: efficient memory (last-N turns + rolling summaries), safe deep pulls into history, trust features (export, forget, transparency).

North Star: A chat experience that feels alive, remembers meaningfully, and balances speed with depth — portable into other projects like Spark, Stratum, and Ascend.

## Core Concepts

• Threads → container for conversations (chat sessions)
• Messages → canonical turn log (user, assistant, system, tool)
• Last-N Window → only ~10 recent messages are sent to the model
• Rolling Summaries → compact narrative that grows alongside a thread
• Deep History Tools → safe, on-demand retrieval when summary + last-N aren’t enough
• UI Contract → show all history to user (infinite scroll), but keep model context lean

## Roadmap

### v0 — Supabase Spine ✅ (current)

• Persist chats in Supabase (threads, messages, RLS enabled)
• Basic message persistence, owner-only access, indexes, rate-limit guard
• Last ~10 messages sent to model
• Infinite scroll for history

### v1 — Rolling Summaries

• Add thread_summaries (≤600 tokens)
• Context = persona + summary + last-N messages
• Redis cache for speed

### v2 — Deep History Tools

• Add message_chunks + pgvector/trigram search
• history.search() / history.before() functions
• Strict token budgets and safe retrieval

### v3 — Chapters & Observability

• thread_chapters, optional decision_log
• Track token usage, latency, deep pulls
• Dashboards for observability

### v4 — Artifacts & Docs

• File/code ingestion
• Chunked embeddings + docs.search()
• Inline artifact previews in chat

### v5 — Governance & Trust

• Forget/export features
• Retention/decay policies
• Cost dashboards

## Development Principles

• Iterative Spine → working baseline at each step
• Composable → additive features; threads/messages never break
• Token-aware → context always respects budgets
• Transparency → inspectable model context (citations, debug mode)
• User-first → full history always accessible; lean context is optimization

## Tech Stack

• Frontend: Next.js 15, Tailwind CSS, shadcn/ui
• State: React Query, Zustand
• Backend: Supabase (Postgres + pgvector)
• Auth: Clerk (passkeys, biometrics)
• Cache: Redis (future v1)
• Infra: Vercel + optional Upstash for rate limiting

## Getting Started

### Prerequisites

• Node.js ≥ 20
• bun (preferred)
• Supabase project (with threads + messages tables, RLS enabled)
• Clerk project for authentication

### Setup

```bash
git clone https://github.com/alexjoshua14/organic-llm
cd organic-llm
bun install
```

#### Environment

```bash
cp .env.example .env.local
```

#### Fill in Supabase keys, Clerk keys, Redis if enabled

#### Run

```bash
bun dev
```

Visit [http://localhost:3000](http://localhost:3000) and start chatting.

## Current Status (v0)

• Message persistence to Supabase (working)
• RLS policies owner-scoped via Clerk sub
• Rate limit guard (DB trigger) to prevent runaway thread creation
• Next focus:
• Finish createChat, loadChat, getChats wiring
• Swap UI store → Supabase store (with local fallback)
• Add Redis cache for recent messages
• Optimistic UI with local echo

## Guiding Mindset

• v10 vision fuels motivation; v0 spine ensures momentum
• Each version is a valid checkpoint
• Don’t over-polish early
• If paused, roadmap = save point
