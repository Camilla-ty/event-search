import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const buttonPath = join(
  process.cwd(),
  "src/components/auth/MicrosoftAuthButton.tsx",
);
const loginPath = join(process.cwd(), "src/app/login/LoginForm.tsx");
const authFormPath = join(process.cwd(), "src/components/auth/AuthForm.tsx");
const googlePath = join(process.cwd(), "src/components/auth/GoogleAuthButton.tsx");

describe("MicrosoftAuthButton (Azure OAuth)", () => {
  const source = readFileSync(buttonPath, "utf8");

  it("starts Supabase Azure OAuth with the same redirect callback flow as Google", () => {
    assert.match(source, /Continue with Microsoft/);
    assert.match(source, /provider:\s*"azure"/);
    assert.match(source, /signInWithOAuth/);
    assert.match(source, /setOAuthRedirectStateCookies/);
    assert.match(source, /buildAuthCallbackUrl/);
    assert.match(source, /redirectTo:\s*callbackUrl/);
    assert.doesNotMatch(source, /provider:\s*"google"/);
  });

  it("keeps secondary full-width button styling like Google", () => {
    const google = readFileSync(googlePath, "utf8");
    assert.match(source, /variant="secondary"/);
    assert.match(source, /className="w-full"/);
    assert.match(google, /variant="secondary"/);
    assert.match(google, /className="w-full"/);
  });
});

describe("Microsoft OAuth placement", () => {
  it("places Microsoft directly below Google on login and signup AuthForm", () => {
    const login = readFileSync(loginPath, "utf8");
    const authForm = readFileSync(authFormPath, "utf8");

    assert.match(login, /GoogleAuthButton/);
    assert.match(login, /MicrosoftAuthButton/);
    assert.match(login, /flow="login"/);

    const loginGoogleIdx = login.indexOf("<GoogleAuthButton");
    const loginMicrosoftIdx = login.indexOf("<MicrosoftAuthButton");
    assert.ok(loginGoogleIdx >= 0);
    assert.ok(loginMicrosoftIdx > loginGoogleIdx);

    assert.match(authForm, /GoogleAuthButton/);
    assert.match(authForm, /MicrosoftAuthButton/);
    const formGoogleIdx = authForm.indexOf("<GoogleAuthButton");
    const formMicrosoftIdx = authForm.indexOf("<MicrosoftAuthButton");
    assert.ok(formGoogleIdx >= 0);
    assert.ok(formMicrosoftIdx > formGoogleIdx);
  });
});
