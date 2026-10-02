"use client";

import React, { useState, useEffect, useMemo, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";
import type Konva from "konva";
import { Stage, Layer, Circle, Line, Rect, Group, RegularPolygon, Text as KonvaText, Image as KonvaImage } from "react-konva";
import { Loader2, User, Briefcase, MapPin, X, Navigation, Building2, ChevronDown } from "lucide-react";

// ---------- helpers ----------
const floorOf = (n: any) => String(n?.floorId || "1");

// Firestore field names we accept for a map image
const URL_KEYS = ["imageUrl", "mapUrl", "image", "url", "floorPlan", "floorplanUrl", "backgroundImage", "bgImage"];
const pickUrl = (o: any): string => {
  if (!o) return "";
  for (const k of URL_KEYS) if (typeof o[k] === "string" && o[k]) return o[k];
  return "";
};

const measure = (text: string, font: string) => {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * 10;
  ctx.font = font;
  return ctx.measureText(text).width;
};

// --- DIJKSTRA ALGORITHM ---
const findShortestPath = (nodes: any[], edges: any[], startId: string, endId: string): string[] => {
  const graph: Record<string, Record<string, number>> = {};
  nodes.forEach(n => (graph[n.id] = {}));
  edges.forEach(e => {
    const n1 = nodes.find(n => n.id === e.from);
    const n2 = nodes.find(n => n.id === e.to);
    if (n1 && n2) {
      const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
      graph[e.from][e.to] = dist;
      graph[e.to][e.from] = dist;
    }
  });

  const distances: Record<string, number> = {};
  const previous: Record<string, string> = {};
  const queue = new Set<string>();
  nodes.forEach(n => { distances[n.id] = Infinity; queue.add(n.id); });
  distances[startId] = 0;

  while (queue.size > 0) {
    let closest: string | null = null;
    queue.forEach(id => { if (closest === null || distances[id] < distances[closest]) closest = id; });
    if (closest === null || closest === endId || distances[closest] === Infinity) break;
    queue.delete(closest);
    for (const nb in graph[closest]) {
      const alt = distances[closest] + graph[closest][nb];
      if (alt < distances[nb]) { distances[nb] = alt; previous[nb] = closest; }
    }
  }

  const path: string[] = [];
  let current: string | undefined = endId;
  while (current) { path.unshift(current); current = previous[current]; }
  return path[0] === startId ? path : [];
};

// ---------- animated route: arrows flowing along the path ----------
const ARROW_GAP = 70;   // map px between arrows
const ARROW_SPEED = 110; // map px per second

function AnimatedRoute({ points }: { points: number[] }) {
  const arrowsRef = useRef<Konva.Group>(null);

  const geo = useMemo(() => {
    const segs: { x: number; y: number; len: number; angle: number; start: number }[] = [];
    let total = 0;
    for (let i = 0; i + 3 < points.length; i += 2) {
      const dx = points[i + 2] - points[i];
      const dy = points[i + 3] - points[i + 1];
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;
      segs.push({ x: points[i], y: points[i + 1], len, angle: Math.atan2(dy, dx), start: total });
      total += len;
    }
    return { segs, total };
  }, [points]);

  const count = Math.max(1, Math.round(geo.total / ARROW_GAP));

  useEffect(() => {
    const group = arrowsRef.current;
    if (!group || geo.total === 0) return;
    let raf = 0;
    const t0 = performance.now();

    const tick = (now: number) => {
      const shift = ((now - t0) / 1000) * ARROW_SPEED;
      group.getChildren().forEach((arrow, i) => {
        const d = (shift + (i * geo.total) / count) % geo.total;
        let seg = geo.segs[geo.segs.length - 1];
        for (const s of geo.segs) {
          if (d >= s.start && d < s.start + s.len) { seg = s; break; }
        }
        const k = d - seg.start;
        arrow.position({ x: seg.x + Math.cos(seg.angle) * k, y: seg.y + Math.sin(seg.angle) * k });
        arrow.rotation((seg.angle * 180) / Math.PI + 90); // triangle apex points "up" at 0deg
      });
      group.getLayer()?.batchDraw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [geo, count]);

  return (
    <>
      <Line points={points} stroke="#065f46" strokeWidth={13} lineCap="round" lineJoin="round" opacity={0.85} listening={false} />
      <Line points={points} stroke="#10b981" strokeWidth={8} lineCap="round" lineJoin="round" listening={false} />
      <Group ref={arrowsRef} listening={false}>
        {Array.from({ length: count }, (_, i) => (
          <RegularPolygon key={i} sides={3} radius={10} fill="#ffffff" stroke="#047857" strokeWidth={1.5} scaleX={0.85} scaleY={1.25} />
        ))}
      </Group>
    </>
  );
}

// ---------- guest name + position tag shown on the VIP place ----------
function GuestTag({ x, y, name, role }: { x: number; y: number; name: string; role: string }) {
  const { w, h } = useMemo(() => {
    const nameW = name ? measure(name, "bold 20px sans-serif") : 0;
    const roleW = role ? measure(role, "15px sans-serif") : 0;
    return { w: Math.min(Math.max(nameW, roleW) + 28, 300), h: name && role ? 58 : 38 };
  }, [name, role]);

  const left = x - w / 2;
  const top = y - h - 24;

  return (
    <Group listening={false}>
      <Rect x={left} y={top} width={w} height={h} cornerRadius={10} fill="#0f172a" stroke="#f59e0b" strokeWidth={2.5} shadowColor="#000" shadowBlur={10} shadowOpacity={0.5} />
      <Line points={[x - 9, top + h, x + 9, top + h, x, top + h + 10]} closed fill="#f59e0b" />
      {name && <KonvaText x={left + 14} y={top + 9} width={w - 28} wrap="none" ellipsis text={name} fill="#ffffff" fontSize={20} fontStyle="bold" />}
      {role && <KonvaText x={left + 14} y={top + (name ? 33 : 11)} width={w - 28} wrap="none" ellipsis text={role} fill="#fbbf24" fontSize={15} />}
    </Group>
  );
}

function GuestMapContent() {
  const searchParams = useSearchParams();
  const venueId = searchParams.get("venueId");

  const guestName = searchParams.get("name") || "";
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
  const [showFloorDropdown, setShowFloorDropdown] = useState(false);

  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [mapError, setMapError] = useState("");
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const stageRef = useRef<Konva.Stage>(null);
  const lastDist = useRef(0);

  // Stage size (no window access during render)
  useEffect(() => {
    const update = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 1. FETCH VENUE
  useEffect(() => {
    if (!venueId) { setLoading(false); return; }
    const fetchVenue = async () => {
      try {
        const docSnap = await getDoc(doc(db, "venues", venueId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setVenue(data);

          const uniqueFloors = Array.from(new Set((data.nodes || []).map((n: any) => floorOf(n)))) as string[];
          const sorted = uniqueFloors.sort();
          setFloors(sorted.length > 0 ? sorted : ["1"]);
          setCurrentFloor(sorted.length > 0 ? sorted[0] : "1");

          const entrance = data.nodes?.find((n: any) => n.label?.toLowerCase().includes("entrance"));
          if (entrance) setStartNode(entrance.id);
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchVenue();
  }, [venueId]);

  // 2. LOAD FLOOR MAP IMAGE
  // Deliberately NO crossOrigin attribute: it makes loading fail when the storage bucket has no CORS rule,
  // and we only display the image (we never export the canvas).
  useEffect(() => {
    if (!venue) return;
    let cancelled = false;
    setBgImage(null);
    setMapError("");

    const floorsArr: any[] = Array.isArray(venue.floors) ? venue.floors : Object.values(venue.floors || {});
    const floorData = floorsArr.find(f => String(f?.id) === currentFloor) ?? (floorsArr.length === 1 ? floorsArr[0] : undefined);
    const raw = pickUrl(floorData) || pickUrl(venue);

    if (!raw) { setMapError("No map image URL found for this floor in Firestore."); return; }

    (async () => {
      try {
        // gs:// links and bare storage paths must be converted to a download URL first
        const url = /^(https?:|data:|blob:|\/)/.test(raw) ? raw : await getDownloadURL(storageRef(getStorage(), raw));
        const img = new window.Image();
        img.onload = () => { if (!cancelled) setBgImage(img); };
        img.onerror = () => { if (!cancelled) setMapError("Floor map failed to load: " + url); };
        img.src = url;
      } catch (e) {
        console.error(e);
        if (!cancelled) setMapError("Could not resolve map image: " + raw);
      }
    })();

    return () => { cancelled = true; };
  }, [currentFloor, venue]);

  // 2b. Fit the map to the screen when an image loads (otherwise large images show only a corner)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !bgImage || !dims.w) return;
    const s = Math.min(dims.w / bgImage.width, dims.h / bgImage.height) * 0.95;
    stage.scale({ x: s, y: s });
    stage.position({ x: (dims.w - bgImage.width * s) / 2, y: (dims.h - bgImage.height * s) / 2 });
    stage.batchDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgImage]);

  // 3. ZOOM: pinch (touch) + wheel (desktop)
  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    const [t1, t2] = [e.evt.touches[0], e.evt.touches[1]];
    const stage = stageRef.current;
    if (!t1 || !t2 || !stage) return;
    if (stage.isDragging()) stage.stopDrag();

    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    if (!lastDist.current) { lastDist.current = dist; return; }

    const center = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    const oldScale = stage.scaleX();
    const newScale = Math.max(0.2, Math.min((oldScale * dist) / lastDist.current, 5));
    const pointTo = { x: (center.x - stage.x()) / oldScale, y: (center.y - stage.y()) / oldScale };

    stage.scale({ x: newScale, y: newScale });
    stage.position({ x: center.x - pointTo.x * newScale, y: center.y - pointTo.y * newScale });
    lastDist.current = dist;
  };
  const handleTouchEnd = () => { lastDist.current = 0; };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const p = stage?.getPointerPosition();
    if (!stage || !p) return;
    const old = stage.scaleX();
    const ns = Math.max(0.2, Math.min(e.evt.deltaY > 0 ? old / 1.1 : old * 1.1, 5));
    const to = { x: (p.x - stage.x()) / old, y: (p.y - stage.y()) / old };
    stage.scale({ x: ns, y: ns });
    stage.position({ x: p.x - to.x * ns, y: p.y - to.y * ns });
  };

  const activePath = useMemo(() => {
    if (!venue || !startNode || !destNode) return [];
    return findShortestPath(venue.nodes || [], venue.edges || [], startNode, destNode);
  }, [venue, startNode, destNode]);

  // Path split into continuous runs on the current floor
  const routeRuns = useMemo(() => {
    const nodes: any[] = venue?.nodes || [];
    const runs: number[][] = [];
    let cur: number[] = [];
    for (const id of activePath) {
      const n = nodes.find(x => x.id === id);
      if (n && floorOf(n) === currentFloor) cur.push(n.x, n.y);
      else if (cur.length) { runs.push(cur); cur = []; }
    }
    if (cur.length) runs.push(cur);
    return runs.filter(r => r.length >= 4);
  }, [activePath, venue, currentFloor]);

  // The VIP place: a node labelled "VIP", else the node matching the guest's table
  const vipNode = useMemo(() => {
    const nodes: any[] = venue?.nodes || [];
    const t = guestTable.trim().toLowerCase();
    const byVip = nodes.find(n => /vip/i.test(n.label || ""));
    if (byVip) return byVip;
    if (!t) return null;
    return nodes.find(n => { const l = String(n.label || "").toLowerCase().trim(); return l === t || l === `table ${t}`; }) || null;
  }, [venue, guestTable]);

  const getFloorName = (fId: string) => {
    const arr: any[] = Array.isArray(venue?.floors) ? venue.floors : Object.values(venue?.floors || {});
    const floorObj = arr.find(f => String(f?.id) === fId);
    return floorObj?.name || floorObj?.label || `Floor ${fId}`;
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div>;
  if (!venue) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">{venueId ? "Venue not found." : "Missing venueId in the link."}</div>;

  const visibleNodes = (venue.nodes || []).filter((n: any) => floorOf(n) === currentFloor);
  const hasGuestInfo = guestName || guestRole || guestCompany || guestTable;
  const noRoute = !!startNode && !!destNode && startNode !== destNode && activePath.length === 0;

  return (
    <div className="fixed inset-0 bg-slate-950 overflow-hidden font-sans" style={{ touchAction: "none" }}>

      {/* MAP CANVAS */}
      <div className="absolute inset-0 z-0">
        {dims.w > 0 && (
          <Stage
            width={dims.w}
            height={dims.h}
            draggable
            ref={stageRef}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            <Layer listening={false}>
              {bgImage && <KonvaImage image={bgImage} x={0} y={0} opacity={0.7} />}
            </Layer>

            <Layer>
              {routeRuns.map((run, i) => <AnimatedRoute key={`${currentFloor}-${i}-${run.length}-${run[0]}-${run[1]}`} points={run} />)}

              {visibleNodes.map((node: any) => {
                const isStart = node.id === startNode;
                const isDest = node.id === destNode;
                const isVip = vipNode?.id === node.id;
                const showGuestTag = isVip && !!(guestName || guestRole);
                if (!isStart && !isDest && !node.label && !isVip) return null;

                return (
                  <React.Fragment key={node.id}>
                    <Circle
                      x={node.x} y={node.y}
                      radius={isStart ? 12 : isDest ? 14 : isVip ? 14 : 7}
                      fill={isStart ? "#3b82f6" : isDest ? "#ef4444" : isVip ? "#f59e0b" : "#64748b"}
                      stroke="#ffffff" strokeWidth={isStart || isDest || isVip ? 3 : 1.5}
                    />
                    {showGuestTag ? (
                      <GuestTag x={node.x} y={node.y} name={guestName} role={guestRole} />
                    ) : (
                      node.label && <KonvaText x={node.x + 15} y={node.y - 8} text={node.label} fill="#ffffff" fontSize={18} fontStyle="bold" />
                    )}
                  </React.Fragment>
                );
              })}
            </Layer>
          </Stage>
        )}
      </div>

      {/* TOP HEADER AREA: GUEST INFO (LEFT) & FLOOR DROPDOWN (RIGHT) */}
      <div className="absolute top-12 left-4 right-4 z-20 flex justify-between items-start pointer-events-none">
        {hasGuestInfo ? (
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-4 rounded-2xl shadow-xl max-w-[65%] pointer-events-auto">
            {guestName && (
              <h1 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                <User className="w-5 h-5 text-emerald-400" /> {guestName}
              </h1>
            )}
            <div className="flex flex-col gap-1.5 text-sm font-medium text-slate-300">
              {guestRole && <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4" /> {guestRole}</span>}
              {guestCompany && <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" /> {guestCompany}</span>}
              {guestTable && <span className="flex items-center gap-1.5 text-emerald-400"><MapPin className="w-4 h-4" /> Table {guestTable}</span>}
            </div>
          </div>
        ) : (
          <div />
        )}

        {floors.length > 1 && (
          <div className="relative pointer-events-auto">
            <button
              onClick={() => setShowFloorDropdown(!showFloorDropdown)}
              className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 text-white font-bold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 transition"
            >
              {getFloorName(currentFloor)} <ChevronDown className="w-4 h-4" />
            </button>

            {showFloorDropdown && (
              <div className="absolute top-full right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl flex flex-col overflow-hidden w-40">
                {floors.map(f => (
                  <button
                    key={f}
                    onClick={() => { setCurrentFloor(f); setShowFloorDropdown(false); }}
                    className={`px-4 py-3 text-sm font-bold text-left transition ${currentFloor === f ? "bg-emerald-500 text-white" : "text-slate-300 hover:bg-slate-800"}`}
                  >
                    {getFloorName(f)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* STATUS MESSAGES */}
      {(mapError || noRoute) && (
        <div className="absolute left-4 right-4 bottom-[200px] z-10 flex flex-col gap-2 pointer-events-none">
          {mapError && <div className="bg-red-950/90 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-xl break-all">{mapError}</div>}
          {noRoute && <div className="bg-amber-950/90 border border-amber-800 text-amber-200 text-sm px-4 py-3 rounded-xl">No connected route between these two places.</div>}
        </div>
      )}

      {/* BOTTOM NAVIGATION CONTROLS */}
      <div className="absolute bottom-8 left-4 right-4 z-10 flex flex-col gap-3 pointer-events-auto">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-2 rounded-3xl shadow-2xl flex flex-col gap-2">
          <button onClick={() => setShowStartSelector(true)} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-4 rounded-2xl font-semibold flex items-center justify-between px-5 transition">
            <span className="flex items-center gap-2 text-slate-400"><Navigation className="w-5 h-5 text-blue-400" /> Start</span>
            <span className="text-white truncate max-w-[200px]">{startNode ? venue.nodes.find((n: any) => n.id === startNode)?.label || "Selected" : "Tap to set start"}</span>
          </button>

          <button onClick={() => setShowDestSelector(true)} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-2xl font-bold flex items-center justify-between px-5 transition shadow-lg shadow-emerald-500/20 text-lg">
            <span className="flex items-center gap-2"><MapPin className="w-6 h-6" /> Dest</span>
            <span className="truncate max-w-[180px]">{destNode ? venue.nodes.find((n: any) => n.id === destNode)?.label || "Selected" : "Tap to route"}</span>
          </button>
        </div>
      </div>

      {/* FULL SCREEN SELECTOR MODALS */}
      {(showDestSelector || showStartSelector) && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-slate-950/80 backdrop-blur-md pointer-events-auto transition-all">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-[2rem] p-6 w-full h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-6 px-2">
              <h2 className="text-2xl font-bold text-white">{showStartSelector ? "Select Start" : "Select Destination"}</h2>
              <button onClick={() => { setShowDestSelector(false); setShowStartSelector(false); }} className="p-3 bg-slate-800 rounded-full text-slate-400 hover:text-white transition">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 flex flex-col gap-3 pb-8">
              {venue.nodes.filter((n: any) => n.label).map((node: any) => (
                <button
                  key={node.id}
                  onClick={() => {
                    if (showStartSelector) { setStartNode(node.id); setShowStartSelector(false); setCurrentFloor(floorOf(node)); }
                    else { setDestNode(node.id); setCurrentFloor(floorOf(node)); setShowDestSelector(false); }
                  }}
                  className="w-full text-left p-5 bg-slate-800/50 hover:bg-slate-700 border border-slate-700/50 rounded-2xl text-white font-semibold flex justify-between items-center transition"
                >
                  <span className="text-lg">{node.label}</span>
                  <span className="text-xs font-bold text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg">{getFloorName(floorOf(node))}</span>
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
