type HeaderValue = string | string[] | number | undefined;

type RateLimitedRequest = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
};

type RateLimitedResponse = {
  getHeader(name: string): HeaderValue;
  setHeader(name: string, value: string): void;
};

export function resolveClientIp(request: RateLimitedRequest) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

  if (typeof forwardedValue === "string" && forwardedValue.trim().length > 0) {
    return forwardedValue.split(",")[0]!.trim();
  }

  if (typeof request.ip === "string" && request.ip.trim().length > 0) {
    return request.ip;
  }

  if (typeof request.socket?.remoteAddress === "string" && request.socket.remoteAddress.length > 0) {
    return request.socket.remoteAddress;
  }

  return "unknown";
}

export function normalizeRateLimitIdentity(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : "anonymous";
}

export function appendHeader(response: RateLimitedResponse, name: string, value: string) {
  const currentValue = response.getHeader(name);

  if (!currentValue) {
    response.setHeader(name, value);
    return;
  }

  const nextValue = Array.isArray(currentValue)
    ? [...currentValue, value].join(", ")
    : `${String(currentValue)}, ${value}`;

  response.setHeader(name, nextValue);
}
