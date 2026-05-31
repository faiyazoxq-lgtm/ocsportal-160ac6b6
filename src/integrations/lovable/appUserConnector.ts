/**
 * App User Connector helpers — server-only. Reads LOVABLE_API_KEY from
 * process.env. Never import from client bundles.
 */

function requireApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not set.");
  return key;
}

export interface AuthorizeParams {
  gatewayBaseUrl: string;
  connectorId: string;
  appUserId: string;
  connectorClientId: string;
  returnUrl: string;
  credentialsConfiguration?: Record<string, unknown>;
}

export interface AuthorizeResponse {
  authorizationUrl: string;
  sessionId: string;
}

export async function authorizeAppUserOAuth(p: AuthorizeParams): Promise<AuthorizeResponse> {
  const res = await fetch(`${p.gatewayBaseUrl}/api/v1/app-users/oauth2/authorize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connector_id: p.connectorId,
      app_user_id: p.appUserId,
      connector_client_id: p.connectorClientId,
      return_url: p.returnUrl,
      credentials_configuration: p.credentialsConfiguration,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`App User OAuth start failed (${res.status}): ${text || res.statusText}`);
  const body = text ? JSON.parse(text) : {};
  if (!body.authorization_url) throw new Error("Missing authorization_url in OAuth start response");
  return { authorizationUrl: body.authorization_url, sessionId: body.session_id ?? "" };
}

export interface CallAsAppUserParams {
  gatewayBaseUrl: string;
  connectionId: string;
  connectorId: string;
  path: string;
  init?: RequestInit;
}

export async function callAsAppUser({
  gatewayBaseUrl, connectionId, connectorId, path, init,
}: CallAsAppUserParams): Promise<Response> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${requireApiKey()}`);
  headers.set("X-App-User-Connection-Id", connectionId);
  return fetch(`${gatewayBaseUrl}/${connectorId}${normalized}`, { ...init, headers });
}