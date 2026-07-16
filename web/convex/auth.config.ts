import type { AuthConfig } from "convex/server";

const authConfig = {
  providers: [
    {
      domain: process.env.CLERK_FRONTEND_API_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;

export default authConfig;
