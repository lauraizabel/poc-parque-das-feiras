import { env } from "./env";

export function normalizeApiMessage(payload: unknown, fallback: string) {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const value = (payload as { message?: unknown }).message;

    if (typeof value === "string") {
      return value;
    }
  }

  return fallback;
}

export async function dashboardApiJson<TPayload>(
  path: string,
  init?: RequestInit
): Promise<{ payload: TPayload; response: Response }> {
  const url = path.startsWith("http") ? path : `${env.NEXT_PUBLIC_API_URL}${path}`;
  const response = await fetch(url, init);
  const payload = (await response.json()) as TPayload;

  return {
    payload,
    response
  };
}

export function authHeaders(token: string, headers?: HeadersInit): HeadersInit {
  return {
    ...headers,
    authorization: `Bearer ${token}`
  };
}
