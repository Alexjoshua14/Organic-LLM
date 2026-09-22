 system: ONE combined string, in this order
│  ├─ Base system instructions / persona
│  ├─ Response-length instructions
│  ├─ Tool Instructions                        [when tools are available]
│  ├─ Memory tool usage instructions           [when memory is enabled]
│  ├─ Persisted Schemas                        [when enabled]
│  ├─ Strata / introspection additions         [experience-dependent]
│  ├─ Speech-friendly / experience / style / starter guidance
│
├─ tools: separate tool definitions and schemas
│  └─ Not the same thing as the system string's Tool Instructions section
│
├─ messages: structured model messages, in this order
│  ├─ Selected stored history (user / assistant / tool content)
│  ├─ Current user message
│  └─ Current chat                             [total count and history-window count]
│
├─ memories
│  ├─ Conversation Summary                     [stored; changes when updated]
│  ├─ Memories from past conversations         [retrieved for this turn]
│  ├─ Memory inventory                         [Arcadia-style; counts and tiers]
│
├─ Additional
│  └─ Fresh ISO timestamp (default prompt: at the end of the base instructions)
