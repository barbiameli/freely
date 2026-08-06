import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/signin",
  },
});

export const config = {
  // Protect everything except auth pages, the public client site, static
  // assets, and API routes (which check the session themselves).
  matcher: [
    "/quote/:path*",
    "/track/:path*",
    "/diary/:path*",
    "/memory/:path*",
    "/team/:path*",
    "/onboarding/:path*",
  ],
};
