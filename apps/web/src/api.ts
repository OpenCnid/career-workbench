import type {
  DiagnosticsResponse,
  SnapshotResponse,
} from "@career-workbench/contracts";

interface SessionResponse {
  readonly contractVersion: "v1";
  readonly csrfToken: string;
}

interface ApiFailure {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
  };
}

let session: Promise<SessionResponse> | null = null;

export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parse<Value>(response: Response): Promise<Value> {
  const body = (await response.json()) as Value & ApiFailure;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error?.code ?? "internal_error",
      body.error?.message ?? "The request failed.",
    );
  }
  return body;
}

export async function getSession(): Promise<SessionResponse> {
  session ??= fetch("/api/v1/session", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  }).then((response) => parse<SessionResponse>(response));
  return session;
}

export async function query<Value>(path: string): Promise<Value> {
  return parse<Value>(
    await fetch(path, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    }),
  );
}

export async function mutate<Value>(
  path: string,
  body: Readonly<Record<string, unknown>>,
): Promise<Value> {
  const current = await getSession();
  return parse<Value>(
    await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-cw-csrf": current.csrfToken,
        "x-idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    }),
  );
}

export const loadSnapshot = (): Promise<SnapshotResponse> =>
  query<SnapshotResponse>("/api/v1/snapshot");

export const loadDiagnostics = (): Promise<DiagnosticsResponse> =>
  query<DiagnosticsResponse>("/api/v1/diagnostics");
