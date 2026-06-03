import {
  AUTH_NOTICE_EMAIL_ALREADY_REGISTERED,
  LOGIN_ACCOUNT_NOT_FOUND_MESSAGE,
  SIGNUP_EMAIL_ALREADY_REGISTERED_MESSAGE,
} from "@/src/lib/auth/authMessages";
import { buildLoginEntryUrl, buildSignupEntryUrl } from "@/src/lib/auth/buildAuthEntryUrl";
import { fetchAuthUserExists } from "@/src/lib/auth/fetchAuthUserExists";
import { normalizeAuthCheckError } from "@/src/lib/auth/authMessages";

export type AuthIntent = "login" | "signup";

export type RecommendedAction = "login" | "signup" | "proceed";

export type ResolveAuthIntentResult = {
  exists: boolean;
  recommendedAction: RecommendedAction;
  message: string | null;
  redirectPath: string | null;
  checkError: string | null;
};

/**
 * Resolves whether an email may proceed for the given entry intent (login vs signup).
 */
export async function resolveAuthIntent(
  rawEmail: string,
  intent: AuthIntent,
  redirectTo: string,
): Promise<ResolveAuthIntentResult> {
  const { exists, error: checkError } = await fetchAuthUserExists(rawEmail);

  if (checkError) {
    return {
      exists: false,
      recommendedAction: intent,
      message: null,
      redirectPath: null,
      checkError: normalizeAuthCheckError(checkError),
    };
  }

  if (intent === "login") {
    if (!exists) {
      return {
        exists: false,
        recommendedAction: "signup",
        message: LOGIN_ACCOUNT_NOT_FOUND_MESSAGE,
        redirectPath: buildSignupEntryUrl(redirectTo, { email: rawEmail }),
        checkError: null,
      };
    }
    return {
      exists: true,
      recommendedAction: "proceed",
      message: null,
      redirectPath: null,
      checkError: null,
    };
  }

  if (exists) {
    return {
      exists: true,
      recommendedAction: "login",
      message: SIGNUP_EMAIL_ALREADY_REGISTERED_MESSAGE,
      redirectPath: buildLoginEntryUrl(redirectTo, {
        email: rawEmail,
        notice: AUTH_NOTICE_EMAIL_ALREADY_REGISTERED,
      }),
      checkError: null,
    };
  }

  return {
    exists: false,
    recommendedAction: "proceed",
    message: null,
    redirectPath: null,
    checkError: null,
  };
}
