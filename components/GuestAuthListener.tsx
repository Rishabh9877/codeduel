"use client";

import { useEffect, useRef } from "react";
import { useSession, signIn } from "next-auth/react";

/**
 * Automatically activates Guest Dev authentication when ?guest=1 or ?guest=2 is in URL.
 * Allows opening two browser windows/tabs side by side with zero login overhead.
 */
export function GuestAuthListener() {
  const { data: session, status } = useSession();
  const signingInRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const guestParam = url.searchParams.get("guest");

    if ((guestParam === "1" || guestParam === "2") && !signingInRef.current) {
      const targetUserId = `guest_${guestParam}`;
      const currentUserId = (session?.user as any)?.id;

      if (status !== "loading" && currentUserId !== targetUserId) {
        signingInRef.current = true;
        console.log(`[GuestAuthListener] Auto-signing in as Guest ${guestParam}...`);
        
        signIn("credentials", {
          guestId: guestParam,
          redirect: false,
        }).then((res) => {
          if (res?.ok) {
            // Remove guest query param and refresh to sync session state
            url.searchParams.delete("guest");
            window.location.href = url.pathname + (url.search ? url.search : "");
          } else {
            signingInRef.current = false;
          }
        }).catch((err) => {
          console.error("[GuestAuthListener] Sign-in error:", err);
          signingInRef.current = false;
        });
      }
    }
  }, [session, status]);

  return null;
}
