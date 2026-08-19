const LOCAL_APP_URL = "http://localhost:5173";
const LOCAL_GOOGLE_REDIRECT_URI = "http://localhost:3001/api/auth/google/callback";

function normalizeUrl(url) {
  return url.replace(/\/+$/, "");
}

export function getOAuthConfig(environment = process.env) {
  const configuredAppUrl = environment.PUBLIC_APP_URL?.trim();
  const publicAppUrl = normalizeUrl(configuredAppUrl || LOCAL_APP_URL);
  const configuredRedirectUri = environment.GOOGLE_REDIRECT_URI?.trim();

  return {
    publicAppUrl,
    googleRedirectUri:
      configuredRedirectUri ||
      (configuredAppUrl
        ? `${publicAppUrl}/api/auth/google/callback`
        : LOCAL_GOOGLE_REDIRECT_URI),
  };
}
