import { feedbackWarningClass } from "@/src/lib/design/classes";
import { isSupabaseGoogleExchangeError } from "@/src/lib/auth/oauthRedirectState";

export function OAuthProviderErrorHelp({ message }: { message: string }) {
  if (!isSupabaseGoogleExchangeError(message)) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const projectHost = supabaseUrl ? new URL(supabaseUrl).hostname : "YOUR_PROJECT.supabase.co";

  return (
    <div className={`mt-3 space-y-2 ${feedbackWarningClass}`}>
      <p className="font-medium">
        Google sign-in failed at Supabase (before your app received a session).
      </p>
      <p>
        This is not a double-exchange in the app. Supabase could not trade Google&apos;s
        authorization code for tokens.
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Google Cloud → OAuth client → Authorized redirect URI must be exactly:{" "}
          <code className="text-xs">https://{projectHost}/auth/v1/callback</code>
        </li>
        <li>
          Supabase Dashboard → Auth → Providers → Google: Client ID and Client Secret must
          match that Google OAuth client (re-paste if the secret was rotated).
        </li>
        <li>
          Supabase Dashboard → Auth → URL Configuration: Site URL{" "}
          <code className="text-xs">http://localhost:3000</code> and Redirect URLs{" "}
          <code className="text-xs">http://localhost:3000/**</code>
        </li>
        <li>Check Supabase Dashboard → Auth → Logs for the underlying oauth2 error.</li>
      </ul>
    </div>
  );
}
