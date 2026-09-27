import { Bell, Map, Route, QrCode, Users, Home, Calendar, Ticket, Settings, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20 font-sans">
      {/* Top Header */}
      <header className="flex justify-between items-center p-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-500 rounded-bl-md rounded-tr-md"></div>
          <span className="text-xl font-bold">Pathly</span>
        </div>
        <div className="flex gap-4">
          <Bell className="w-6 h-6 text-slate-400" />
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs">KG</div>
        </div>
      </header>

      <main className="px-6">
        <h1 className="text-2xl font-semibold mb-1">Host Dashboard</h1>
        <p className="text-sm text-slate-400 mb-6">Manage your event, maps, guests and passes.</p>

        {/* Active Event Card */}
        <div className="bg-slate-800 rounded-2xl p-4 mb-6 flex justify-between items-center cursor-pointer hover:bg-slate-750 transition">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 bg-slate-700 rounded-lg"></div> {/* Placeholder for Event Image */}
            <div>
              <h3 className="font-semibold text-lg">Tech Summit 2025</h3>
              <p className="text-xs text-slate-400">24 Apr 2025 • 9:00 AM</p>
              <p className="text-xs text-slate-400">Convention Center, Hall A</p>
            </div>
          </div>
          <ChevronRight className="text-slate-400" />
        </div>

        {/* Stats Row */}
        <div className="flex justify-between bg-slate-800 rounded-2xl p-4 mb-6 divide-x divide-slate-700">
          <div className="text-center px-4">
            <p className="text-xs text-slate-400 mb-1">Total Guests</p>
            <p className="text-xl font-bold">240</p>
          </div>
          <div className="text-center px-4">
            <p className="text-xs text-slate-400 mb-1">Checked In</p>
            <p className="text-xl font-bold text-emerald-400">198</p>
          </div>
          <div className="text-center px-4">
            <p className="text-xs text-slate-400 mb-1">Pending</p>
            <p className="text-xl font-bold">42</p>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link href="/upload" className="bg-slate-800 p-4 rounded-2xl flex flex-col items-start gap-3 hover:bg-slate-700 transition">
  <div className="bg-emerald-900/50 p-2 rounded-lg text-emerald-400">
    <Map className="w-5 h-5" />
  </div>
  <div className="text-left">
    <p className="font-semibold text-sm">Upload Floor Plan</p>
    <p className="text-[10px] text-slate-400">Add your venue map</p>
  </div>
</Link>
          
          {/* ... Upload Floor Plan link from earlier ... */}
          
          <Link href="/assign" className="bg-slate-800 p-4 rounded-2xl flex flex-col items-start gap-3 hover:bg-slate-700 transition">
            <div className="bg-emerald-900/50 p-2 rounded-lg text-emerald-400">
              <Route className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">Assign Paths</p>
              <p className="text-[10px] text-slate-400">Create and manage routes</p>
            </div>
          </Link>

          <Link href="/generate" className="bg-slate-800 p-4 rounded-2xl flex flex-col items-start gap-3 hover:bg-slate-700 transition">
            <div className="bg-emerald-900/50 p-2 rounded-lg text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">Generate Passes</p>
              <p className="text-[10px] text-slate-400">QR passes for your guests</p>
            </div>
          </Link>
          <Link href="/scanner" className="bg-slate-800 p-4 rounded-2xl flex flex-col items-start gap-3 hover:bg-slate-700 transition">
            <div className="bg-emerald-900/50 p-2 rounded-lg text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">Scan Passes</p>
              <p className="text-[10px] text-slate-400">Verify guest check-ins</p>
            </div>
          </Link>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-slate-900 border-t border-slate-800 flex justify-around p-4 text-slate-400">
        <button className="flex flex-col items-center gap-1 text-emerald-400">
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 hover:text-white transition">
          <Calendar className="w-5 h-5" />
          <span className="text-[10px]">Events</span>
        </button>
        <button className="flex flex-col items-center gap-1 hover:text-white transition">
          <Ticket className="w-5 h-5" />
          <span className="text-[10px]">Passes</span>
        </button>
        <button className="flex flex-col items-center gap-1 hover:text-white transition">
          <Settings className="w-5 h-5" />
          <span className="text-[10px]">Settings</span>
        </button>
      </nav>
    </div>
  );
}