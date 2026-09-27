"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase"; // Adjust path if your firebase.ts is elsewhere
import { doc, getDoc } from "firebase/firestore";
import { Stage, Layer, Circle, Line, Text as KonvaText } from "react-konva";
import { Loader2, User, Briefcase, MapPin, Layers, X, Navigation } from "lucide-react";

// Basic Dijkstra algorithm for pathfinding
const findShortestPath = (nodes: any[], edges: any[], startId: string, endId: string) => {
  const graph: any = {};
  nodes.forEach(n => graph[n.id] = {});
  edges.forEach(e => {
    const n1 = nodes.find(n => n.id === e.from);
    const n2 = nodes.find(n => n.id === e.to);
    if (n1 && n2) {
      const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
      graph[e.from][e.to] = dist;
      graph[e.to][e.from] = dist; // Assuming bidirectional
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
  const guestTable = searchParams.get("table") || "";
  
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [currentFloor, setCurrentFloor] = useState<string>("1");
  const [floors, setFloors] = useState<string[]>(["1"]);
  
  const [startNode, setStartNode] = useState<string | null>(null);
  const [destNode, setDestNode] = useState<string | null>(null);
  const [showDestSelector, setShowDestSelector] = useState(false);

  useEffect(() => {
    if (!venueId) return;
    const fetchVenue = async () => {
      const docRef = doc(db, "venues", venueId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setVenue(data);
        
        // Extract unique floors from nodes, default to "1" if none exist
        const uniqueFloors = Array.from(new Set(data.nodes?.map((n: any) => n.floor || "1"))) as string[];
        const sortedFloors = uniqueFloors.sort();
        setFloors(sortedFloors.length > 0 ? sortedFloors : ["1"]);
        setCurrentFloor(sortedFloors.length > 0 ? sortedFloors[0] : "1");
        
        // Auto-set start point if there's an Entrance
        const entrance = data.nodes?.find((n: any) => n.label?.toLowerCase().includes("entrance"));
        if (entrance) setStartNode(entrance.id);
      }
      setLoading(false);
    };
    fetchVenue();
  }, [venueId]);
  

  const activePath = useMemo(() => {
    if (!venue || !startNode || !destNode) return [];
    return findShortestPath(venue.nodes || [], venue.edges || [], startNode, destNode);
  }, [venue, startNode, destNode]);

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }
  if (!venue) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Venue not found.</div>;
  }

  // Filter rendering elements to ONLY show the current floor
  const visibleNodes = (venue.nodes || []).filter((n: any) => (n.floor || "1") === currentFloor);
  const visibleEdges = (venue.edges || []).filter((e: any) => {
    const n1 = venue.nodes.find((n: any) => n.id === e.from);
    const n2 = venue.nodes.find((n: any) => n.id === e.to);
    return (n1?.floor || "1") === currentFloor && (n2?.floor || "1") === currentFloor;
  });

  return (
    <div className="fixed inset-0 bg-slate-950 overflow-hidden flex flex-col">
      
      {/* GUEST INFO HEADER - Glassmorphism */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shadow-2xl pointer-events-auto">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" /> {guestName}
          </h1>
          <div className="flex gap-4 mt-2 text-xs font-semibold text-slate-300">
            {guestRole && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {guestRole}</span>}
            {guestTable && <span className="flex items-center gap-1 text-emerald-400"><MapPin className="w-3.5 h-3.5" /> Table {guestTable}</span>}
          </div>
        </div>
      </div>

      {/* THE MAP CANVAS */}
      <div className="flex-1 w-full h-full bg-slate-950">
        <Stage width={window.innerWidth} height={window.innerHeight}>
          <Layer>
            {/* Draw Edges */}
            {visibleEdges.map((edge: any) => {
              const fromNode = venue.nodes.find((n: any) => n.id === edge.from);
              const toNode = venue.nodes.find((n: any) => n.id === edge.to);
              
              // Check if this edge is part of the glowing active path
              const isPath = activePath.includes(edge.from) && activePath.includes(edge.to) && 
                             Math.abs(activePath.indexOf(edge.from) - activePath.indexOf(edge.to)) === 1;

              return (
                <Line
                  key={edge.id}
                  points={[fromNode.x, fromNode.y, toNode.x, toNode.y]}
                  stroke={isPath ? "#10b981" : "#334155"}
                  strokeWidth={isPath ? 6 : 2}
                  shadowColor={isPath ? "#10b981" : "transparent"}
                  shadowBlur={isPath ? 15 : 0}
                  lineCap="round"
                />
              );
            })}

            {/* Draw Nodes */}
            {visibleNodes.map((node: any) => {
              const isStart = node.id === startNode;
              const isDest = node.id === destNode;
              const inPath = activePath.includes(node.id);

              return (
                <React.Fragment key={node.id}>
                  <Circle
                    x={node.x}
                    y={node.y}
                    radius={isStart || isDest ? 12 : 6}
                    fill={isStart ? "#3b82f6" : isDest ? "#ef4444" : inPath ? "#10b981" : "#64748b"}
                    shadowColor={inPath ? "#10b981" : "transparent"}
                    shadowBlur={inPath ? 10 : 0}
                  />
                  {node.label && (
                    <KonvaText
                      x={node.x + 15}
                      y={node.y - 6}
                      text={node.label}
                      fill="white"
                      fontSize={14}
                      fontStyle="bold"
                    />
                  )}
                </React.Fragment>
              );
            })}
          </Layer>
        </Stage>
      </div>

      {/* FLOATING CONTROLS (Bottom Right) */}
      <div className="absolute bottom-24 right-4 z-10 flex flex-col gap-3">
        {floors.length > 1 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg flex flex-col">
            <div className="bg-slate-900 p-2 text-xs font-bold text-slate-400 text-center border-b border-slate-700">FLOOR</div>
            {floors.map(f => (
              <button 
                key={f} onClick={() => setCurrentFloor(f)}
                className={`p-3 font-bold transition ${currentFloor === f ? "bg-emerald-500 text-white" : "text-slate-300 hover:bg-slate-700"}`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <button 
          onClick={() => setShowDestSelector(true)}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-lg"
        >
          <Navigation className="w-5 h-5" /> 
          {destNode ? `Routing to: ${venue.nodes.find((n:any)=>n.id === destNode)?.label || 'Destination'}` : "Choose Destination"}
        </button>
      </div>

      {/* BOTTOM SHEET: DESTINATION SELECTOR */}
      {showDestSelector && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-slate-900 border-t border-slate-700 rounded-t-3xl p-6 w-full max-h-[70vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Where are you going?</h2>
              <button onClick={() => setShowDestSelector(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="overflow-y-auto flex-1 flex flex-col gap-2 pb-8">
              {venue.nodes.filter((n: any) => n.label).map((node: any) => (
                <button
                  key={node.id}
                  onClick={() => {
                    setDestNode(node.id);
                    setCurrentFloor(node.floor || "1"); // Auto-switch to destination floor
                    setShowDestSelector(false);
                  }}
                  className="w-full text-left p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white font-semibold flex justify-between items-center transition"
                >
                  <span>{node.label}</span>
                  <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">Floor {node.floor || "1"}</span>
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
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-emerald-400 font-semibold">
          Loading navigation...
        </div>
      }
    >
      <GuestMapContent />
    </Suspense>
  );
}