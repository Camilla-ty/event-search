import {
  runCompanyMaterialization,
  materializeCompaniesProgressLabel,
  MATERIALIZE_COMPANIES_FAILED_MESSAGE,
} from "@/src/features/sponsor-import/materializeCompaniesClient";

import { materializeCompaniesChunk, materializeMembersChunk } from "./client/api";
import type { ImportScope } from "./client/types";
import type { MaterializeVersionMembersChunkResult } from "./types";

export const MATERIALIZE_MEMBERS_FAILED_MESSAGE =
  "Version member linking failed or timed out. Companies already created are kept. Retry to continue.";

export function materializeMembersProgressLabel(progress: {
  rowsWithVersionMember: number;
  totalResolvedRows: number;
}): string {
  if (progress.totalResolvedRows <= 0) {
    return "Linking version members…";
  }
  return `Linking version members… ${progress.rowsWithVersionMember}/${progress.totalResolvedRows}`;
}

export async function runVersionMemberMaterialization(
  scope: ImportScope,
  batchId: string,
  options?: {
    onProgress?: (progress: {
      rowsWithVersionMember: number;
      totalResolvedRows: number;
    }) => void;
    maxIterations?: number;
    chunkFn?: (
      scope: ImportScope,
      batchId: string,
      body: { cursor?: number; limit?: number },
    ) => Promise<
      | { ok: true; result: MaterializeVersionMembersChunkResult }
      | { ok: false; error: string }
    >;
  },
) {
  const maxIterations = options?.maxIterations ?? 1000;
  const requestChunk =
    options?.chunkFn ??
    ((activeScope, activeBatchId, body) =>
      materializeMembersChunk(activeScope, activeBatchId, body));
  let cursor: number | undefined;
  let last: MaterializeVersionMembersChunkResult | null = null;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const response = await requestChunk(
      scope,
      batchId,
      cursor === undefined ? {} : { cursor },
    );
    if (!response.ok) {
      return { ok: false as const, error: response.error || MATERIALIZE_MEMBERS_FAILED_MESSAGE };
    }

    const result = response.result;
    last = result;

    options?.onProgress?.({
      rowsWithVersionMember: result.rows_with_version_member,
      totalResolvedRows: result.total_resolved_rows,
    });

    if (result.done) {
      return { ok: true as const, result };
    }

    if (result.examined_count === 0) {
      return { ok: false as const, error: MATERIALIZE_MEMBERS_FAILED_MESSAGE };
    }

    cursor = result.next_cursor ?? cursor;
  }

  void last;
  return { ok: false as const, error: MATERIALIZE_MEMBERS_FAILED_MESSAGE };
}

export async function runPartnerAlumniImportMaterialization(
  scope: ImportScope,
  batchId: string,
  onProgress: (message: string) => void,
) {
  const companies = await runCompanyMaterialization(
    (cursor) =>
      materializeCompaniesChunk(scope, batchId, cursor === undefined ? {} : { cursor }),
    {
      onProgress: (progress) =>
        onProgress(materializeCompaniesProgressLabel(progress)),
    },
  );

  if (!companies.ok) {
    return { ok: false as const, error: companies.error || MATERIALIZE_COMPANIES_FAILED_MESSAGE };
  }

  const members = await runVersionMemberMaterialization(scope, batchId, {
    onProgress: (progress) => onProgress(materializeMembersProgressLabel(progress)),
  });

  if (!members.ok) {
    return { ok: false as const, error: members.error };
  }

  return { ok: true as const };
}

export { MATERIALIZE_COMPANIES_FAILED_MESSAGE };
