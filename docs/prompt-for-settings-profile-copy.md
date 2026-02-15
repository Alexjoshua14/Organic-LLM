# Prompt for ChatGPT: Improve My Settings Page Profile Copy

Copy the prompt below and paste it into ChatGPT (which has context about you and your aspirations). Ask it to output **exactly** the text you need in a single code block you can paste into the codebase.

---

## Prompt to copy

```
I have a settings page in my app with a "Profile" section that shows a tailored block for me when I'm logged in. I need you to rewrite the profile copy so it's more accurate to who I am and what I'm building toward. Use what you know about me and my aspirations.

Output a single code block (no markdown around it, just the raw JSON) in this exact shape. No other commentary—just the code block.

Requirements:
- headline: string, max 120 characters. One punchy line (e.g. "Builder at the intersection of X and Y").
- bio: string, max 500 characters. 2–4 sentences: what I focus on, my approach, and any org/context (e.g. Coalescence Labs) if relevant.
- tags: array of 4–8 strings, each max 32 characters. Mix of domains, methods, and aspirations (e.g. "AI systems", "Human-centered design", "Organic interfaces").

Example shape (replace with your improved copy):

{
  "headline": "Your headline here, under 120 chars",
  "bio": "Your 2–4 sentence bio here. Max 500 characters total.",
  "tags": ["Tag one", "Tag two", "Tag three", "Tag four"]
}

Output only that JSON object with your improved headline, bio, and tags. No explanation outside the code block.
```

---

## Where it goes in the codebase

After ChatGPT returns the JSON, the values map into `config/tailored-profiles.ts`:

- `headline` → `TAILORED["alexanderjoshua@comcast.net"].headline`
- `bio` → `TAILORED["alexanderjoshua@comcast.net"].bio`
- `tags` → `TAILORED["alexanderjoshua@comcast.net"].tags`

Keep the email key as `"alexanderjoshua@comcast.net"`; only the three fields above are replaced.
