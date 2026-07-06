/** Prefer the lower display_order when deduping same-version Partner Alumni members on merge. */
export function mergePartnerAlumniDisplayOrder(
  canonicalOrder: number,
  duplicateOrder: number,
): number {
  return Math.min(canonicalOrder, duplicateOrder);
}
