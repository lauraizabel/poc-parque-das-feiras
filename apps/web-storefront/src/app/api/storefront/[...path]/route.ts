import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../lib/env";

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const targetUrl = new URL(`${env.NEXT_PUBLIC_API_URL}/${path.join("/")}`);
  targetUrl.search = request.nextUrl.search;

  const matchedHost =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(env.NEXT_PUBLIC_APP_URL).host;

  const bodyText =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      "x-forwarded-host": matchedHost,
      ...(request.headers.get("content-type")
        ? { "content-type": request.headers.get("content-type")! }
        : {})
    },
    body: bodyText && bodyText.length > 0 ? bodyText : undefined,
    cache: "no-store"
  });

  const responseText = await response.text();

  return new NextResponse(responseText, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json"
    }
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}
