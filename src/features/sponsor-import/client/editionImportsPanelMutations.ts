import type { EditionImportContext } from "../server/importUiData";

export function applyEditionImportDiscard(
  data: EditionImportContext,
  batchId: string,
): EditionImportContext {
  const activeId =
    data.activeBatch && typeof data.activeBatch.id === "string" ? data.activeBatch.id : null;
  const clearsActive = activeId === batchId;

  return {
    ...data,
    activeBatch: clearsActive ? null : data.activeBatch,
    batches: data.batches.map((batch) =>
      String(batch.id) === batchId ? { ...batch, status: "discarded" } : batch,
    ),
  };
}
