import Link from "next/link";
import { ArrowLeft, Flashlight, CheckCircle2 } from "lucide-react";

export default function Scanner() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between p-6 relative overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 bg-slate-800/80 backdrop-blur rounded-full hover:bg-slate-700 transition">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-xl font-semibold">Scan QR Code</h1>
        </div>
      </header>

      {/* Viewfinder Overlay Simulation */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-8">
        <div className="w-72 h-72 border-2 border-emerald-400/60 rounded-3xl relative flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.1)]">
          {/* Corner Framing Markers */}
          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl-xl"></div>
          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr-xl"></div>
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl-xl"></div>
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br-xl"></div>
          
          <p className="text-xs text-slate-400 text-center px-6">Point your camera at the QR code on the guest's pass.</p>
        </div>
      </div>

      {/* Bottom Camera Action Controls */}
      <div className="flex flex-col items-center gap-6 z-10 mb-6">
        <button className="w-14 h-14 bg-slate-800/80 backdrop-blur border border-slate-700 rounded-full flex items-center justify-center text-emerald-400 hover:bg-slate-700 transition shadow-lg">
          <Flashlight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}