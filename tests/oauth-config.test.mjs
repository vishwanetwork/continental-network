import assert from "node:assert/strict";
import test from "node:test";

import { getOAuthConfig } from "../server/oauth-config.mjs";

test("derives the Google callback and post-login URL from the public application URL", () => {
  assert.deepEqual(
    getOAuthConfig({
      PUBLIC_APP_URL: "https://agent-flow.test.vishwalab.com/",
    }),
    {
      googleRedirectUri: "https://agent-flow.test.vishwalab.com/api/auth/google/callback",
      publicAppUrl: "https://agent-flow.test.vishwalab.com",
    },
  );
});

test("honors an explicit Google callback URL", () => {
  assert.deepEqual(
    getOAuthConfig({
      PUBLIC_APP_URL: "https://agent-flow.test.vishwalab.com",
      GOOGLE_REDIRECT_URI: "https://login.example.com/google/callback",
    }),
    {
      googleRedirectUri: "https://login.example.com/google/callback",
      publicAppUrl: "https://agent-flow.test.vishwalab.com",
    },
  );
});
