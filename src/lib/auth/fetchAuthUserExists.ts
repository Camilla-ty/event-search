import { normalizeAuthEmail } from "@/src/lib/auth/normalizeAuthEmail";

type CheckEmailResponse = {
  exists: boolean;
  error?: string;
};

/**
 * Client helper: POST /api/auth/check-email (server uses auth.users lookup).
 */
export async function fetchAuthUserExists(
  rawEmail: string,
): Promise<{ exists: boolean; error: string | null }> {
  const email = normalizeAuthEmail(rawEmail);
  if (!email) {
    return { exists: false, error: "Email is required." };
  }

  try {
    const response = await fetch("/api/auth/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const payload = (await response.json()) as CheckEmailResponse;

    if (!response.ok) {
      return {
        exists: false,
        error: payload.error ?? "Could not verify account.",
      };
    }

    return { exists: payload.exists === true, error: null };
  } catch {
    return { exists: false, error: "Could not verify account." };
  }
}
