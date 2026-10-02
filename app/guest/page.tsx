"use client";

import React, { useState, useEffect, useMemo, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase"; 
import { doc, getDoc } from "firebase/firestore";
import { Stage, Layer, Circle, Line, Text as KonvaText, Image as KonvaImage } from "react-konva";
import { Loader2, User, Briefcase, MapPin, X, Navigation, Building2, Layers } from "lucide-react";

// --- DIJKSTRA ALGORITHM ---
const findShortestPath = (nodes: any[], edges: any[], startId: string, endId: string) => {
  const graph: any = {};
  nodes.forEach(n => graph[n.id] = {});
  edges.forEach(e => {
    const n1 = nodes.find(n => n.id === e.from);
    const n2 = nodes.find(n => n.id === e.to);
    if (n1 && n2) {
      const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
      graph[e.from][e.to] = dist;
      graph[e.to][e.from] = dist; 
    }
  });

  const distances: any = {};
  const previous: any = {};
  const queue = new Set<string>();

  nodes.forEach(n => { distances[n.id] = Infinity; queue.add(n.id); });
  distances[startId] = 0;

  while (queue.size > 0) {
    let closestNode = null;
    for (const nodeId of queue) {
      if (closestNode === null || distances[nodeId] < distances[closestNode]) closestNode = nodeId;
    }
    if (closestNode === null || closestNode === endId) break;
    queue.delete(closestNode);

    for (const neighbor in graph[closestNode]) {
      const alt = distances[closestNode] + graph[closestNode][neighbor];
      if (alt < distances[neighbor]) { distances[neighbor] = alt; previous[neighbor] = closestNode; }
    }
  }

  const path = [];
  let current = endId;
  while (current) { path.unshift(current); current = previous[current]; }
  return path[0] === startId ? path : [];
};

function GuestMapContent() {
  const searchParams = useSearchParams();
  const venueId = searchParams.get("venueId");
  
  // These rely on the QR code passing them! If missing, they default.
  const guestName = searchParams.get("name") || "VIP Guest";
  const guestRole = searchParams.get("role") || "";
  const guestCompany = searchParams.get("company") || "";
  const guestTable = searchParams.get("table") || "";
  
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [currentFloor, setCurrentFloor] = useState<string>("1");
  const [floors, setFloors] = useState<string[]>([]);
  const [startNode, setStartNode] = useState<string | null>(null);
  const [destNode, setDestNode] = useState<string | null>(null);
  
  const [showDestSelector, setShowDestSelector] = useState(false);
  const [showStartSelector, setShowStartSelector] = useState(false);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  const stageRef = useRef<any>(null);
  const [lastDist, setLastDist] = useState(0);

  // 1. FETCH VENUE
  useEffect(() => {
    if (!venueId) { setLoading(false); return; }
    const fetchVenue = async () => {
      try {
        const docRef = doc(db, "venues", venueId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setVenue(data);
          
          const uniqueFloors = Array.from(new Set(data.nodes?.map((n: any) => n.floorId || "1"))) as string[];
          const sortedFloors = uniqueFloors.sort();
          setFloors(sortedFloors.length > 0 ? sortedFloors : ["1"]);
          setCurrentFloor(sortedFloors.length > 0 ? sortedFloors[0] : "1");
          
          const entrance = data.nodes?.find((n: any) => n.label?.toLowerCase().includes("entrance"));
          if (entrance) setStartNode(entrance.id);
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchVenue();
  }, [venueId]);

  // 2. LOAD IMAGE SECURELY
  useEffect(() => {
    if (!venue) return;
    const floorData = venue.floors?.find((f: any) => f.id === currentFloor);
    const mapUrl = floorData?.imageUrl || floorData?.mapUrl || venue.imageUrl || venue.mapUrl;
    
    if (!mapUrl) { setBgImage(null); return; }

    let objectUrl = "";
    const fetchImage = async () => {
      try {
        const response = await fetch(mapUrl);
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        const img = new window.Image();
        img.src = objectUrl;
        img.onload = () => setBgImage(img);
      } catch (error) { console.error(error); }
    };
    fetchImage();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [currentFloor, venue]);

  // 3. PINCH-TO-ZOOM GESTURES
  const handleTouchMove = (e: any) => {
    e.evt.preventDefault(); // CRITICAL: Stops browser from scrolling the page
    const touch1 = e.evt.touches[0];
    const touch2 = e.evt.touches[1];

    if (touch1 && touch2) {
      const stage = stageRef.current;
      if (!stage) return;
      if (stage.isDragging()) stage.stopDrag();

      const p1 = { x: touch1.clientX, y: touch1.clientY };
      const p2 = { x: touch2.clientX, y: touch2.clientY };
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      if (!lastDist) { setLastDist(dist); return; }

      const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const scaleBy = dist / lastDist;
      const oldScale = stage.scaleX();
      
      let newScale = oldScale * scaleBy;
      newScale = Math.max(0.2, Math.min(newScale, 5)); // Limit zoom

      const pointTo = {
        x: (center.x - stage.x()) / oldScale,
        y: (center.y - stage.y()) / oldScale,
      };

      const newPos = {
        x: center.x - pointTo.x * newScale,
        y: center.y - pointTo.y * newScale,
      };

      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);
      setLastDist(dist);
    }
  };

  const handleTouchEnd = () => { setLastDist(0); };

  const activePath = useMemo(() => {
    if (!venue || !startNode || !destNode) return [];
    return findShortestPath(venue.nodes || [], venue.edges || [], startNode, destNode);
  }, [venue, startNode, destNode]);

  const getFloorName = (fId: string) => {
    if (!venue?.floors) return fId;
    const floorObj = venue.floors.find((f: any) => f.id === fId);
    return floorObj?.name || floorObj?.label || fId;
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div>;
  if (!venue) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Venue not found.</div>;

  const visibleNodes = (venue.nodes || []).filter((n: any) => (n.floorId || "1") === currentFloor);
  const activePathPoints = activePath
    .filter(id => venue.nodes.find((n: any) => n.id === id)?.floorId === currentFloor)
    .flatMap(id => {
      const node = venue.nodes.find((n: any) => n.id === id);
      return [node.x, node.y];
    });

  return (
    // "touch-action: none" is the magic CSS that allows canvas pinch-to-zoom to actually work!
    <div className="fixed inset-0 bg-slate-950 overflow-hidden font-sans" style={{ touchAction: 'none' }}>
      
      {/* MAP CANVAS */}
      <div className="absolute inset-0 z-0">
        <Stage 
          width={window.innerWidth} 
          height={window.innerHeight} 
          draggable 
          ref={stageRef}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* LAYER 1: STRICTLY BACKGROUND IMAGE (Always on bottom) */}
          <Layer>
            {bgImage && <KonvaImage image={bgImage} x={0} y={0} opacity={0.7} />}
          </Layer>

          {/* LAYER 2: STRICTLY PATHS AND NODES (Always on top of image) */}
          <Layer>
            {/* Path */}
            {activePathPoints.length > 0 && (
              <Line points={activePathPoints} stroke="#10b981" strokeWidth={8} lineCap="round" lineJoin="round" />
            )}

            {/* Nodes - RUTHLESS FILTERING */}
            {visibleNodes.map((node: any) => {
              const isStart = node.id === startNode;
              const isDest = node.id === destNode;

              // If it's not the start, and not the destination... DELETE IT. Zero clutter.
              if (!isStart && !isDest) return null; 

              return (
                <React.Fragment key={node.id}>
                  <Circle
                    x={node.x} y={node.y}
                    radius={isStart ? 12 : 14}
                    fill={isStart ? "#3b82f6" : "#ef4444"}
                    stroke="#ffffff" strokeWidth={3}
                  />
                  {node.label && (
                    <KonvaText 
                      x={node.x + 20} y={node.y - 10} 
                      text={node.label} fill="#ffffff" fontSize={20} fontStyle="bold" 
                    />
                  )}
                </React.Fragment>
              );
            })}
          </Layer>
        </Stage>
      </div>

      {/* TOP GUEST INFO CARD (Pushed down with top-12 to clear Phone Notch) */}
      <div className="absolute top-12 left-4 right-4 z-10 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 p-4 rounded-2xl shadow-xl">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" /> {guestName}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-sm font-medium text-slate-300">
            {guestRole && <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4" /> {guestRole}</span>}
            {guestCompany && <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" /> {guestCompany}</span>}
            {guestTable && <span className="flex items-center gap-1.5 text-emerald-400"><MapPin className="w-4 h-4" /> Table {guestTable}</span>}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE FLOORS (Sleek Circular Buttons) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-3 pointer-events-auto">
        {floors.length > 1 && floors.map(f => (
          <button 
            key={f} onClick={() => setCurrentFloor(f)}
            className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-sm shadow-xl transition-all border ${
              currentFloor === f 
              ? "bg-emerald-500 text-white border-emerald-400 scale-110" 
              : "bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            {getFloorName(f)}
          </button>
        ))}
      </div>

      {/* BOTTOM NAVIGATION CONTROLS */}
      <div className="absolute bottom-8 left-4 right-4 z-10 flex flex-col gap-3 pointer-events-auto">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-2 rounded-3xl shadow-2xl flex flex-col gap-2">
          
          <button onClick={() => setShowStartSelector(true)} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-4 rounded-2xl font-semibold flex items-center justify-between px-5 transition">
            <span className="flex items-center gap-2 text-slate-400"><Navigation className="w-5 h-5 text-blue-400" /> Start</span>
            <span className="text-white truncate max-w-[200px]">{startNode ? venue.nodes.find((n:any)=>n.id === startNode)?.label || 'Selected' : "Tap to set start"}</span>
          </button>

          <button onClick={() => setShowDestSelector(true)} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-2xl font-bold flex items-center justify-between px-5 transition shadow-lg shadow-emerald-500/20 text-lg">
            <span className="flex items-center gap-2"><MapPin className="w-6 h-6" /> Dest</span>
            <span className="truncate max-w-[180px]">{destNode ? venue.nodes.find((n:any)=>n.id === destNode)?.label || 'Selected' : "Tap to route"}</span>
          </button>

        </div>
      </div>

      {/* FULL SCREEN SELECTOR MODALS */}
      {(showDestSelector || showStartSelector) && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-slate-950/80 backdrop-blur-md pointer-events-auto transition-all">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-[2rem] p-6 w-full h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-6 px-2">
              <h2 className="text-2xl font-bold text-white">
                {showStartSelector ? "Select Start" : "Select Destination"}
              </h2>
              <button onClick={() => { setShowDestSelector(false); setShowStartSelector(false); }} className="p-3 bg-slate-800 rounded-full text-slate-400 hover:text-white transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 flex flex-col gap-3 pb-8">
              {venue.nodes.filter((n: any) => n.label).map((node: any) => (
                <button
                  key={node.id}
                  onClick={() => {
                    if (showStartSelector) { setStartNode(node.id); setShowStartSelector(false); setCurrentFloor(node.floorId || "1"); } 
                    else { setDestNode(node.id); setCurrentFloor(node.floorId || "1"); setShowDestSelector(false); }
                  }}
                  className="w-full text-left p-5 bg-slate-800/50 hover:bg-slate-700 border border-slate-700/50 rounded-2xl text-white font-semibold flex justify-between items-center transition"
                >
                  <span className="text-lg">{node.label}</span>
                  <span className="text-xs font-bold text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg">
                    {getFloorName(node.floorId || "1")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuestMap() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div>}>
      <GuestMapContent />
    </Suspense>
  );
}