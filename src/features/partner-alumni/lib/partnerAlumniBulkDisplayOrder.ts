/** Assign display_order values for bulk-import rows against an existing version roster. */
export function resolvePartnerAlumniBulkDisplayOrders(
  existingOrders: readonly number[],
  entries: ReadonlyArray<{ display_order: number | null; row_number: number }>,
): number[] {
  const maxExisting = existingOrders.length === 0 ? 0 : Math.max(...existingOrders);
  const used = new Set(existingOrders);
  const allNull = entries.every((entry) => entry.display_order === null);

  if (allNull) {
    let next = maxExisting + 1;
    return entries.map(() => {
      while (used.has(next)) next += 1;
      used.add(next);
      const order = next;
      next += 1;
      return order;
    });
  }

  let nextImplicit = maxExisting + 1;
  return entries.map((entry) => {
    if (entry.display_order !== null) {
      let order = entry.display_order;
      while (used.has(order)) order += 1;
      used.add(order);
      if (order >= nextImplicit) nextImplicit = order + 1;
      return order;
    }

    while (used.has(nextImplicit)) nextImplicit += 1;
    used.add(nextImplicit);
    const order = nextImplicit;
    nextImplicit += 1;
    return order;
  });
}

export function sortPartnerAlumniBulkCommitEntries<
  T extends { display_order?: number | null; row_number: number },
>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.row_number - b.row_number;
  });
}
