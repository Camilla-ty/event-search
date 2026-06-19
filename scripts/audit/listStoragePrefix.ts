import type { SupabaseClient } from "@supabase/supabase-js";

export type ListedStorageObject = {
  path: string;
  updated_at: string | null;
  size: number | null;
};

type StorageListItem = {
  name: string;
  id: string | null;
  updated_at?: string | null;
  metadata?: { size?: number } | null;
};

export async function listStorageObjectsUnderPrefix(params: {
  supabase: SupabaseClient;
  bucket: string;
  prefix: string;
}): Promise<ListedStorageObject[]> {
  const results: ListedStorageObject[] = [];

  async function walk(folder: string): Promise<void> {
    let offset = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await params.supabase.storage
        .from(params.bucket)
        .list(folder, {
          limit,
          offset,
          sortBy: { column: "name", order: "asc" },
        });

      if (error) {
        throw new Error(
          `[audit-event-logo-storage] list failed for ${folder || params.prefix}: ${error.message}`,
        );
      }

      if (!data || data.length === 0) break;

      for (const item of data as StorageListItem[]) {
        const path = folder ? `${folder}/${item.name}` : item.name;
        if (item.id === null) {
          await walk(path);
          continue;
        }

        results.push({
          path,
          updated_at: item.updated_at ?? null,
          size: item.metadata?.size ?? null,
        });
      }

      if (data.length < limit) break;
      offset += limit;
    }
  }

  await walk(params.prefix);
  return results;
}
