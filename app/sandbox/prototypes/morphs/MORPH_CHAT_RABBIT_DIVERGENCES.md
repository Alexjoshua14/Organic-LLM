# Morph demo — chat ↔ rabbit-hole (divergence registry)

Sandbox-only prototype: [`MorphChatRabbitDemo`](_components/morph-chat-rabbit-demo/MorphChatRabbitDemo.tsx). Compare with production [`Chat`](../../../components/chat/chat.tsx) + [`RabbitHoleShell`](../../../components/rabbit-holes/RabbitHoleShell.tsx).

| Source | Demo | Notes | Upstream later? |
|--------|------|-------|-----------------|
| Chat thread | [`Conversation`](../../../components/third-party/ai-elements/conversation) + [`ChatThread`](../../../components/chat/chat-thread.tsx) | Static `UIMessage[]` from [`morph-chat-rabbit-fixtures`](_lib/morph-chat-rabbit-fixtures.ts); no `useChat`, no `CoreInput` | Partial |
| Rabbit center | [`RabbitHoleArticle`](../../../app/rabbitholes/_components/RabbitHoleArticle.tsx) | Same component; stub session + HTML | Partial |
| Left rail | [`RabbitHolePathRail`](../../../app/rabbitholes/_components/RabbitHolePathRail.tsx) | Fixture [`MORPH_CHAT_RABBIT_SESSION`](_lib/morph-chat-rabbit-fixtures.ts); clicks update local `activeNodeId` only | No |
| Right rail | [`RabbitHoleSourceList`](../../../app/rabbitholes/_components/RabbitHoleSourceList.tsx), [`RabbitHoleBranchSuggestionsBlock`](../../../app/rabbitholes/_components/RabbitHoleBranchSuggestionsBlock.tsx) | No-op clicks; mirrors shell stacking | No |
| Center morph | `@organic-llm/morph-physics` | Ghost `snapshot()` rects: chat = centered `max-w-4xl` column; rabbit = grid center column [`layout.gridCols`](../../../lib/rabbit-holes/designTokens.ts) | N |
| Rails motion | Framer | `x: 0` vs `±115%` on `lg+` absolutely positioned asides; rails hidden (`hidden lg:block`) on small screens | N |
| Keyboard | `Shift+Tab` | Toggles archetype only on this route (same chord as input morph demo on its route) | N |

## Known compromises

- **Composer:** Chat composer / `CoreInput` is omitted so the measured center is the thread column only.
- **Alignment:** Visible rails use `absolute` + `260px` width; ghost uses CSS grid—minor sub-pixel drift vs production `RabbitHoleShell` padding.
- **HUD:** Shares [`MorphDemoDevHud`](_components/morph-demo-dev-hud.tsx) with generic `targetLabelAlpha` / `targetLabelBeta`.
