# Arcadia

Arcadia is where Organic LLM works on several things at once. You talk to one orchestrator; it hands work to subagents you can watch, steer and even talk to.

## What it is for

- Longer, multi-part jobs where one reply is not enough: research here, a draft there, a check on both
- Seeing the work as it happens: a Multiagent dashboard shows each subagent's status, and assignments appear inline in the conversation
- Talking to a specific subagent, by voice or text, without interrupting the others
- A lab for new ideas about context and tools, which graduate into main Chat once they prove themselves

## How it works

The orchestrator writes each subagent's brief itself, along with the context that subagent needs: your own words (each quote is checked against the thread), other subagents' output, and memories. It can keep reusable bundles of context on a private worktable and re-send them. Subagents see only what they are sent. Delegation only happens while the thread's Multiagent switch is on; with it off, Arcadia answers directly.

## Memory that scales to the question

A context-effort control sets how hard Arcadia works to recall relevant memory before it replies: **Instant** skips planning for speed, **Quick** (the default) balances, and **Heavy** searches harder. Arcadia also keeps a much larger window of the thread than main Chat: a 50,000-token history budget instead of the latest 10 messages.

## When to use it

Reach for Arcadia when a task has parts. Use main Chat for a quick question or a focused conversation.
