import { createAdminClient } from "@/src/lib/supabase/admin";

import type { SponsorImportActionType } from "../types";

export async function appendActionLog(input: {
  batchId: string;
  actorId: string;
  actionType: SponsorImportActionType;
  payload?: Record<string, unknown> | null;
  affectedCount?: number | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("sponsor_import_admin_action_logs").insert({
    batch_id: input.batchId,
    actor_id: input.actorId,
    action_type: input.actionType,
    payload: input.payload ?? null,
    affected_count: input.affectedCount ?? null,
  });

  if (error) {
    throw new Error(`Failed to write action log: ${error.message}`);
  }
}
