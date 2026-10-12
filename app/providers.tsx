"use client";

import { SessionProvider } from "next-auth/react";
import { GuestAuthListener } from "@/components/GuestAuthListener";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <GuestAuthListener />
      {children}
    </SessionProvider>
  );
}

