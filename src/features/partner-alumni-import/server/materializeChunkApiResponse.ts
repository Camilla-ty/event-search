export function partnerAlumniMaterializeChunkResponse<T>(result: T) {
  return { ok: true as const, result };
}
