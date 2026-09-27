"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Loader2, Cloud, MousePointer2, Hand, MapPin, Route, 
  Link as LinkIcon, ShieldAlert, Map, Eraser, Undo2 , ArrowRight, Plus
} from "lucide-react";
import { db } from "../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import MapCanvas from "./MapCanvas"; 

function EditorCloudWrapper() {
  const searchParams = useSearchParams();
  const venueId = searchParams.get("venueId");
  const router = useRouter();
  
  const [venueData, setVenueData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTool, setActiveTool] = useState("pan");
  const [undoTrigger, setUndoTrigger] = useState(0);
  const [activeFloorId, setActiveFloorId] = useState("");
  
  const [isUploadingFloor, setIsUploadingFloor] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!venueId) return;
    const fetchVenueFromCloud = async () => {
      try {
        const docRef = doc(db, "venues", venueId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setVenueData(data);
          if (data.floors && data.floors.length > 0) setActiveFloorId(data.floors[0].id);
        }
      } catch (error) {
        console.error("Error fetching venue:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVenueFromCloud();
  }, [venueId]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          const maxSize = 800; 
          if (width > maxSize || height > maxSize) {
            if (width > height) { height = Math.round(height * (maxSize / width)); width = maxSize; } 
            else { width = Math.round(width * (maxSize / height)); height = maxSize; }
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height); }
          resolve(canvas.toDataURL("image/jpeg", 0.5)); 
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddFloor = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !venueId || !venueData) return;
    
    setIsUploadingFloor(true);
    try {
      const compressedBase64 = await compressImage(file);
      const newFloor = {
        id: Date.now().toString(),
        name: `Floor ${(venueData.floors?.length || 0) + 1}`,
        image: compressedBase64
      };
      
      const updatedFloors = [...(venueData.floors || []), newFloor];
      
      // Update cloud instantly
      const docRef = doc(db, "venues", venueId);
      await updateDoc(docRef, { floors: updatedFloors });
      
      // Update local view
      setVenueData({ ...venueData, floors: updatedFloors });
      setActiveFloorId(newFloor.id); // Switch immediately to the new floor
    } catch (error) {
      console.error("Failed to add floor", error);
      alert("Failed to upload new floor image.");
    } finally {
      setIsUploadingFloor(false);
    }
  };

  if (!venueId) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">No venue ID provided.</div>;
  if (isLoading) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-emerald-400 gap-4"><Loader2 className="w-10 h-10 animate-spin" /><h2>Downloading Venue Data...</h2></div>;

  const activeFloorImage = venueData?.floors?.find((f: any) => f.id === activeFloorId)?.image || venueData?.floors?.[0]?.image || "";

  const tools = [
    { id: "pan", icon: Hand, label: "Pan Canvas" },
    { id: "select", icon: MousePointer2, label: "Select Mode" },
    { id: "point", icon: MapPin, label: "Drop Node" },
    { id: "continuous", icon: Route, label: "Continuous Path" },
    { id: "direct_link", icon: LinkIcon, label: "Link Nodes" },
    { id: "blockade", icon: ShieldAlert, label: "Draw Blockade" },
    { id: "zone", icon: Map, label: "Draw POI Zone" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Cloud className="text-emerald-400 w-5 h-5" />
          <h1 className="text-white font-semibold">{venueData?.name || "Unnamed Venue"}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          
          {/* FLOOR SELECTOR & ADD BUTTON */}
          <div className="flex items-center gap-2 bg-slate-700 rounded-lg p-1">
            {venueData?.floors && venueData.floors.length > 0 && (
              <select 
                value={activeFloorId} 
                onChange={(e) => setActiveFloorId(e.target.value)} 
                className="bg-transparent text-white pl-2 pr-1 py-1 text-sm outline-none cursor-pointer"
              >
                {venueData.floors.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
            
            {/* Hidden File Input */}
            <input type="file" accept="image/png, image/jpeg" className="hidden" ref={fileInputRef} onChange={handleAddFloor} />
            
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isUploadingFloor}
              className="p-1.5 bg-slate-600 hover:bg-slate-500 rounded-md transition text-slate-300 hover:text-white"
              title="Add New Floor Map"
            >
              {isUploadingFloor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          
          <button 
            onClick={() => router.push(`/assign?venueId=${venueId}`)}
            className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition"
          >
            Assign Routes <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className="w-64 shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col py-4 gap-2 z-10 px-3 overflow-y-auto">
          {tools.map(tool => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`flex items-center gap-3 p-3 w-full text-left rounded-xl transition ${activeTool === tool.id ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"}`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium whitespace-nowrap">{tool.label}</span>
              </button>
            );
          })}
          <div className="w-full h-px bg-slate-700 my-2"></div>
          <button onClick={() => setUndoTrigger(prev => prev + 1)} className="flex items-center gap-3 p-3 w-full text-left rounded-xl text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition">
            <Undo2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium whitespace-nowrap">Undo</span>
          </button>
        </aside>

        <main className="flex-1 relative bg-slate-900">
          <MapCanvas 
            venueId={venueId} activeTool={activeTool} undoTrigger={undoTrigger} activeFloorId={activeFloorId} activeFloorImage={activeFloorImage}
            initialNodes={venueData?.nodes || []} initialEdges={venueData?.edges || []} initialZones={venueData?.zones || []}
          />
        </main>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-900" />}><EditorCloudWrapper /></Suspense>;
}