import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { after, before, describe, it } from "node:test";

import { createAdminClient } from "@/src/lib/supabase/admin";
import {
  describeRpcPermissionExpectation,
  isRpcBusinessRuleError,
  isRpcPermissionDenied,
} from "@/src/lib/supabase/rpcPermissionErrors";

const ADMIN_RPC_SECURITY_FUNCTIONS = [
  "company_merge_preview",
  "merge_companies",
  "sponsor_import_publish_batch",
  "set_company_primary_domain",
] as const;

const HELPER_RPC = "_company_merge_build_preview" as const;

const CANONICAL_COMPANY_ID = "0009fb3b-802c-420e-8db4-b61d5c8e573e";
const DUPLICATE_COMPANY_ID = "0031a902-3714-4853-9639-fe4a41c26974";
const FAKE_UUID = "22222222-2222-2222-2222-222222222222";
const FAKE_BATCH_ID = "11111111-1111-1111-1111-111111111111";
const FAKE_DOMAIN_ID = "33333333-3333-3333-3333-333333333333";
const SAMPLE_COMPANY_ID = "6f1df3b2-7954-45ed-bf86-485d56409e45";

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim() ?? "";
  return value === "" ? null : value;
}

function hasIntegrationEnv(): boolean {
  return (
    readEnv("NEXT_PUBLIC_SUPABASE_URL") !== null &&
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") !== null &&
    readEnv("SUPABASE_SERVICE_ROLE_KEY") !== null
  );
}

async function obtainMemberAccessToken(): Promise<string> {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const memberEmail = readEnv("SUPABASE_SECURITY_TEST_EMAIL");

  if (!url || !anonKey || !serviceRoleKey || !memberEmail) {
    throw new Error("Missing env for authenticated security test");
  }

  const generateResponse = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email: memberEmail }),
  });

  const generateBody = (await generateResponse.json()) as { email_otp?: string };
  const otp = generateBody.email_otp?.trim() ?? "";
  if (!otp) {
    throw new Error("Could not obtain member OTP for authenticated security test");
  }

  const verifyResponse = await fetch(`${url}/auth/v1/verify`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email: memberEmail, token: otp }),
  });

  const verifyBody = (await verifyResponse.json()) as { access_token?: string };
  const accessToken = verifyBody.access_token?.trim() ?? "";
  if (!accessToken) {
    throw new Error("Could not obtain member access token for authenticated security test");
  }

  return accessToken;
}

function rpcPayload(functionName: (typeof ADMIN_RPC_SECURITY_FUNCTIONS)[number]): Record<string, unknown> {
  switch (functionName) {
    case "company_merge_preview":
      return {
        p_canonical_company_id: CANONICAL_COMPANY_ID,
        p_duplicate_company_id: DUPLICATE_COMPANY_ID,
      };
    case "merge_companies":
      return {
        p_canonical_company_id: CANONICAL_COMPANY_ID,
        p_duplicate_company_id: DUPLICATE_COMPANY_ID,
        p_performed_by: FAKE_UUID,
        p_resolutions: {},
        p_notes: "admin-rpc-security-test",
      };
    case "sponsor_import_publish_batch":
      return {
        p_batch_id: FAKE_BATCH_ID,
        p_published_by: FAKE_UUID,
      };
    case "set_company_primary_domain":
      return {
        p_company_id: SAMPLE_COMPANY_ID,
        p_company_domain_id: FAKE_DOMAIN_ID,
      };
    default:
      return {};
  }
}

function assertPermissionDenied(
  role: "anon" | "authenticated",
  functionName: string,
  error: { code?: string | null; message?: string | null } | null,
): void {
  assert.equal(
    isRpcPermissionDenied(error),
    true,
    `${role} ${functionName}: expected permission denied, got ${describeRpcPermissionExpectation(error)}`,
  );
  assert.equal(
    isRpcBusinessRuleError(error),
    false,
    `${role} ${functionName}: must not receive P0001 business-rule errors after hotfix`,
  );
}

const runIntegration =
  hasIntegrationEnv() && process.env.RUN_ADMIN_RPC_SECURITY_TESTS === "1";
const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration("admin RPC execute permissions (integration)", () => {
  let memberAccessToken: string | null = null;

  before(async () => {
    if (readEnv("SUPABASE_SECURITY_TEST_EMAIL")) {
      memberAccessToken = await obtainMemberAccessToken();
    }
  });

  after(() => {
    memberAccessToken = null;
  });

  for (const functionName of ADMIN_RPC_SECURITY_FUNCTIONS) {
    it(`anon cannot execute ${functionName}`, async () => {
      const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
      const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
      assert.ok(url && anonKey);

      const supabase = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data, error } = await supabase.rpc(functionName, rpcPayload(functionName));

      assert.equal(data, null);
      assert.ok(error, `anon ${functionName}: expected error`);
      assertPermissionDenied("anon", functionName, error);
    });
  }

  for (const functionName of ADMIN_RPC_SECURITY_FUNCTIONS) {
    it(`authenticated cannot execute ${functionName}`, async () => {
      const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
      const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
      assert.ok(url && anonKey);

      if (!memberAccessToken) {
        if (!readEnv("SUPABASE_SECURITY_TEST_EMAIL")) {
          return;
        }
        throw new Error("Authenticated security test token was not initialized");
      }

      const supabase = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          headers: {
            Authorization: `Bearer ${memberAccessToken}`,
          },
        },
      });

      const { data, error } = await supabase.rpc(functionName, rpcPayload(functionName));

      assert.equal(data, null);
      assert.ok(error, `authenticated ${functionName}: expected error`);
      assertPermissionDenied("authenticated", functionName, error);
    });
  }

  it("anon cannot execute _company_merge_build_preview helper", async () => {
    const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    assert.ok(url && anonKey);

    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.rpc(HELPER_RPC, {
      p_canonical_company_id: CANONICAL_COMPANY_ID,
      p_duplicate_company_id: DUPLICATE_COMPANY_ID,
    });

    assert.equal(data, null);
    assert.ok(error);
    assertPermissionDenied("anon", HELPER_RPC, error);
  });

  it("service_role reaches business validation for merge_companies", async () => {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("merge_companies", rpcPayload("merge_companies"));

    assert.equal(data, null);
    assert.ok(error);
    assert.equal(
      isRpcBusinessRuleError(error),
      true,
      `service_role merge_companies should reach business validation, got ${describeRpcPermissionExpectation(error)}`,
    );
    assert.match(error.message ?? "", /merge_performed_by_not_found/);
  });

  it("service_role reaches business validation for sponsor_import_publish_batch", async () => {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc(
      "sponsor_import_publish_batch",
      rpcPayload("sponsor_import_publish_batch"),
    );

    assert.equal(data, null);
    assert.ok(error);
    assert.equal(isRpcBusinessRuleError(error), true);
    assert.match(error.message ?? "", /batch_not_found/);
  });

  it("service_role can execute company_merge_preview", async () => {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc(
      "company_merge_preview",
      rpcPayload("company_merge_preview"),
    );

    assert.equal(error, null);
    assert.ok(data);
    assert.ok(typeof data === "object");
  });
});
