import type { ExhibitorMoveDirection } from "@/src/lib/validation/eventExhibitor";

/** Returns the new sibling order after one ↑/↓ step, or null when at a tier boundary. */
export function computeMoveOrderedLinkIds(
  orderedLinkIds: readonly string[],
  linkId: string,
  direction: ExhibitorMoveDirection,
): string[] | null {
  const index = orderedLinkIds.indexOf(linkId);
  if (index === -1) return null;

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= orderedLinkIds.length) return null;

  const next = [...orderedLinkIds];
  const current = next[index];
  const neighbor = next[swapWith];
  if (current === undefined || neighbor === undefined) return null;
  next[index] = neighbor;
  next[swapWith] = current;
  return next;
}
