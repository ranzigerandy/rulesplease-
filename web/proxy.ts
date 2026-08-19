import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const proxyUrl = process.env.NEXT_PUBLIC_CLERK_PROXY_URL;

export default clerkMiddleware(
  (_auth, request) => {
    const hostname = request.headers.get("host")?.split(":")[0];
    if (hostname === "app.rulesplease.com" && request.nextUrl.pathname === "/") {
      const destination = request.nextUrl.clone();
      destination.pathname = "/product";
      return NextResponse.rewrite(destination);
    }
  },
  proxyUrl ? { frontendApiProxy: { enabled: true } } : {},
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
