export type Point = { x: number; y: number };

/**
 * Layout position of `el` inside a positioned `ancestor`, ignoring transforms — i.e. where a
 * card is landing, not where its glide currently draws it.
 */
export function offsetWithin(el: HTMLElement, ancestor: HTMLElement): Point {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;

  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }

  return { x, y };
}

export function centerWithin(el: HTMLElement, ancestor: HTMLElement): Point {
  const { x, y } = offsetWithin(el, ancestor);

  return { x: x + el.offsetWidth / 2, y: y + el.offsetHeight / 2 };
}

/** The card element for `id` on a board. */
export function findCard(root: HTMLElement, id: string): HTMLElement | undefined {
  return root.querySelector<HTMLElement>(`[data-kanban-card="${CSS.escape(id)}"]`) ?? undefined;
}
