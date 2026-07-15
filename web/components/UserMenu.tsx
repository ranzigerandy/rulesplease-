"use client";

import { UserButton } from "@clerk/nextjs";
import { ReactNode } from "react";

export function UserMenu({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      {children}
      <UserButton />
    </div>
  );
}
