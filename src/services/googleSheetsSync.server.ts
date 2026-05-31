// Server-only Google Sheets client using a service account.
// Uses Web Crypto (RS256) to sign a JWT, then exchanges it for an access token.

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 minutes
let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedKey: CryptoKey | null = null;

function getServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Service account JSON missing client_email or private_key");
  }
  return parsed;
}

export function getPlannerConfig() {
  const spreadsheetId = process.env.PLANNER_SPREADSHEET_ID;
  const sheetName = process.env.PLANNER_SHEET_NAME || "planner";
  if (!spreadsheetId) throw new Error("PLANNER_SPREADSHEET_ID is not configured");
  return { spreadsheetId, sheetName };
}

function b64urlEncode(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

async function getSigningKey(privateKeyPem: string): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return cachedKey;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  const sa = getServiceAccount();
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64urlEncode(JSON.stringify(header))}.${b64urlEncode(JSON.stringify(claim))}`;
  const key = await getSigningKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64urlEncode(signature)}`;

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google OAuth token exchange failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + Math.min(json.expires_in * 1000, TOKEN_TTL_MS),
  };
  return cachedToken.token;
}

function escapeSheetName(name: string): string {
  if (/^[A-Za-z0-9_]+$/.test(name)) return name;
  return `'${name.replace(/'/g, "''")}'`;
}

async function sheetsFetch(path: string, init?: RequestInit) {
  const token = await getAccessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Sheets API ${res.status}: ${text}`);
  }
  return res.json();
}

export const PLANNER_HEADERS = [
  "order_no",
  "client_name",
  "address",
  "postcode",
  "postcode_zone",
  "primary_trade",
  "complexity",
  "priority",
  "diary_date",
  "diary_slot",
  "lead_engineer",
  "support_engineers",
  "engineers_required",
  "current_status",
  "review_outcome",
  "duplicate_flag",
  "admin_notes",
] as const;

export type PlannerRow = Record<(typeof PLANNER_HEADERS)[number], string>;

function rowToObject(row: string[]): PlannerRow {
  const obj = {} as PlannerRow;
  PLANNER_HEADERS.forEach((h, i) => {
    obj[h] = (row[i] ?? "").toString();
  });
  return obj;
}

function objectToRow(obj: PlannerRow): string[] {
  return PLANNER_HEADERS.map((h) => obj[h] ?? "");
}

async function ensureHeader() {
  const { spreadsheetId, sheetName } = getPlannerConfig();
  const range = `${escapeSheetName(sheetName)}!A1:Q1`;
  const data = await sheetsFetch(
    `spreadsheets/${spreadsheetId}/values/${range}`,
  );
  const existing: string[] = data.values?.[0] ?? [];
  const needsWrite =
    existing.length !== PLANNER_HEADERS.length ||
    PLANNER_HEADERS.some((h, i) => existing[i] !== h);
  if (needsWrite) {
    await sheetsFetch(
      `spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({ range, majorDimension: "ROWS", values: [Array.from(PLANNER_HEADERS)] }),
      },
    );
  }
}

export async function readAllPlannerRows(): Promise<
  Array<{ row: PlannerRow; rowIndex: number }>
> {
  const { spreadsheetId, sheetName } = getPlannerConfig();
  const range = `${escapeSheetName(sheetName)}!A2:Q`;
  const data = await sheetsFetch(
    `spreadsheets/${spreadsheetId}/values/${range}`,
  );
  const values: string[][] = data.values ?? [];
  return values
    .map((r, i) => ({ row: rowToObject(r), rowIndex: i + 2 }))
    .filter((entry) => entry.row.order_no?.trim());
}

export async function upsertPlannerRow(row: PlannerRow): Promise<{ rowKey: string; rowIndex: number }> {
  await ensureHeader();
  const all = await readAllPlannerRows();
  const existing = all.find((r) => r.row.order_no === row.order_no);
  const { spreadsheetId, sheetName } = getPlannerConfig();
  const values = [objectToRow(row)];

  if (existing) {
    const range = `${escapeSheetName(sheetName)}!A${existing.rowIndex}:Q${existing.rowIndex}`;
    await sheetsFetch(
      `spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({ range, majorDimension: "ROWS", values }),
      },
    );
    return { rowKey: row.order_no, rowIndex: existing.rowIndex };
  }

  const range = `${escapeSheetName(sheetName)}!A:Q`;
  const res = await sheetsFetch(
    `spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    },
  );
  const updatedRange: string = res?.updates?.updatedRange ?? "";
  const m = updatedRange.match(/!A(\d+):/);
  const rowIndex = m ? Number(m[1]) : -1;
  return { rowKey: row.order_no, rowIndex };
}

export async function readPlannerRowByKey(orderNo: string): Promise<PlannerRow | null> {
  const all = await readAllPlannerRows();
  const found = all.find((r) => r.row.order_no === orderNo);
  return found?.row ?? null;
}