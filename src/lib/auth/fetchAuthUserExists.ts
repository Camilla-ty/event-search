import {
  AUTH_EMAIL_REQUIRED,
  normalizeAuthCheckError,
} from "@/src/lib/auth/authMessages";
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
    return { exists: false, error: AUTH_EMAIL_REQUIRED };
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
        error: normalizeAuthCheckError(payload.error),
      };
    }

    return { exists: payload.exists === true, error: null };
  } catch {
    return { exists: false, error: normalizeAuthCheckError(null) };
  }
}
