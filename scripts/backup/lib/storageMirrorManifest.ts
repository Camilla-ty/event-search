export type StorageMirrorObjectSummary = {
  path: string;
  size: number | null;
  updated_at: string | null;
};

export type StorageMirrorManifest = {
  kind: "company-logos-mirror";
  version: 1;
  mirrored_at: string;
  bucket: string;
  object_count: number;
  total_bytes: number;
  top_level_prefixes: string[];
  supabase_host: string | null;
  git_sha: string | null;
};

export function topLevelPrefixes(paths: string[]): string[] {
  const prefixes = new Set<string>();
  for (const objectPath of paths) {
    const slash = objectPath.indexOf("/");
    prefixes.add(slash === -1 ? objectPath : objectPath.slice(0, slash));
  }
  return [...prefixes].sort();
}

export function buildStorageMirrorManifest(params: {
  bucket: string;
  mirroredAt: string;
  objects: StorageMirrorObjectSummary[];
  supabaseHost: string | null;
  gitSha: string | null;
}): StorageMirrorManifest {
  const totalBytes = params.objects.reduce((sum, object) => sum + (object.size ?? 0), 0);

  return {
    kind: "company-logos-mirror",
    version: 1,
    mirrored_at: params.mirroredAt,
    bucket: params.bucket,
    object_count: params.objects.length,
    total_bytes: totalBytes,
    top_level_prefixes: topLevelPrefixes(params.objects.map((object) => object.path)),
    supabase_host: params.supabaseHost,
    git_sha: params.gitSha,
  };
}
