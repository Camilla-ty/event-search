/**
 * Post-hotfix verification for admin RPC execute grants.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/verify-admin-rpc-permissions.ts
 *
 * Optional (authenticated role checks):
 *   SUPABASE_SECURITY_TEST_EMAIL=member@example.com npx tsx --env-file=.env.local scripts/verify-admin-rpc-permissions.ts
 */
import { createClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/src/lib/supabase/admin";
import {
  describeRpcPermissionExpectation,
  isRpcBusinessRuleError,
  isRpcPermissionDenied,
} from "@/src/lib/supabase/rpcPermissionErrors";

type CheckResult = {
  label: string;
  ok: boolean;
  detail: string;
};

function readEnv(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (value === "") throw new Error(`Missing ${name}`);
  return value;
}

const CANONICAL = "0009fb3b-802c-420e-8db4-b61d5c8e573e";
const DUPLICATE = "0031a902-3714-4853-9639-fe4a41c26974";
const FAKE_USER = "22222222-2222-2222-2222-222222222222";
const FAKE_BATCH = "11111111-1111-1111-1111-111111111111";
const COMPANY = "6f1df3b2-7954-45ed-bf86-485d56409e45";
const FAKE_DOMAIN = "33333333-3333-3333-3333-333333333333";

async function memberAccessToken(
  url: string,
  anonKey: string,
  serviceRoleKey: string,
  email: string,
): Promise<string> {
  const generateResponse = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email }),
  });
  const generateBody = (await generateResponse.json()) as { email_otp?: string };
  const otp = generateBody.email_otp?.trim() ?? "";
  if (!otp) throw new Error("generate_link did not return email_otp");

  const verifyResponse = await fetch(`${url}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email, token: otp }),
  });
  const verifyBody = (await verifyResponse.json()) as { access_token?: string };
  const token = verifyBody.access_token?.trim() ?? "";
  if (!token) throw new Error("verify did not return access_token");
  return token;
}

async function main(): Promise<void> {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const memberEmail = process.env.SUPABASE_SECURITY_TEST_EMAIL?.trim() ?? "";

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createAdminClient();

  const checks: CheckResult[] = [];

  const denyCases: Array<{
    label: string;
    fn: () => PromiseLike<{ error: { code?: string; message?: string } | null }>;
  }> = [
    {
      label: "anon:company_merge_preview",
      fn: () =>
        anon.rpc("company_merge_preview", {
          p_canonical_company_id: CANONICAL,
          p_duplicate_company_id: DUPLICATE,
        }),
    },
    {
      label: "anon:merge_companies",
      fn: () =>
        anon.rpc("merge_companies", {
          p_canonical_company_id: CANONICAL,
          p_duplicate_company_id: DUPLICATE,
          p_performed_by: FAKE_USER,
          p_resolutions: {},
          p_notes: "verify-admin-rpc-permissions",
        }),
    },
    {
      label: "anon:sponsor_import_publish_batch",
      fn: () =>
        anon.rpc("sponsor_import_publish_batch", {
          p_batch_id: FAKE_BATCH,
          p_published_by: FAKE_USER,
        }),
    },
    {
      label: "anon:set_company_primary_domain",
      fn: () =>
        anon.rpc("set_company_primary_domain", {
          p_company_id: COMPANY,
          p_company_domain_id: FAKE_DOMAIN,
        }),
    },
    {
      label: "anon:_company_merge_build_preview",
      fn: () =>
        anon.rpc("_company_merge_build_preview", {
          p_canonical_company_id: CANONICAL,
          p_duplicate_company_id: DUPLICATE,
        }),
    },
  ];

  for (const testCase of denyCases) {
    const { error } = await testCase.fn();
    const ok = isRpcPermissionDenied(error) && !isRpcBusinessRuleError(error);
    checks.push({
      label: testCase.label,
      ok,
      detail: describeRpcPermissionExpectation(error),
    });
  }

  if (memberEmail) {
    const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
    const userJwt = await memberAccessToken(url, anonKey, serviceRoleKey, memberEmail);
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });

    const { error } = await authClient.rpc("company_merge_preview", {
      p_canonical_company_id: CANONICAL,
      p_duplicate_company_id: DUPLICATE,
    });
    checks.push({
      label: "authenticated:company_merge_preview",
      ok: isRpcPermissionDenied(error) && !isRpcBusinessRuleError(error),
      detail: describeRpcPermissionExpectation(error),
    });
  }

  const { error: adminMergeError } = await admin.rpc("merge_companies", {
    p_canonical_company_id: CANONICAL,
    p_duplicate_company_id: DUPLICATE,
    p_performed_by: FAKE_USER,
    p_resolutions: {},
    p_notes: "verify-admin-rpc-permissions",
  });
  checks.push({
    label: "service_role:merge_companies_reaches_business_validation",
    ok: isRpcBusinessRuleError(adminMergeError),
    detail: describeRpcPermissionExpectation(adminMergeError),
  });

  const { data: previewData, error: previewError } = await admin.rpc("company_merge_preview", {
    p_canonical_company_id: CANONICAL,
    p_duplicate_company_id: DUPLICATE,
  });
  checks.push({
    label: "service_role:company_merge_preview_succeeds",
    ok: previewError === null && previewData !== null,
    detail: previewError ? describeRpcPermissionExpectation(previewError) : "success",
  });

  let failed = 0;
  for (const check of checks) {
    const status = check.ok ? "PASS" : "FAIL";
    if (!check.ok) failed += 1;
    console.log(`${status} ${check.label} — ${check.detail}`);
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
