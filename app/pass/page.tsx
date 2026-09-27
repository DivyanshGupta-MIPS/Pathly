import Link from "next/link";
import { QrCode, ChevronRight } from "lucide-react";

export default function GuestPass() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-6 relative overflow-hidden font-sans">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-64 bg-emerald-900/30 blur-3xl -z-10 rounded-b-full"></div>

      {/* Header */}
      <div className="w-full flex items-center gap-2 mb-8 mt-4 z-10">
        <div className="w-6 h-6 bg-emerald-500 rounded-bl-md rounded-tr-md"></div>
        <span className="text-xl font-bold text-white">Pathly</span>
      </div>

      {/* Pass Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative z-10">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Event Pass</p>
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Aarav Sharma</h1>
        <p className="text-lg text-slate-600 mb-8">Guest</p>

        {/* QR Code Placeholder */}
        <div className="w-48 h-48 mx-auto bg-white border-2 border-slate-100 rounded-xl flex items-center justify-center p-2 mb-8 shadow-sm">
           {/* In a real app, we use a QR library here. For UI, we use an icon */}
           <QrCode className="w-full h-full text-slate-800" strokeWidth={1} />
        </div>

        <div className="text-center mb-8">
          <h3 className="font-bold text-slate-900">Tech Summit 2025</h3>
          <p className="text-xs text-slate-500 mt-1">24 Apr 2025 • Convention Center</p>
        </div>

        {/* Path Summary Container */}
        <div className="border-t border-slate-100 pt-6">
          <p className="text-[10px] text-slate-400 font-semibold mb-2">Path</p>
          <Link href="/route" className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold">2</div>
              <div>
                <p className="text-xs font-bold text-slate-900">Path 2</p>
                <p className="text-[10px] text-slate-500">Exhibition Area → Main Hall</p>
              </div>
            </div>
            <ChevronRight className="text-slate-400 w-4 h-4" />
          </Link>
        </div>
        
        <div className="w-full mt-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg uppercase tracking-wider text-center">
          Guest
        </div>
        <p className="text-center text-[9px] text-slate-400 mt-3">Scan at checkpoints for directions</p>
      </div>
    </div>
  );
}