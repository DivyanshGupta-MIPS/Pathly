import Link from "next/link";
import { ArrowLeft, Map as MapIcon, Check } from "lucide-react";

export default function YourPath() {
  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-6 pb-24">
      {/* Header */}
      <header className="flex items-center gap-4 mb-8">
        <Link href="/pass" className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <h1 className="text-xl font-semibold">Your Path</h1>
      </header>

      {/* Path Overview Card */}
      <div className="bg-slate-800 rounded-2xl p-5 mb-8 border border-slate-700">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg">1</div>
            <div>
              <h2 className="font-semibold text-lg">Path 2</h2>
              <p className="text-xs text-slate-400">Exhibition Area → Main Hall</p>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-700">
          <p className="text-sm text-slate-300">62 guests</p>
          <button className="px-4 py-2 border border-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-700 transition">
            View Map
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative pl-6 space-y-8 before:absolute before:inset-0 before:ml-[35px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-700">
        
        {/* Step 1 - Completed */}
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-slate-900 bg-emerald-500 text-slate-900 absolute left-[-16px] z-10 shadow">
            <Check className="w-4 h-4 font-bold" />
          </div>
          <div className="ml-8 bg-slate-800/50 p-4 rounded-xl border border-emerald-500/30 w-full">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-bold text-emerald-400">Registration</h3>
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-400">Main Entrance</p>
            <p className="text-[10px] text-slate-500 mt-2">2 min walk</p>
          </div>
        </div>

        {/* Step 2 - Current */}
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-slate-900 bg-blue-500 text-white font-bold text-xs absolute left-[-16px] z-10 shadow-lg shadow-blue-500/20">
            2
          </div>
          <div className="ml-8 bg-slate-800 p-4 rounded-xl border border-slate-600 w-full shadow-lg">
            <h3 className="font-bold text-white mb-1">Exhibition Area</h3>
            <p className="text-xs text-slate-400">Booths & Demos</p>
            <p className="text-[10px] text-slate-500 mt-2">5 min walk</p>
          </div>
        </div>

        {/* Step 3 - Upcoming */}
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
          <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-slate-900 bg-slate-700 text-slate-400 font-bold text-xs absolute left-[-16px] z-10">
            3
          </div>
          <div className="ml-8 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 w-full opacity-70">
            <h3 className="font-bold text-slate-300 mb-1">Main Hall</h3>
            <p className="text-xs text-slate-400">Keynote Session</p>
            <p className="text-[10px] text-slate-500 mt-2">3 min walk</p>
          </div>
        </div>

      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 w-full p-6 bg-slate-900 border-t border-slate-800">
        <button className="w-full flex items-center justify-center gap-2 py-3 border border-slate-600 text-white font-bold rounded-xl hover:bg-slate-800 transition">
          <MapIcon className="w-4 h-4" />
          View Full Map
        </button>
      </div>
    </div>
  );
}