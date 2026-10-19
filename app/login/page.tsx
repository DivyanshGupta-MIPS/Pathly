"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Lock, Mail, Loader2, ShieldAlert, ArrowRight } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Rate-limiting states
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

  // Countdown timer for rate limiting
  useEffect(() => {
    if (lockoutTime <= 0) return;
    const timer = setInterval(() => {
      setLockoutTime((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTime]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime > 0) return;

    setLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();

      // Set secure cookie for Next.js Edge Middleware (expires in 12 hours)
      document.cookie = `wayfinder_host_session=${token}; path=/; max-age=43200; SameSite=Strict; Secure`;

      router.push(redirectPath);
      router.refresh();
    } catch (err: any) {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);

      if (err.code === "auth/too-many-requests" || attempts >= 3) {
        setLockoutTime(30); // Lock UI for 30 seconds after 3 bad attempts
        setError("Too many failed attempts. Temporarily locked for 30s.");
      } else {
        setError("Invalid host email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
        
        <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-6">
          <Lock className="w-6 h-6 text-emerald-400" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Host Portal</h1>
        <p className="text-sm text-zinc-400 mb-8">
          Sign in with your administrator credentials to manage venue maps and guest passes.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-medium">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Host Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                disabled={lockoutTime > 0}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@venue.com"
                className="w-full bg-zinc-950/80 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                disabled={lockoutTime > 0}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-950/80 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || lockoutTime > 0}
            className="mt-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : lockoutTime > 0 ? (
              `Locked (${lockoutTime}s)`
            ) : (
              <>
                Sign In <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}