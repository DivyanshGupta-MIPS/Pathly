"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Stage, Layer, Circle, Line, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import { Loader2, Navigation, MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";

// --- GRAPH & GEOMETRY ENGINE ---
const getDistance = (p1: any, p2: any) => Math.hypot(p2.x - p1.x, p2.y - p1.y);

const doIntersect = (p1: any, q1: any, p2: any, q2: any) => {
  const orientation = (p: any, q: any, r: any) => {
    let val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (val === 0) return 0;
    return (val > 0) ? 1 : 2;
  }
  const onSegment = (p: any, q: any, r: any) => q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
  let o1 = orientation(p1, q1, p2); let o2 = orientation(p1, q1, q2);
  let o3 = orientation(p2, q2, p1); let o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
};

const isLineClear = (p1: any, p2: any, blockades: any[]) => {
  for (let b of blockades) {
    const x = b.width < 0 ? b.x + b.width : b.x;
    const y = b.height < 0 ? b.y + b.height : b.y;
    const w = Math.abs(b.width); const h = Math.abs(b.height);
    const pad = 2; 
    const tl = {x: x - pad, y: y - pad}; const tr = {x: x + w + pad, y: y - pad};
    const bl = {x: x - pad, y: y + h + pad}; const br = {x: x + w + pad, y: y + h + pad};
    if (doIntersect(p1, p2, tl, tr)) return false;
    if (doIntersect(p1, p2, tr, br)) return false;
    if (doIntersect(p1, p2, br, bl)) return false;
    if (doIntersect(p1, p2, bl, tl)) return false;
  }
  return true;
};

const calculateSmartPath = (start: any, end: any, blockades: any[]) => {
  if (isLineClear(start, end, blockades)) return [start.x, start.y, end.x, end.y];
  
  const points = [{x: start.x, y: start.y, id: 'start'}, {x: end.x, y: end.y, id: 'end'}];
  const pad = 15; 
  
  blockades.forEach((b, i) => {
    const x = b.width < 0 ? b.x + b.width : b.x;
    const y = b.height < 0 ? b.y + b.height : b.y;
    const w = Math.abs(b.width); const h = Math.abs(b.height);
    points.push({x: x - pad, y: y - pad, id: `tl_${i}`});
    points.push({x: x + w + pad, y: y - pad, id: `tr_${i}`});
    points.push({x: x - pad, y: y + h + pad, id: `bl_${i}`});
    points.push({x: x + w + pad, y: y + h + pad, id: `br_${i}`});
  });

  const graph: any = {};
  points.forEach(p => graph[p.id] = []);
  
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (isLineClear(points[i], points[j], blockades)) {
        const dist = getDistance(points[i], points[j]);
        graph[points[i].id].push({node: points[j].id, weight: dist});
        graph[points[j].id].push({node: points[i].id, weight: dist});
      }
    }
  }
  
  const dist: any = {}; const prev: any = {}; const unvisited = new Set<string>();
  points.forEach(p => { dist[p.id] = Infinity; unvisited.add(p.id); });
  dist['start'] = 0;
  
  while (unvisited.size > 0) {
    let u: string | null = null;
    for (let id of unvisited) {
      if (u === null || dist[id] < dist[u]) u = id;
    }
    if (!u || dist[u] === Infinity || u === 'end') break;
    unvisited.delete(u);
    for (let neighbor of graph[u]) {
      let alt = dist[u] + neighbor.weight;
      if (alt < dist[neighbor.node]) { dist[neighbor.node] = alt; prev[neighbor.node] = u; }
    }
  }
  
  const pathPoints = [];
  let curr = 'end';
  if (prev[curr] || curr === 'start') {
    while (curr) {
      const pt = points.find(p => p.id === curr);
      if (pt) { pathPoints.unshift(pt.y); pathPoints.unshift(pt.x); }
      curr = prev[curr];
    }
  }
  return pathPoints.length > 0 ? pathPoints : [start.x, start.y, end.x, end.y];
};

const findShortestPath = (startNodeId: string, endNodeId: string, nodes: any[], edges: any[]) => {
  if (startNodeId === endNodeId) return [startNodeId];
  const graph: any = {};
  nodes.forEach(n => graph[n.id] = []);
  
  edges.forEach(e => {
    if (e.isBlocked) return; 
    if (!graph[e.from] || !graph[e.to]) return;
    const n1 = nodes.find(n => n.id === e.from);
    const n2 = nodes.find(n => n.id === e.to);
    const dist = getDistance(n1, n2);
    graph[e.from].push({ node: e.to, weight: dist });
    graph[e.to].push({ node: e.from, weight: dist });
  });

  const dist: any = {}; const prev: any = {}; const unvisited = new Set<string>();
  nodes.forEach(n => { dist[n.id] = Infinity; unvisited.add(n.id); });
  dist[startNodeId] = 0;

  while (unvisited.size > 0) {
    let u: string | null = null;
    for (let id of unvisited) { if (u === null || dist[id] < dist[u]) u = id; }
    if (!u || dist[u] === Infinity || u === endNodeId) break;
    unvisited.delete(u);
    for (let neighbor of graph[u]) {
      let alt = dist[u] + neighbor.weight;
      if (alt < dist[neighbor.node]) { dist[neighbor.node] = alt; prev[neighbor.node] = u; }
    }
  }

  const path = [];
  let curr = endNodeId;
  if (prev[curr] !== undefined || curr === startNodeId) {
    while (curr) { path.unshift(curr); curr = prev[curr]; }
  }
  return path;
};
// --- END ENGINE ---

function NavigateApp() {
  const searchParams = useSearchParams();
  const venueId = searchParams.get("venueId");
  const defaultTargetId = searchParams.get("target");

  const [venueData, setVenueData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [startId, setStartId] = useState<string>(searchParams.get("start") || "");
  const [endId, setEndId] = useState<string>(defaultTargetId || "");
  const [calculatedPathPoints, setCalculatedPathPoints] = useState<number[]>([]);
  
  const [dashOffset, setDashOffset] = useState(0);

  const [windowSize, setWindowSize] = useState({ width: 300, height: 600 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // SMOOTHER ANIMATION: Slower, more fluid march
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    const animate = (time: number) => {
      const delta = time - lastTime;
      setDashOffset((prev) => (prev - (delta * 0.04)) % 60); // Time-based smoothness
      lastTime = time;
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    if (!venueId) return;
    const fetchVenue = async () => {
      try {
        const docSnap = await getDoc(doc(db, "venues", venueId));
        if (docSnap.exists()) setVenueData(docSnap.data());
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };
    fetchVenue();
  }, [venueId]);

  useEffect(() => {
    if (startId && endId && venueData) {
      if (startId === endId) {
        setCalculatedPathPoints([]);
        return;
      }

      let calcNodes = [...(venueData.nodes || [])];
      let calcEdges = [...(venueData.edges || [])];
      
      // We grab blockades here to use for the Line-of-Sight check
      const blockades = venueData.zones?.filter((z: any) => z.type === "blockade") || [];

      const injectZoneAsNode = (id: string, isStart: boolean) => {
        const zone = venueData.zones?.find((z: any) => z.id === id);
        if (zone) {
          const zx = zone.x + (zone.width / 2); const zy = zone.y + (zone.height / 2);
          const tempNodeId = isStart ? 'temp_start' : 'temp_end';
          calcNodes.push({ id: tempNodeId, x: zx, y: zy });
          
          let validNodes = calcNodes.filter(n => n.id !== tempNodeId && !n.id.startsWith('temp_'));

          // THE FIX: Only connect to nodes that have a clear Line-Of-Sight! (No snapping through walls)
          let distances = validNodes
            .filter(n => isLineClear({x: zx, y: zy}, n, blockades))
            .map(n => ({ id: n.id, dist: getDistance({x: zx, y: zy}, n) }))
            .sort((a, b) => a.dist - b.dist);
          
          // Fallback: If the room is completely boxed in by blockades by accident, fallback to standard distance
          if (distances.length === 0) {
            distances = validNodes
              .map(n => ({ id: n.id, dist: getDistance({x: zx, y: zy}, n) }))
              .sort((a, b) => a.dist - b.dist);
          }
          
          for (let i = 0; i < Math.min(3, distances.length); i++) {
            calcEdges.push({ id: `temp_edge_${tempNodeId}_${i}`, from: tempNodeId, to: distances[i].id });
          }
          return tempNodeId;
        }
        return id;
      };

      const finalStartId = injectZoneAsNode(startId, true);
      const finalEndId = injectZoneAsNode(endId, false);
      const pathIds = findShortestPath(finalStartId, finalEndId, calcNodes, calcEdges);
      
      let rawPoints: number[] = [];
      pathIds.forEach(id => {
        const node = calcNodes.find(n => n.id === id);
        if (node) rawPoints.push(node.x, node.y);
      });

      let smartPathPoints: number[] = [];
      if (rawPoints.length > 0) {
        for (let i = 0; i < (rawPoints.length / 2) - 1; i++) {
          const p1 = { x: rawPoints[i * 2], y: rawPoints[i * 2 + 1] };
          const p2 = { x: rawPoints[(i + 1) * 2], y: rawPoints[(i + 1) * 2 + 1] };
          const segment = calculateSmartPath(p1, p2, blockades);
          if (i === 0) smartPathPoints.push(...segment);
          else smartPathPoints.push(...segment.slice(2)); 
        }
      }

      setCalculatedPathPoints(smartPathPoints);
    } else {
      setCalculatedPathPoints([]);
    }
  }, [startId, endId, venueData]);

  const activeFloor = venueData?.floors?.[0]; 
  const [bgImage] = useImage(activeFloor?.image || "");

  if (!venueId) return <div className="p-8 text-white bg-slate-900 min-h-screen">Invalid Route Link.</div>;
  if (isLoading) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" /><p className="text-slate-400">Loading your route...</p></div>;

  const locations = [
    ...(venueData.zones?.filter((z: any) => z.label && z.type !== "blockade").map((z:any) => ({ id: z.id, name: z.label, type: 'zone' })) || []),
    ...(venueData.nodes?.filter((n: any) => n.label && isNaN(Number(n.label))).map((n:any) => ({ id: n.id, name: n.label, type: 'node' })) || [])
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 overflow-hidden relative">
      <div className="absolute inset-0 cursor-grab">
        <Stage width={windowSize.width} height={windowSize.height} scaleX={stageScale} scaleY={stageScale} x={stagePosition.x} y={stagePosition.y} draggable onDragEnd={(e) => setStagePosition({ x: e.target.x(), y: e.target.y() })}>
          <Layer>
            {bgImage && <KonvaImage image={bgImage} opacity={0.6} />}

            {calculatedPathPoints.length > 1 && (
              <Line points={calculatedPathPoints} stroke="#10b981" strokeWidth={8} lineCap="round" lineJoin="round" opacity={0.3} shadowColor="#10b981" shadowBlur={15} />
            )}

            {calculatedPathPoints.length > 1 && (
              <Line 
                points={calculatedPathPoints} stroke="#34d399" strokeWidth={6} lineCap="round" lineJoin="round" 
                dash={[20, 20]} // Thicker, longer dash pattern
                dashOffset={dashOffset} 
              />
            )}

            {calculatedPathPoints.length > 0 && (
              <>
                <Circle x={calculatedPathPoints[0]} y={calculatedPathPoints[1]} radius={8} fill="#3b82f6" stroke="white" strokeWidth={3} shadowColor="#3b82f6" shadowBlur={10} />
                <Circle x={calculatedPathPoints[calculatedPathPoints.length-2]} y={calculatedPathPoints[calculatedPathPoints.length-1]} radius={10} fill="#10b981" stroke="white" strokeWidth={3} shadowColor="#10b981" shadowBlur={10} />
              </>
            )}
          </Layer>
        </Stage>
      </div>

      <div className="absolute bottom-0 left-0 w-full bg-slate-800 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] p-6 border-t border-slate-700">
        <div className="w-12 h-1.5 bg-slate-600 rounded-full mx-auto mb-6"></div>
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2"><Navigation className="w-5 h-5 text-emerald-400" /> Route Finder</h2>
        
        <div className="space-y-4">
          <div className="relative">
            <MapPin className="w-4 h-4 text-blue-400 absolute left-3 top-3.5" />
            <select value={startId} onChange={(e) => setStartId(e.target.value)} className="w-full bg-slate-900 text-white rounded-xl pl-10 pr-4 py-3 text-sm outline-none border border-slate-700 focus:border-blue-500 appearance-none">
              <option value="" disabled>Where are you now?</option>
              {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          </div>
          <div className="relative">
            <MapPin className="w-4 h-4 text-emerald-400 absolute left-3 top-3.5" />
            <select value={endId} onChange={(e) => setEndId(e.target.value)} className="w-full bg-slate-900 text-white rounded-xl pl-10 pr-4 py-3 text-sm outline-none border border-slate-700 focus:border-emerald-500 appearance-none">
              <option value="" disabled>Where do you want to go?</option>
              {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          </div>
        </div>

        {startId === endId && startId !== "" && (
          <p className="text-blue-400 font-medium text-sm mt-4 text-center flex items-center justify-center gap-2 bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
            <CheckCircle2 className="w-4 h-4" /> You are already here!
          </p>
        )}
        {calculatedPathPoints.length === 0 && startId && endId && startId !== endId && (
          <p className="text-red-400 font-medium text-sm mt-4 text-center flex items-center justify-center gap-2 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
            <AlertTriangle className="w-4 h-4" /> Path blocked or unreachable.
          </p>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="bg-slate-900 min-h-screen" />}><NavigateApp /></Suspense>;
}