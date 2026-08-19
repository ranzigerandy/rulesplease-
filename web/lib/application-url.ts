const configuredAppOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

export const applicationOrigin =
  configuredAppOrigin ??
  (process.env.NODE_ENV === "production"
    ? "https://app.rulesplease.com"
    : "http://localhost:3000");

export const applicationHomeUrl = applicationOrigin;
export const applicationSignUpUrl = `${applicationOrigin}/sign-up`;
