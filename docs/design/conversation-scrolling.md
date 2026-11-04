# Conversation scrolling

The shared [`Conversation`](../../components/third-party/ai-elements/conversation.tsx) wraps
`use-stick-to-bottom`. Arcadia uses this wrapper through
[`Chat`](../../components/chat/chat.tsx) and [`ChatThread`](../../components/chat/chat-thread.tsx).

Manual scrolling belongs to the browser. Keep the library's existing escape-on-upward-input,
selection handling, and nested-scroll behavior when changing automatic following. The craft
priority is preserving the reader's place and allowing immediate interruption.

## Automatic motion

- Initial positioning is instant by default. Content growth follows the library's existing
  smooth behavior while the reader remains attached to the bottom.
- Under `prefers-reduced-motion: reduce`, initial positioning and resize-following are instant.
  Explicit `initial={false}` and `resize={false}` remain disabled.
- Jump-to-latest respects reduced motion and has the accessible name **Scroll to latest
  message**. Callers can override its accessible name through the button props.

This follows the [design backbone](./README.md#principles-product-wide). The change does not
introduce custom wheel inertia, a new scroll engine, or different spring constants.

## Regression checks

Run the isolated browser suite with:

```bash
bun run test:e2e --config tests/e2e/scroll.playwright.config.ts
```

The suite bundles the actual shared component into a synthetic long conversation. All browser
requests are fulfilled locally; it needs no dev server, authentication, stored chats, or LLM.
Playwright's matching Chromium headless shell must be installed. An existing compatible test
binary can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

The desktop, reduced-motion, mobile-viewport, and short-viewport projects check:

- Initial positioning, thread remounts, and explicit automatic-scrolling opt-outs.
- Streaming while following and while reading earlier text.
- Named jump-to-latest behavior and interruption by upward input.
- Nested scrolling, late layout growth, collapsing earlier content, and composer resizing.
- Keyboard PageUp and instant arrival under reduced motion.

The fixture uses its own minimal layout styles. These checks cover the shared component's
scrolling contract; they do not establish full Arcadia layout, Safari/iOS touch behavior,
physical trackpad feel, or production performance. Validate those in the real app before
changing inertia, anchoring policy, or automatic-follow thresholds.
