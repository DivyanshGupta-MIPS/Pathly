"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase"; 
import { doc, getDoc } from "firebase/firestore";
import { Stage, Layer, Circle, Line, Text as KonvaText, Image as KonvaImage } from "react-konva";
import { Loader2, User, Briefcase, MapPin, Layers, X, Navigation, Map as MapIcon } from "lucide-react";

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
  const guestTable = searchParams.get("table") || "";
  
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentFloor, setCurrentFloor] = useState<string>("1");
  const [floors, setFloors] = useState<string[]>(["1"]);
  const [startNode, setStartNode] = useState<string | null>(null);
  const [destNode, setDestNode] = useState<string | null>(null);
  
  const [showDestSelector, setShowDestSelector] = useState(false);
  const [showStartSelector, setShowStartSelector] = useState(false);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!venueId) { setLoading(false); return; }
    const fetchVenue = async () => {
      try {
        const docRef = doc(db, "venues", venueId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setVenue(data);
          
          const uniqueFloors = Array.from(new Set(data.nodes?.map((n: any) => n.floor || "1"))) as string[];
          const sortedFloors = uniqueFloors.sort();
          setFloors(sortedFloors.length > 0 ? sortedFloors : ["1"]);
          setCurrentFloor(sortedFloors.length > 0 ? sortedFloors[0] : "1");
          
          const entrance = data.nodes?.find((n: any) => n.label?.toLowerCase().includes("entrance"));
          if (entrance) setStartNode(entrance.id);

          // Load the background map image (Update 'imageUrl' if your database uses a different field name)
          const mapUrl = data.imageUrl || data.mapUrl;
          if (mapUrl) {
            const img = new window.Image();
            img.src = mapUrl;
            img.onload = () => setBgImage(img);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchVenue();
  }, [venueId]);

  const activePath = useMemo(() => {
    if (!venue || !startNode || !destNode) return [];
    return findShortestPath(venue.nodes || [], venue.edges || [], startNode, destNode);
  }, [venue, startNode, destNode]);

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  if (!venue) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Venue not found.</div>;

  const visibleNodes = (venue.nodes || []).filter((n: any) => (n.floor || "1") === currentFloor);
  const visibleEdges = (venue.edges || []).filter((e: any) => {
    const n1 = venue.nodes.find((n: any) => n.id === e.from);
    const n2 = venue.nodes.find((n: any) => n.id === e.to);
    return (n1?.floor || "1") === currentFloor && (n2?.floor || "1") === currentFloor;
  });

  return (
    <div className="fixed inset-0 bg-slate-950 overflow-hidden flex flex-col">
      {/* Guest ID Card */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shadow-2xl pointer-events-auto">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" /> {guestName}
          </h1>
          <div className="flex gap-4 mt-2 text-xs font-semibold text-slate-300">
            {guestRole && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {guestRole}</span>}
            {guestTable && <span className="flex items-center gap-1 text-emerald-400"><MapPin className="w-3.5 h-3.5" /> Table {guestTable}</span>}
          </div>
        </div>
      </div>

      {/* Interactive Map Area */}
      <div className="flex-1 w-full h-full bg-slate-900">
        <Stage width={window.innerWidth} height={window.innerHeight}>
          <Layer>
            {/* 1. Background Map */}
            {bgImage && <KonvaImage image={bgImage} x={0} y={0} opacity={0.7} />}

            {/* 2. Path Lines (Hiding the clutter!) */}
            {visibleEdges.map((edge: any) => {
              const isPath = activePath.includes(edge.from) && activePath.includes(edge.to) && 
                             Math.abs(activePath.indexOf(edge.from) - activePath.indexOf(edge.to)) === 1;
              
              if (!isPath) return null; // Hides all non-active edges

              const fromNode = venue.nodes.find((n: any) => n.id === edge.from);
              const toNode = venue.nodes.find((n: any) => n.id === edge.to);

              return (
                <Line
                  key={edge.id}
                  points={[fromNode.x, fromNode.y, toNode.x, toNode.y]}
                  stroke="#10b981"
                  strokeWidth={6}
                  shadowColor="#10b981"
                  shadowBlur={15}
                  lineCap="round"
                />
              );
            })}

            {/* 3. Nodes (Only showing Start, Dest, or Labeled places) */}
            {visibleNodes.map((node: any) => {
              const isStart = node.id === startNode;
              const isDest = node.id === destNode;
              const isLabeled = !!node.label;

              if (!isStart && !isDest && !isLabeled) return null; // Hides all invisible routing dots

              return (
                <React.Fragment key={node.id}>
                  <Circle
                    x={node.x}
                    y={node.y}
                    radius={isStart || isDest ? 14 : 8}
                    fill={isStart ? "#3b82f6" : isDest ? "#ef4444" : "#475569"}
                    stroke="#ffffff"
                    strokeWidth={2}
                    shadowColor="rgba(0,0,0,0.5)"
                    shadowBlur={10}
                  />
                  {node.label && (
                    <KonvaText 
                      x={node.x + 18} y={node.y - 8} 
                      text={node.label} fill="white" 
                      fontSize={16} fontStyle="bold" 
                      shadowColor="black" shadowBlur={4}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </Layer>
        </Stage>
      </div>

      {/* Right Side: Floor Switcher */}
      <div className="absolute bottom-36 right-4 z-10 flex flex-col gap-2">
        {floors.length > 0 && (
          <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-xl overflow-hidden shadow-lg flex flex-col">
            <div className="bg-slate-900 p-2 text-[10px] font-bold text-slate-400 text-center border-b border-slate-700">FLOOR</div>
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

      {/* Bottom Controls */}
      <div className="absolute bottom-6 left-4 right-4 z-10 flex flex-col gap-2">
        <button 
          onClick={() => setShowStartSelector(true)}
          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-xl font-semibold shadow-lg border border-slate-700 flex items-center justify-between px-4"
        >
          <span className="flex items-center gap-2"><MapIcon className="w-4 h-4 text-blue-400" /> Start:</span>
          <span>{startNode ? venue.nodes.find((n:any)=>n.id === startNode)?.label || 'Selected' : "Choose Start"}</span>
        </button>

        <button 
          onClick={() => setShowDestSelector(true)}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-between px-4 text-lg"
        >
          <span className="flex items-center gap-2"><Navigation className="w-5 h-5" /> To:</span>
          <span>{destNode ? venue.nodes.find((n:any)=>n.id === destNode)?.label || 'Selected' : "Choose Destination"}</span>
        </button>
      </div>

      {/* Selector Modals (Used for both Start and Destination) */}
      {(showDestSelector || showStartSelector) && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity">
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
                    } else {
                      setDestNode(node.id);
                      setCurrentFloor(node.floor || "1");
                      setShowDestSelector(false);
                    }
                  }}
                  className="w-full text-left p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white font-semibold flex justify-between items-center transition"
                >
                  <span>{node.label}</span>
                  <span className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded">Floor {node.floor || "1"}</span>
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