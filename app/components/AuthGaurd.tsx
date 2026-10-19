"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Clear any fake or expired cookie and kick to login
        document.cookie = "wayfinder_host_session=; path=/; max-age=0";
        router.replace("/login");
      } else {
        // Refresh the cookie token and allow access
        const token = await user.getIdToken();
        document.cookie = `wayfinder_host_session=${token}; path=/; max-age=43200; SameSite=Strict; Secure`;
        setVerified(true);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (!verified) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Verifying Host Session</span>
      </div>
    );
  }

  return <>{children}</>;
}

// Helper function you can attach to any "Log Out" button in your app
export const logoutHost = async () => {
  await signOut(auth);
  document.cookie = "wayfinder_host_session=; path=/; max-age=0";
  window.location.href = "/login";
};