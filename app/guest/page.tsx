"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase"; 
import { doc, getDoc } from "firebase/firestore";
import { Stage, Layer, Circle, Line, Text as KonvaText, Image as KonvaImage } from "react-konva";
import { Loader2, User, Briefcase, MapPin, X, Navigation, Map as MapIcon, ZoomIn, ZoomOut, Building2 } from "lucide-react";

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

  nodes.forEach(n => {
    distances[n.id] = Infinity;
    queue.add(n.id);
  });
  distances[startId] = 0;

  while (queue.size > 0) {
    let closestNode = null;
    for (const nodeId of queue) {
      if (closestNode === null || distances[nodeId] < distances[closestNode]) {
        closestNode = nodeId;
      }
    }
    if (closestNode === null || closestNode === endId) break;
    queue.delete(closestNode);

    for (const neighbor in graph[closestNode]) {
      const alt = distances[closestNode] + graph[closestNode][neighbor];
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        previous[neighbor] = closestNode;
      }
    }
  }

  const path = [];
  let current = endId;
  while (current) {
    path.unshift(current);
    current = previous[current];
  }
  return path[0] === startId ? path : [];
};

function GuestMapContent() {
  const searchParams = useSearchParams();
  const venueId = searchParams.get("venueId");
  const guestName = searchParams.get("name") || "VIP Guest";
  const guestRole = searchParams.get("role") || "";
  const guestCompany = searchParams.get("company") || ""; // Added Company!
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
  const [scale, setScale] = useState(1);

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
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchVenue();
  }, [venueId]);

  useEffect(() => {
    if (!venue) return;
    const floorData = venue.floors?.find((f: any) => f.id === currentFloor);
    const mapUrl = floorData?.imageUrl || floorData?.mapUrl || venue.imageUrl || venue.mapUrl;
    
    if (!mapUrl) {
      setBgImage(null);
      return;
    }

    let objectUrl = "";

    const fetchImageAsBlob = async () => {
      try {
        // Fetch the image data directly
        const response = await fetch(mapUrl);
        const blob = await response.blob();
        
        // Create a secure local URL that the canvas won't block
        objectUrl = URL.createObjectURL(blob);
        
        const img = new window.Image();
        img.src = objectUrl;
        img.onload = () => setBgImage(img);
      } catch (error) {
        console.error("Failed to load map image safely:", error);
      }
    };

    fetchImageAsBlob();

    // Cleanup memory when the floor changes
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [currentFloor, venue]);

  const activePath = useMemo(() => {
    if (!venue || !startNode || !destNode) return [];
    return findShortestPath(venue.nodes || [], venue.edges || [], startNode, destNode);
  }, [venue, startNode, destNode]);

  // Helper function to turn ugly floorIds into pretty readable names
  const getFloorName = (fId: string) => {
    if (!venue?.floors) return `Floor ${floors.indexOf(fId) + 1}`;
    const floorObj = venue.floors.find((f: any) => f.id === fId);
    return floorObj?.name || floorObj?.label || `Floor ${floors.indexOf(fId) + 1}`;
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  if (!venue) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Venue not found.</div>;

  const visibleNodes = (venue.nodes || []).filter((n: any) => (n.floorId || "1") === currentFloor);
  
  const activePathPoints = activePath
    .filter(id => venue.nodes.find((n: any) => n.id === id)?.floorId === currentFloor)
    .flatMap(id => {
      const node = venue.nodes.find((n: any) => n.id === id);
      return [node.x, node.y];
    });

  return (
    <div className="fixed inset-0 bg-slate-950 overflow-hidden flex flex-col">
      
      {/* GUEST ID CARD (Updated with Company) */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shadow-2xl pointer-events-auto">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" /> {guestName}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-xs font-semibold text-slate-300">
            {guestRole && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {guestRole}</span>}
            {guestCompany && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {guestCompany}</span>}
            {guestTable && <span className="flex items-center gap-1 text-emerald-400"><MapPin className="w-3.5 h-3.5" /> Table {guestTable}</span>}
          </div>
        </div>
      </div>

      <div className="absolute top-36 right-4 z-10 flex flex-col gap-2 pointer-events-auto">
        <button onClick={() => setScale(s => s * 1.2)} className="bg-slate-800 p-3 rounded-full text-white shadow-lg border border-slate-700">
          <ZoomIn className="w-5 h-5" />
        </button>
        <button onClick={() => setScale(s => Math.max(0.2, s / 1.2))} className="bg-slate-800 p-3 rounded-full text-white shadow-lg border border-slate-700">
          <ZoomOut className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 w-full h-full bg-slate-900 cursor-grab active:cursor-grabbing">
        <Stage width={window.innerWidth} height={window.innerHeight} draggable scaleX={scale} scaleY={scale}>
          <Layer>
            {bgImage && <KonvaImage image={bgImage} x={0} y={0} opacity={0.6} />}

            {activePathPoints.length > 0 && (
              <Line points={activePathPoints} stroke="#10b981" strokeWidth={8} lineCap="round" lineJoin="round" shadowColor="#10b981" shadowBlur={15} />
            )}

            {/* 3. Clean Nodes: ONLY labels, start, and dest. Clutter is GONE! */}
            {visibleNodes.map((node: any) => {
              const isStart = node.id === startNode;
              const isDest = node.id === destNode;
              const isLabeledZone = !!node.label;

              // IF IT'S JUST A ROUTING DOT, DO NOT RENDER IT AT ALL
              if (!isStart && !isDest && !isLabeledZone) return null; 

              return (
                <React.Fragment key={node.id}>
                  <Circle
                    x={node.x} y={node.y}
                    // Start/Dest get big markers, labeled zones get small markers
                    radius={isStart || isDest ? 14 : 6}
                    fill={isStart ? "#3b82f6" : isDest ? "#ef4444" : "#64748b"}
                    stroke="#ffffff" strokeWidth={isStart || isDest ? 3 : 1.5}
                    shadowColor="rgba(0,0,0,0.4)" shadowBlur={isStart || isDest ? 10 : 4}
                  />
                  {/* Only render text if the node actually has a label */}
                  {node.label && (
                    <KonvaText 
                      x={node.x + 16} y={node.y - 8} 
                      text={node.label} 
                      fill="#ffffff" 
                      fontSize={16} 
                      fontStyle="bold" 
                      shadowColor="#000000" 
                      shadowBlur={6}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </Layer>
        </Stage>
      </div>

      {/* FLOOR SWITCHER (Now using readable names) */}
      <div className="absolute bottom-40 right-4 z-10 flex flex-col gap-2 pointer-events-auto">
        {floors.length > 1 && (
          <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-xl overflow-hidden shadow-lg flex flex-col">
            <div className="bg-slate-900 p-2 text-[10px] font-bold text-slate-400 text-center border-b border-slate-700">FLOOR</div>
            {floors.map(f => (
              <button 
                key={f} onClick={() => setCurrentFloor(f)}
                className={`p-4 font-bold transition whitespace-nowrap ${currentFloor === f ? "bg-emerald-500 text-white" : "text-slate-300 hover:bg-slate-700"}`}
              >
                {getFloorName(f)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="absolute bottom-6 left-4 right-4 z-10 flex flex-col gap-2 pointer-events-auto">
        <button onClick={() => setShowStartSelector(true)} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-xl font-semibold shadow-lg border border-slate-700 flex items-center justify-between px-4">
          <span className="flex items-center gap-2"><MapIcon className="w-4 h-4 text-blue-400" /> Start:</span>
          <span>{startNode ? venue.nodes.find((n:any)=>n.id === startNode)?.label || 'Selected' : "Choose Start"}</span>
        </button>

        <button onClick={() => setShowDestSelector(true)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-between px-4 text-lg">
          <span className="flex items-center gap-2"><Navigation className="w-5 h-5" /> To:</span>
          <span>{destNode ? venue.nodes.find((n:any)=>n.id === destNode)?.label || 'Selected' : "Choose Destination"}</span>
        </button>
      </div>

      {(showDestSelector || showStartSelector) && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity pointer-events-auto">
          <div className="bg-slate-900 border-t border-slate-700 rounded-t-3xl p-6 w-full max-h-[70vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">
                {showStartSelector ? "Where are you starting?" : "Where do you want to go?"}
              </h2>
              <button onClick={() => { setShowDestSelector(false); setShowStartSelector(false); }} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 flex flex-col gap-2 pb-8">
              {venue.nodes.filter((n: any) => n.label).map((node: any) => (
                <button
                  key={node.id}
                  onClick={() => {
                    if (showStartSelector) {
                      setStartNode(node.id);
                      setShowStartSelector(false);
                      setCurrentFloor(node.floorId || "1");
                    } else {
                      setDestNode(node.id);
                      setCurrentFloor(node.floorId || "1");
                      setShowDestSelector(false);
                    }
                  }}
                  className="w-full text-left p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white font-semibold flex justify-between items-center transition"
                >
                  <span>{node.label}</span>
                  <span className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded">
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
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>}>
      <GuestMapContent />
    </Suspense>
  );
}