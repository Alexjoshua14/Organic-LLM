# Context usage

**Locked — 2026-10-09.** The composer context charts use shared source colors from
`lib/design/kelvin-color.ts`. The ring represents model-window occupancy; the narrow
bar represents the composition of used input. Their denominators differ deliberately.

The palette is temperature-inspired with stronger categorical separation than literal
blackbody RGB: gold messages, orange tool outputs, yellow draft, neutral system prompt,
cyan tool instructions, violet summary, and blue memory. Colors stay stable across sends.
Both charts use a narrow white center and restrained colored glow. The bar's visible
stroke is 4px; its invisible interaction area is 24px tall.

The percentage is an ordered usage signal rather than another source category. It moves
from the theme foreground (near-white in dark mode) toward a deeper Lumen-family amber as
occupancy rises. Separate light/dark amber tokens preserve text contrast. The app's other
Lumen accents remain defined in `styles/globals.css`.

The section label has a reserved 32px area: section name, then tokens and percentage of
input. It clears on pointer exit or keyboard blur; tap reveals it. Do not add discovery
instructions or let the label change layout height.

Enabled tools appear as neutral capability pills with specific labels such as Memory,
Web, Chat history, Task management, Diagrams, Interactive content, Restaurants, and Meal
planning. Reserve chart colors for token usage; do not add colored dots to tool pills or
list individual tool implementation names here.

[Before/after comparison](./images/context-popover-before-after.png), rendered from the
previous and redesigned components with the same synthetic example thread data.

This applies [Carbon's distinction between categorical and ordered palettes](https://www.carbondesignsystem.com/building-blocks/data-visualization/color-palettes)
and its [text-contrast guidance](https://www.carbondesignsystem.com/building-blocks/foundations/accessibility/color)
within the existing Organic LLM theme. Metrics and counting rules live in
[chat transparency](../chat-llm-transparency.md), not this design reference.
