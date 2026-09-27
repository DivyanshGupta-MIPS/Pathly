"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { collection, getDocs, addDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Ticket, Loader2, UserPlus, Printer, Users, Crown, MapPin, ChevronRight, Navigation, Palette } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

type ThemeType = 'corporate' | 'warm' | 'racing';

function PassGenerator() {
  const searchParams = useSearchParams();
  const venueId = searchParams.get("venueId");

  const [venueData, setVenueData] = useState<any>(null);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [company, setCompany] = useState("");
  const [startId, setStartId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [isVip, setIsVip] = useState(false);
  const [theme, setTheme] = useState<ThemeType>('corporate');

  useEffect(() => {
    if (!venueId) return;
    const fetchData = async () => {
      try {
        const vSnap = await getDoc(doc(db, "venues", venueId));
        if (vSnap.exists()) {
          const vData = vSnap.data();
          setVenueData(vData);
          const zones = (vData.zones || []).filter((z: any) => z.type !== "blockade" && z.label).map((z: any) => ({ ...z, destType: 'Zone' }));
          const nodes = (vData.nodes || []).filter((n: any) => n.label && isNaN(Number(n.label))).map((n: any) => ({ ...n, destType: 'Node' }));
          setDestinations([...zones, ...nodes]);
        }

        const guestsSnap = await getDocs(collection(db, "venues", venueId, "guests"));
        const guestList = guestsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data()as any) }));
        guestList.sort((a, b) => b.createdAt - a.createdAt);
        setGuests(guestList);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [venueId]);

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueId || !name || !targetId) return;
    
    setIsSaving(true);
    try {
      const targetDest = destinations.find(d => d.id === targetId);
      const startDest = destinations.find(d => d.id === startId);
      
      const newGuest = {
        name, designation, company, isVip,
        startId, startName: startDest?.label || "",
        targetId, targetName: targetDest?.label || "Unknown",
        theme,
        createdAt: Date.now()
      };

      const docRef = await addDoc(collection(db, "venues", venueId, "guests"), newGuest);
      setGuests([{ id: docRef.id, ...newGuest }, ...guests]);
      
      setName(""); setDesignation(""); setCompany(""); setIsVip(false); setTargetId(""); setStartId("");
    } catch (error) {
      console.error("Error saving guest:", error);
      alert("Failed to save guest.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => window.print();

  if (!venueId) return <div className="p-8 text-white bg-slate-900 min-h-screen">Invalid Venue ID. Please return to Editor.</div>;
  if (isLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div>;

  let previewUrl = targetId ? `${window.location.origin}/navigate?venueId=${venueId}&target=${targetId}` : window.location.origin;
  if (targetId && startId) previewUrl += `&start=${startId}`;
  
  const targetLabel = destinations.find(d => d.id === targetId)?.label || "Select a destination";

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans relative pb-20">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #print-badge, #print-badge * { visibility: visible; }
          #print-badge { 
            position: absolute; left: 50%; top: 50%; 
            transform: translate(-50%, -50%);
            width: 4in !important; height: 6in !important; 
            margin: 0; box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      <header className="bg-slate-800 border-b border-slate-700 p-6 shadow-md z-50 sticky top-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg"><Ticket className="w-6 h-6" /></div>
            <div>
              <h1 className="text-xl font-bold">Pass Generator</h1>
              <p className="text-sm text-slate-400">{venueData?.name || "Unnamed Venue"}</p>
            </div>
          </div>
          <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition shadow-lg shadow-blue-500/20">
            <Printer className="w-5 h-5" /> Print Badge
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Controls & CRM */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-emerald-400" /> Guest Details</h2>
            
            <form onSubmit={handleSaveGuest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Guest Name</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Doe" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Designation</label>
                  <input type="text" value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Director" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Company</label>
                  <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Acme Corp" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider flex items-center gap-1"><Navigation className="w-3 h-3"/> Start Point (Opt)</label>
                  <select value={startId} onChange={e => setStartId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition appearance-none cursor-pointer text-slate-300">
                    <option value="">Let guest choose</option>
                    {destinations.map(d => <option key={`start-${d.id}`} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3"/> Assigned Route</label>
                  <select required value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition appearance-none cursor-pointer">
                    <option value="" disabled>Select destination...</option>
                    {destinations.map(d => <option key={`end-${d.id}`} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Theme Selector */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1"><Palette className="w-3 h-3"/> Badge Theme</label>
                <div className="grid grid-cols-3 gap-3">
                  <button type="button" onClick={() => setTheme('corporate')} className={`py-2 px-3 rounded-lg border text-sm font-medium transition ${theme === 'corporate' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>Corporate Blue</button>
                  <button type="button" onClick={() => setTheme('warm')} className={`py-2 px-3 rounded-lg border text-sm font-medium transition ${theme === 'warm' ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>Warm Event</button>
                  <button type="button" onClick={() => setTheme('racing')} className={`py-2 px-3 rounded-lg border text-sm font-medium transition ${theme === 'racing' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>Bold Racing</button>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-900 rounded-xl border border-slate-700 mt-2">
                <input type="checkbox" id="vipToggle" checked={isVip} onChange={e => setIsVip(e.target.checked)} className="w-5 h-5 accent-emerald-500 cursor-pointer" />
                <label htmlFor="vipToggle" className="font-medium cursor-pointer flex items-center gap-2 text-yellow-400">
                  <Crown className="w-4 h-4" /> Grant VIP Access
                </label>
              </div>

              <button type="submit" disabled={isSaving || !name || !targetId} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 mt-4">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Guest to Directory"}
              </button>
            </form>
          </div>

          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl h-[300px] flex flex-col">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-blue-400" /> Directory ({guests.length})</h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {guests.length === 0 ? (
                <div className="text-center text-slate-500 py-8">No guests generated yet.</div>
              ) : (
                guests.map(g => (
                  <div key={g.id} 
                    className="p-3 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-between hover:border-slate-500 cursor-pointer transition"
                    onClick={() => {
                      setName(g.name); setDesignation(g.designation || ""); setCompany(g.company || ""); setIsVip(g.isVip); setTargetId(g.targetId); setStartId(g.startId || ""); setTheme(g.theme || 'corporate');
                    }}
                  >
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        {g.name} {g.isVip && <Crown className="w-3 h-3 text-yellow-500" />}
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {g.targetName}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Badge Preview */}
        <div className="lg:col-span-6 flex justify-center sticky top-28">
          
          {/* THE ACTUAL PRINTABLE BADGE */}
          <div 
            id="print-badge" 
            className={`relative overflow-hidden rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-600 flex flex-col ${theme === 'racing' ? 'bg-zinc-900 text-white' : 'bg-white text-slate-900'}`}
            style={{ width: "4in", height: "6in" }} 
          >
            
            {/* --- THEME 1: CORPORATE BLUE --- */}
            {/* --- THEME 1: CORPORATE BLUE --- */}
            {theme === 'corporate' && (
              <>
                <div className="absolute top-0 right-0 w-full h-1/2 bg-blue-900 z-0" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }}></div>
                <div className="absolute top-0 right-0 w-full h-1/2 bg-blue-500 opacity-50 z-0" style={{ clipPath: 'polygon(100% 0, 100% 80%, 20% 0)' }}></div>
                
                <div className="absolute top-8 right-8 left-8 text-white flex flex-col items-end z-10">
                  <div className="font-black text-xl uppercase tracking-widest text-right max-w-[80%] break-words leading-tight">{venueData?.name || "Event"}</div>
                  <div className="text-[10px] tracking-widest opacity-80 mt-1 uppercase">EVENT PASS {new Date().getFullYear()}</div>
                </div>

                {/* FIX: Shifted to middle-left with relative z-20 to sit above all backgrounds */}
                <div className="mt-32 px-8 text-left z-20 relative">
                  {isVip ? (
                    <div className="text-blue-900 font-black text-5xl tracking-tighter mb-1">VIP</div>
                  ) : (
                    <div className="text-blue-900 font-black text-5xl tracking-tighter mb-1">GUEST</div>
                  )}
                  <div className="uppercase tracking-[0.3em] text-[10px] text-slate-500 font-bold border-b-2 border-blue-900/20 pb-2 inline-block pr-8">ALL ACCESS</div>
                </div>

                <div className="flex-1 flex items-end justify-between p-8 z-20 relative">
                  <div className="w-2/3 pr-4">
                    <h1 className="text-2xl font-black uppercase text-slate-900 leading-tight mb-1 truncate">{name || "GUEST NAME"}</h1>
                    <p className="text-sm font-bold text-slate-600 uppercase truncate">{designation || "ROLE"}</p>
                    <p className="text-sm font-medium text-slate-500 truncate">{company || "COMPANY NAME"}</p>
                    
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Route To</p>
                      <p className="text-sm font-bold text-blue-600 line-clamp-2">{targetLabel}</p>
                    </div>
                  </div>
                  <div className="w-1/3 flex justify-end shrink-0">
                    <div className="bg-white p-1 rounded border border-slate-200 shadow-sm">
                      <QRCodeCanvas value={previewUrl} size={80} level={"H"} fgColor="#1e3a8a" />
                    </div>
                  </div>
                </div>
                
                <div className="h-4 w-full bg-blue-900 absolute bottom-0 z-10"></div>
                <div className="h-10 w-full bg-blue-500 absolute bottom-0 rounded-tl-full opacity-30 right-[-20%] z-10"></div>
              </>
            )}

            {/* --- THEME 2: WARM EVENT --- */}
            {theme === 'warm' && (
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-orange-100 to-white flex">
                <div className="w-16 h-full bg-orange-600 flex items-center justify-center border-r-8 border-orange-700">
                  <div className="transform -rotate-90 text-white font-black text-3xl tracking-[0.2em] whitespace-nowrap">
                    EVENT {new Date().getFullYear()}
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col p-8 justify-between">
                  <div className="flex justify-between items-start">
                    <div className="w-full">
                      <h2 className="text-xs font-bold text-orange-900 uppercase tracking-widest mb-4 truncate">{venueData?.name || "Event Venue"}</h2>
                      {isVip && <div className="bg-orange-600 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 inline-block rounded-md mb-3">VIP Premium</div>}
                      <h1 className="text-3xl font-black text-slate-900 leading-tight mb-2 break-words line-clamp-2">{name || "GUEST NAME"}</h1>
                      <p className="text-orange-700 font-bold uppercase tracking-wider text-sm truncate">{designation || "ROLE"}</p>
                      <p className="text-slate-600 font-medium text-sm mt-1 truncate">{company}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-4 mt-6">
                    <div className="bg-white p-2.5 rounded-2xl shadow-lg border border-orange-200">
                      <QRCodeCanvas value={previewUrl} size={110} level={"H"} fgColor="#c2410c" />
                    </div>
                    <div className="text-center w-full bg-white/60 py-2 px-3 rounded-lg backdrop-blur-sm border border-white/50">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-orange-800">Assigned Destination</p>
                      <p className="font-black text-slate-900 text-base line-clamp-1">{targetLabel}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- THEME 3: BOLD RACING --- */}
            {theme === 'racing' && (
              <div className="absolute inset-0 flex flex-col justify-between overflow-hidden border-[8px] border-zinc-900">
                
                <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none select-none overflow-hidden">
                  <div className="transform -rotate-45 text-[10rem] font-black text-white leading-none whitespace-nowrap">
                    {isVip ? "VIP" : "ACCESS"}
                  </div>
                </div>

                <div className="p-8 z-10 flex justify-between items-start">
                  <div className="max-w-[70%]">
                    <h2 className="text-red-500 font-black tracking-tighter text-2xl leading-none uppercase break-words line-clamp-2">{venueData?.name || "EVENT PASS"}</h2>
                    <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-2">ALL ACCESS</p>
                  </div>
                  {isVip && <div className="bg-red-600 text-white font-black text-2xl px-3 py-1 italic tracking-tighter shrink-0 ml-2">VIP</div>}
                </div>

                <div className="px-8 py-4 z-10 mb-2">
                  <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2 leading-tight line-clamp-2">{name || "GUEST"}</h1>
                  <p className="text-lg font-bold text-zinc-400 uppercase tracking-widest truncate">{designation || "STAFF"}</p>
                  <p className="text-xs font-bold text-zinc-500 uppercase truncate">{company}</p>
                </div>

                <div className="bg-white p-6 z-10 flex justify-between items-center relative">
                  <div className="absolute top-0 left-0 w-32 h-4" style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', backgroundSize: '16px 16px', backgroundPosition: '0 0, 8px 8px' }}></div>
                  
                  <div className="pt-2 pr-4">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Assigned Route</p>
                    <p className="text-zinc-900 font-black text-xl italic tracking-tighter line-clamp-2">{targetLabel}</p>
                  </div>
                  <div className="shrink-0 bg-white p-1">
                    <QRCodeCanvas value={previewUrl} size={70} level={"H"} fgColor="#000000" />
                  </div>
                </div>
                
                <div className="bg-red-600 text-center py-2 z-10">
                  <p className="text-white text-[9px] font-bold tracking-[0.3em] uppercase">{isVip ? "VIP" : "GENERAL"} EVENT PASS - VALID {new Date().getFullYear()}</p>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

export default function AssignPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-900" />}><PassGenerator /></Suspense>;
}