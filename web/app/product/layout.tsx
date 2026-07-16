import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function ProductLayout({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_RULES_BACKEND !== "local") {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");
  }
  return children;
}
