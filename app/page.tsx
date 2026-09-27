"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut, 
  sendEmailVerification, 
  User 
} from "firebase/auth";
import { collection, getDocs, addDoc, query, where, updateDoc, doc } from "firebase/firestore";
import { Map, MapPin, Ticket, Plus, Loader2, LogOut, Lock, Edit2, Check, X, MailWarning, RefreshCw } from "lucide-react";

export default function Home() {
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  
  const [venues, setVenues] = useState<any[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [editVenueName, setEditVenueName] = useState("");
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      // Only fetch venues if they are fully verified
      if (currentUser && currentUser.emailVerified) {
        fetchVenues(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchVenues = async (userId: string) => {
    setVenuesLoading(true);
    try {
      const q = query(collection(db, "venues"), where("ownerId", "==", userId));
      const querySnapshot = await getDocs(q);
      const venueList = querySnapshot.docs.map(document => ({ id: document.id, ...(document.data()as any) }));
      venueList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setVenues(venueList);
    } catch (error) {
      console.error("Error fetching venues:", error);
    } finally {
      setVenuesLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
      }
    } catch (error: any) {
      setAuthError(error.message.replace("Firebase: ", ""));
    }
  };

  const handleCreateVenue = async () => {
    if (!user) return;
    setIsCreating(true);
    try {
      const newVenue = {
        name: "Untitled Event",
        ownerId: user.uid,
        createdAt: Date.now(),
        nodes: [], edges: [], zones: [], floors: []
      };
      const docRef = await addDoc(collection(db, "venues"), newVenue);
      router.push(`/editor?venueId=${docRef.id}`);
    } catch (error) {
      console.error("Error creating venue:", error);
      setIsCreating(false);
    }
  };

  const saveVenueName = async (id: string) => {
    if (!editVenueName.trim()) return setEditingVenueId(null);
    try {
      await updateDoc(doc(db, "venues", id), { name: editVenueName });
      setVenues(venues.map(v => v.id === id ? { ...v, name: editVenueName } : v));
      setEditingVenueId(null);
    } catch (error) {
      console.error("Error renaming:", error);
    }
  };

  // NEW: Forces Firebase to fetch the latest email verification status
  const checkVerificationStatus = async () => {
    if (!user) return;
    setIsCheckingVerification(true);
    await user.reload(); // Refreshes the user token
    if (user.emailVerified) {
      fetchVenues(user.uid);
      // Force a state update to trigger a re-render
      setUser({ ...user } as User);
    } else {
      setAuthError("Email not verified yet. Please check your spam folder.");
    }
    setIsCheckingVerification(false);
  };

  const resendVerification = async () => {
    if (!user) return;
    try {
      await sendEmailVerification(user);
      alert("Verification email sent!");
    } catch (error: any) {
      setAuthError("Please wait a moment before sending another email.");
    }
  };

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div>;

  // VIEW 1: LOGIN
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="text-center mb-8">
          <div className="bg-emerald-500/20 p-4 rounded-full inline-block mb-4">
            <Map className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">EventWayfinder</h1>
          <p className="text-slate-400 mt-2">Manage your venues, maps, and guest passes.</p>
        </div>

        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-500" /> {isLoginView ? "Host Login" : "Create Host Account"}
          </h2>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Email Address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition" placeholder="host@event.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition" placeholder="••••••••" />
            </div>

            {authError && <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">{authError}</div>}

            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/20 mt-2">
              {isLoginView ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => { setIsLoginView(!isLoginView); setAuthError(""); }} className="text-sm text-emerald-400 hover:text-emerald-300 transition">
              {isLoginView ? "Need an account? Sign up here." : "Already have an account? Sign in."}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VIEW 2: THE VERIFICATION GATE
  if (!user.emailVerified) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl text-center">
          <div className="bg-yellow-500/20 p-4 rounded-full inline-block mb-4">
            <MailWarning className="w-10 h-10 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Verify your email</h2>
          <p className="text-slate-400 mb-8">
            We sent a verification link to <span className="text-white font-semibold">{user.email}</span>. You must click it before accessing the dashboard.
          </p>
          
          {authError && <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm mb-6">{authError}</div>}

          <div className="flex flex-col gap-3">
            <button onClick={checkVerificationStatus} disabled={isCheckingVerification} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
              {isCheckingVerification ? <Loader2 className="w-5 h-5 animate-spin" /> : <><RefreshCw className="w-5 h-5" /> I have verified my email</>}
            </button>
            <button onClick={resendVerification} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3.5 rounded-xl transition">
              Resend verification email
            </button>
            <button onClick={() => signOut(auth)} className="text-sm text-slate-500 hover:text-slate-300 mt-4 underline">
              Sign out and return to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VIEW 3: HOST DASHBOARD
  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      <header className="bg-slate-800 border-b border-slate-700 p-6 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Map className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl font-bold">Host Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:block">{user.email}</span>
            <button onClick={() => signOut(auth)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition flex items-center gap-2 text-sm">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold">Your Venues</h2>
            <p className="text-slate-400">Select a venue to edit its map or manage guests.</p>
          </div>
          <button onClick={handleCreateVenue} disabled={isCreating} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50">
            {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} Create New Venue
          </button>
        </div>

        {venuesLoading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : venues.length === 0 ? (
          <div className="bg-slate-800 border border-dashed border-slate-600 rounded-2xl p-12 text-center">
            <MapPin className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No venues yet</h3>
            <p className="text-slate-400 mb-6">Create your first venue to start drawing paths and inviting guests.</p>
            <button onClick={handleCreateVenue} className="text-emerald-400 font-semibold hover:text-emerald-300 transition">Get Started &rarr;</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {venues.map(venue => (
              <div key={venue.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col hover:border-slate-500 transition group">
                <div className="p-6 flex-1">
                  
                  {editingVenueId === venue.id ? (
                    <div className="flex items-center gap-2 mb-2">
                      <input 
                        type="text" autoFocus value={editVenueName} onChange={e => setEditVenueName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveVenueName(venue.id)}
                        className="bg-slate-900 border border-emerald-500 rounded px-2 py-1 outline-none text-white w-full font-bold"
                      />
                      <button onClick={() => saveVenueName(venue.id)} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500 hover:text-white transition"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingVenueId(null)} className="p-1.5 bg-slate-700 text-slate-400 rounded hover:bg-slate-600 transition"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xl font-bold group-hover:text-emerald-400 transition truncate pr-2">{venue.name || "Untitled Event"}</h3>
                      <button onClick={() => { setEditingVenueId(venue.id); setEditVenueName(venue.name || "Untitled Event"); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition"><Edit2 className="w-4 h-4" /></button>
                    </div>
                  )}

                  <p className="text-xs text-slate-500 uppercase tracking-widest">
                    Created {new Date(venue.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-slate-900 border-t border-slate-700 p-4 grid grid-cols-2 gap-3">
                  <button onClick={() => router.push(`/editor?venueId=${venue.id}`)} className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 py-2.5 rounded-lg text-sm font-semibold transition border border-slate-700">
                    <Map className="w-4 h-4 text-blue-400" /> Map Editor
                  </button>
                  <button onClick={() => router.push(`/assign?venueId=${venue.id}`)} className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 py-2.5 rounded-lg text-sm font-semibold transition border border-slate-700">
                    <Ticket className="w-4 h-4 text-emerald-400" /> Passes
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}