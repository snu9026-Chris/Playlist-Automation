import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function matches(actual: string, expected: string) {
  return timingSafeEqual(createHash("sha256").update(actual).digest(), createHash("sha256").update(expected).digest());
}

/** Single-owner app: protect pages and every API before privileged handlers run. */
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === "/api/cron/upload") return NextResponse.next();
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return NextResponse.json({ error: "Administrator credentials are not configured" }, { status: 503 });
  const expected = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  if (!matches(req.headers.get("authorization") ?? "", expected)) {
    return new NextResponse("Administrator login required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Loopify", charset="UTF-8"', "Cache-Control": "no-store" },
    });
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const expectedOrigin = new URL(process.env.NEXT_PUBLIC_BASE_URL || req.url).origin;
    if ((origin && origin !== expectedOrigin) || req.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json({ error: "Cross-site request denied" }, { status: 403 });
    }
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: "/:path*" };
