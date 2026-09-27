import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function GeneratePasses() {
  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-6 pb-24">
      {/* Header */}
      <header className="flex items-center gap-4 mb-8">
        <Link href="/dashboard" className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <h1 className="text-xl font-semibold">Generate Passes</h1>
      </header>

      {/* Progress Stepper */}
      <div className="flex justify-between items-center mb-8 px-2">
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-900 flex items-center justify-center text-[10px] font-bold">1</div>
          <span className="text-xs font-medium">Select Path</span>
        </div>
        <div className="h-[2px] flex-1 bg-slate-700 mx-1"></div>
        <div className="flex items-center gap-1 text-slate-500">
          <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">2</div>
          <span className="text-xs">Customize</span>
        </div>
        <div className="h-[2px] flex-1 bg-slate-700 mx-1"></div>
        <div className="flex items-center gap-1 text-slate-500">
          <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">3</div>
          <span className="text-xs">Generate</span>
        </div>
      </div>

      {/* Selected Path Card */}
      <div className="bg-slate-800 p-4 rounded-2xl flex items-center gap-4 border border-emerald-500/30 mb-8">
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
          2
        </div>
        <div>
          <h3 className="font-semibold text-sm">Path 2</h3>
          <p className="text-xs text-slate-400">Exhibition Area → Main Hall</p>
          <p className="text-xs text-slate-500 mt-1">62 guests</p>
        </div>
      </div>

      {/* Pass Type Selector */}
      <h2 className="text-sm font-semibold mb-3 text-slate-300">Pass Type</h2>
      <div className="flex gap-3 mb-8">
        <button className="px-5 py-2 bg-slate-800 border border-slate-600 rounded-full text-sm hover:bg-slate-700 transition">All</button>
        <button className="px-5 py-2 bg-emerald-900/40 border border-emerald-500 text-emerald-400 rounded-full text-sm font-medium">VIP</button>
        <button className="px-5 py-2 bg-slate-800 border border-slate-600 rounded-full text-sm hover:bg-slate-700 transition">Guest</button>
        <button className="px-5 py-2 bg-slate-800 border border-slate-600 rounded-full text-sm hover:bg-slate-700 transition">Staff</button>
      </div>

      {/* Design Selector */}
      <h2 className="text-sm font-semibold mb-3 text-slate-300">Design</h2>
      <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar">
        {/* Active Design */}
        <div className="min-w-[80px] h-[120px] bg-slate-800 rounded-lg border-2 border-emerald-500 p-1 flex flex-col items-center">
           <div className="w-full h-full bg-slate-700 rounded text-[8px] p-2 flex flex-col justify-between">
              <div className="w-full h-10 bg-slate-600 rounded-sm mb-1"></div>
              <div className="w-full h-2 bg-slate-600 rounded-sm mb-1"></div>
              <div className="w-1/2 h-2 bg-slate-600 rounded-sm"></div>
           </div>
        </div>
        {/* Inactive Designs */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="min-w-[80px] h-[120px] bg-slate-800 rounded-lg border border-slate-700 p-1 flex flex-col items-center opacity-60">
             <div className="w-full h-full bg-slate-700 rounded text-[8px] p-2 flex flex-col justify-between">
                <div className="w-full h-8 bg-slate-600 rounded-sm mb-1"></div>
                <div className="w-full h-6 bg-slate-600 rounded-sm mt-auto"></div>
             </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 w-full p-6 bg-slate-900 border-t border-slate-800">
        <Link href="/pass" className="w-full block text-center py-3 bg-emerald-200 text-emerald-900 font-bold rounded-xl hover:bg-emerald-300 transition">
          Generate Passes
        </Link>
      </div>
    </div>
  );
}