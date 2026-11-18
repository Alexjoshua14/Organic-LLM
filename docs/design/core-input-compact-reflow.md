# CoreInput compact reflow

The compact composer is one line by default: settings on the left, the text, then attachments,
mic and Send on the right. When the text stops fitting a single line it stacks: the text on top,
settings, attachments and mic along the left underneath, Send on the right.

**Related code**

- Layout and timing: [`composer-reflow.ts`](../../app/sandbox/prototypes/core-input/_components/editor-prototype/composer-reflow.ts)
- Grid: `.editor-row` in [`editor-prototype.css`](../../app/sandbox/prototypes/core-input/_components/editor-prototype/editor-prototype.css)

## When it stacks

- More than one plain line of text: a Shift+Enter break, another block, a list, a code block.
- A single line wider than the room beside the actions.
- Live voice or Markdown source.

It returns to one line only once the text clears the narrow width by 16px, so a line sitting at the
boundary cannot flap between the two.

## The motion

Everything that changes place moves in one gesture: the text, the three actions and the row's
own height. When only the buttons glide, the text and the shell snap beside them, and that
mismatch is what reads as a jolt.

| Token                        | Value                            | Why                                                                                                      |
| ---------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `COMPOSER_EXPAND_MS`         | **220ms**                        | Stacking is the entrance: long enough to follow where things went                                        |
| `COMPOSER_COLLAPSE_MS`       | **170ms**                        | Exits are faster than entrances                                                                          |
| `COMPOSER_REFLOW_EASING`     | `cubic-bezier(0.32, 0.72, 0, 1)` | Soft start, long settle; a hard decelerate starts at full speed and reads as abrupt                      |
| `COMPOSER_REFLOW_STAGGER_MS` | **24ms**                         | Text first, then Send, mic and attachments, then settings (reversed on return); ~72ms of stagger at most |

**Approved range:** 150–260ms per piece, under ~300ms start to finish. Faster than that and the
reflow reads as a blink; slower and typing feels like it is waiting on the layout.

Reduced motion skips the glide and the layout simply changes.

## Spacing on one line

Attach, mic and Send sit `inline-xs` (4px) apart, and the same gap separates the settings button
from the text. Each button is sized by the system (attach and mic `min-h-11 min-w-11`, Send
`size-9`) and the text pad is `inset-sm`. No raw lengths: see [Spacing](./spacing.md).
