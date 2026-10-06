"use client";

import React, { useState, useEffect, useMemo, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";
import type Konva from "konva";
import { Stage, Layer, Circle, Line, Rect, Group, RegularPolygon, Text as KonvaText, Image as KonvaImage } from "react-konva";
import { Loader2, User, Briefcase, MapPin, X, Navigation, Building2, ChevronDown, Compass, Sparkles } from "lucide-react";

// ---------- Helpers ----------
const floorOf = (n: any) => String(n?.floorId || "1");

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

// --- Dijkstra Algorithm ---
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

// --- Animated Flowing Route ---
const ARROW_GAP = 65;
const ARROW_SPEED = 120;

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
        arrow.rotation((seg.angle * 180) / Math.PI + 90);
      });
      group.getLayer()?.batchDraw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [geo, count]);

  return (
    <>
      <Line points={points} stroke="#052e16" strokeWidth={14} lineCap="round" lineJoin="round" opacity={0.6} listening={false} />
      <Line points={points} stroke="#10b981" strokeWidth={8} lineCap="round" lineJoin="round" listening={false} />
      <Group ref={arrowsRef} listening={false}>
        {Array.from({ length: count }, (_, i) => (
          <RegularPolygon key={i} sides={3} radius={9} fill="#ffffff" stroke="#047857" strokeWidth={1} scaleX={0.8} scaleY={1.3} />
        ))}
      </Group>
    </>
  );
}

// --- Dynamic VIP Tag ---
function GuestTag({ x, y, name, role }: { x: number; y: number; name: string; role: string }) {
  const { w, h } = useMemo(() => {
    const nameW = name ? measure(name, "bold 18px sans-serif") : 0;
    const roleW = role ? measure(role, "13px sans-serif") : 0;
    return { w: Math.min(Math.max(nameW, roleW) + 32, 280), h: name && role ? 54 : 36 };
  }, [name, role]);

  const left = x - w / 2;
  const top = y - h - 22;

  return (
    <Group listening={false}>
      <Rect x={left} y={top} width={w} height={h} cornerRadius={12} fill="#09090b" stroke="#10b981" strokeWidth={2} shadowColor="#000" shadowBlur={12} shadowOpacity={0.6} />
      <Line points={[x - 7, top + h, x + 7, top + h, x, top + h + 8]} closed fill="#10b981" />
      {name && <KonvaText x={left + 16} y={top + 8} width={w - 32} wrap="none" ellipsis text={name} fill="#ffffff" fontSize={16} fontStyle="bold" />}
      {role && <KonvaText x={left + 16} y={top + (name ? 30 : 10)} width={w - 32} wrap="none" ellipsis text={role} fill="#a1a1aa" fontSize={13} />}
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

  // Auto-routing parameters passed from QR pass
  const urlStartNode = searchParams.get("start");
  const urlDestNode = searchParams.get("dest") || searchParams.get("target");

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

  useEffect(() => {
    const update = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 1. Fetch Venue & Configure Auto-Route
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

          // Start node resolution
          if (urlStartNode && data.nodes?.some((n: any) => n.id === urlStartNode)) {
            setStartNode(urlStartNode);
          } else {
            const entrance = data.nodes?.find((n: any) => n.label?.toLowerCase().includes("entrance"));
            if (entrance) setStartNode(entrance.id);
          }

          // Destination node resolution
          if (urlDestNode && data.nodes?.some((n: any) => n.id === urlDestNode)) {
            setDestNode(urlDestNode);
            const destFloor = data.nodes?.find((n: any) => n.id === urlDestNode)?.floorId;
            if (destFloor) setCurrentFloor(destFloor);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchVenue();
  }, [venueId, urlStartNode, urlDestNode]);

  // 2. Fetch Floor Image
  useEffect(() => {
    if (!venue) return;
    let cancelled = false;
    setBgImage(null);
    setMapError("");

    const floorsArr: any[] = Array.isArray(venue.floors) ? venue.floors : Object.values(venue.floors || {});
    const floorData = floorsArr.find(f => String(f?.id) === currentFloor) ?? (floorsArr.length === 1 ? floorsArr[0] : undefined);
    const raw = pickUrl(floorData) || pickUrl(venue);

    if (!raw) { setMapError("No map image assigned to this floor."); return; }

    (async () => {
      try {
        const url = /^(https?:|data:|blob:|\/)/.test(raw) ? raw : await getDownloadURL(storageRef(getStorage(), raw));
        const img = new window.Image();
        img.onload = () => { if (!cancelled) setBgImage(img); };
        img.onerror = () => { if (!cancelled) setMapError("Unable to render floor blueprint."); };
        img.src = url;
      } catch (e) {
        console.error(e);
        if (!cancelled) setMapError("Blueprint loading failed.");
      }
    })();

    return () => { cancelled = true; };
  }, [currentFloor, venue]);

  // Fit image on load
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !bgImage || !dims.w) return;
    const s = Math.min(dims.w / bgImage.width, dims.h / bgImage.height) * 0.92;
    stage.scale({ x: s, y: s });
    stage.position({ x: (dims.w - bgImage.width * s) / 2, y: (dims.h - bgImage.height * s) / 2 });
    stage.batchDraw();
  }, [bgImage, dims]);

  // Gestures
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

  const vipNode = useMemo(() => {
    const nodes: any[] = venue?.nodes || [];
    const t = guestTable.trim().toLowerCase();
    const byVip = nodes.find(n => /vip/i.test(n.label || ""));
    if (byVip) return byVip;
    if (!t) return null;
    return nodes.find(n => {
      const l = String(n.label || "").toLowerCase().trim();
      return l === t || l === `table ${t}`;
    }) || null;
  }, [venue, guestTable]);

  const getFloorName = (fId: string) => {
    const arr: any[] = Array.isArray(venue?.floors) ? venue.floors : Object.values(venue?.floors || {});
    const floorObj = arr.find(f => String(f?.id) === fId);
    return floorObj?.name || floorObj?.label || `Level ${fId}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Configuring Wayfinder</span>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-400 font-medium">
        {venueId ? "Venue directory not found." : "Invalid access link."}
      </div>
    );
  }

  const visibleNodes = (venue.nodes || []).filter((n: any) => floorOf(n) === currentFloor);
  const startNodeObj = venue.nodes?.find((n: any) => n.id === startNode);
  const destNodeObj = venue.nodes?.find((n: any) => n.id === destNode);

  return (
    <div className="fixed inset-0 bg-[#09090b] text-white overflow-hidden font-sans select-none" style={{ touchAction: "none" }}>
      
      {/* Canvas Layer */}
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
              {bgImage && <KonvaImage image={bgImage} x={0} y={0} opacity={0.8} />}
            </Layer>

            <Layer>
              {routeRuns.map((run, i) => (
                <AnimatedRoute key={`${currentFloor}-${i}-${run.length}`} points={run} />
              ))}

              {visibleNodes.map((node: any) => {
                const isStart = node.id === startNode;
                const isDest = node.id === destNode;
                const isVip = vipNode?.id === node.id;
                const showGuestTag = isVip && !!(guestName || guestRole);
                if (!isStart && !isDest && !node.label && !isVip) return null;

                return (
                  <React.Fragment key={node.id}>
                    <Circle
                      x={node.x}
                      y={node.y}
                      radius={isStart ? 11 : isDest ? 13 : isVip ? 13 : 6}
                      fill={isStart ? "#38bdf8" : isDest ? "#ef4444" : isVip ? "#10b981" : "#52525b"}
                      stroke="#ffffff"
                      strokeWidth={isStart || isDest || isVip ? 2.5 : 1.2}
                    />
                    {showGuestTag ? (
                      <GuestTag x={node.x} y={node.y} name={guestName} role={guestRole} />
                    ) : (
                      node.label && (
                        <KonvaText
                          x={node.x + 14}
                          y={node.y - 7}
                          text={node.label}
                          fill="#f4f4f5"
                          fontSize={15}
                          fontStyle="600"
                        />
                      )
                    )}
                  </React.Fragment>
                );
              })}
            </Layer>
          </Stage>
        )}
      </div>

      {/* Top Floating Header (Dynamic Island Style) */}
      <div className="absolute top-12 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        {guestName ? (
          <div className="bg-zinc-900/80 backdrop-blur-2xl border border-white/10 px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-3 pointer-events-auto">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-zinc-100">{guestName}</span>
              {(guestRole || guestTable) && (
                <span className="text-[11px] text-zinc-400 font-medium">
                  {guestRole}{guestRole && guestTable ? " • " : ""}{guestTable ? `Table ${guestTable}` : ""}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/80 backdrop-blur-2xl border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 pointer-events-auto shadow-xl">
            <Compass className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Live Navigation</span>
          </div>
        )}

        {/* Minimal Floor Dropdown */}
        {floors.length > 1 && (
          <div className="relative pointer-events-auto">
            <button
              onClick={() => setShowFloorDropdown(!showFloorDropdown)}
              className="bg-zinc-900/80 backdrop-blur-2xl border border-white/10 text-xs font-semibold tracking-wide text-zinc-200 px-3.5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 active:scale-95 transition"
            >
              <span>{getFloorName(currentFloor)}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {showFloorDropdown && (
              <div className="absolute top-full right-0 mt-2 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-w-[130px] p-1.5 flex flex-col gap-1">
                {floors.map(f => (
                  <button
                    key={f}
                    onClick={() => { setCurrentFloor(f); setShowFloorDropdown(false); }}
                    className={`px-3 py-2 text-xs font-medium rounded-xl text-left transition ${
                      currentFloor === f
                        ? "bg-emerald-500/20 text-emerald-400 font-semibold"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                    }`}
                  >
                    {getFloorName(f)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Drawer Card (Mobility App Style) */}
      <div className="absolute bottom-6 left-3 right-3 z-20 pointer-events-auto">
        <div className="bg-zinc-900/90 backdrop-blur-3xl border border-white/10 rounded-[32px] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          
          {/* Subtle Drag Indicator */}
          <div className="w-10 h-1 bg-zinc-700/60 rounded-full mx-auto mb-4" />

          {/* Route Status Summary */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-3 h-3" /> Auto-Guided
              </span>
            </div>
            <span className="text-[11px] font-medium text-zinc-400">
              {getFloorName(currentFloor)}
            </span>
          </div>

          {/* Routing Touchpoints */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setShowStartSelector(true)}
              className="bg-zinc-800/60 hover:bg-zinc-800 border border-white/5 rounded-2xl p-3 text-left transition active:scale-[0.98]"
            >
              <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1 flex items-center gap-1">
                <Navigation className="w-3 h-3 text-sky-400" /> Start
              </div>
              <div className="text-xs font-semibold text-zinc-200 truncate">
                {startNodeObj?.label || "Set origin"}
              </div>
            </button>

            <button
              onClick={() => setShowDestSelector(true)}
              className="bg-zinc-800/60 hover:bg-zinc-800 border border-white/5 rounded-2xl p-3 text-left transition active:scale-[0.98]"
            >
              <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-400" /> Target
              </div>
              <div className="text-xs font-semibold text-zinc-200 truncate">
                {destNodeObj?.label || "Choose destination"}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Selection Modal (Clean Dark Sheet) */}
      {(showDestSelector || showStartSelector) && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-md transition-opacity">
          <div className="bg-[#121215] border-t border-white/10 rounded-t-[36px] p-6 h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold tracking-tight text-zinc-100">
                {showStartSelector ? "Select Point of Origin" : "Select Target Destination"}
              </h2>
              <button
                onClick={() => { setShowDestSelector(false); setShowStartSelector(false); }}
                className="w-9 h-9 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 flex flex-col gap-2 pb-6">
              {venue.nodes.filter((n: any) => n.label).map((node: any) => (
                <button
                  key={node.id}
                  onClick={() => {
                    if (showStartSelector) {
                      setStartNode(node.id);
                      setShowStartSelector(false);
                      setCurrentFloor(floorOf(node));
                    } else {
                      setDestNode(node.id);
                      setCurrentFloor(floorOf(node));
                      setShowDestSelector(false);
                    }
                  }}
                  className="p-4 bg-zinc-900/60 hover:bg-zinc-800/60 border border-white/5 rounded-2xl flex items-center justify-between text-left transition active:scale-[0.99]"
                >
                  <span className="text-sm font-medium text-zinc-200">{node.label}</span>
                  <span className="text-[11px] font-semibold text-zinc-400 bg-zinc-800 px-2.5 py-1 rounded-lg">
                    {getFloorName(floorOf(node))}
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
    <Suspense fallback={
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    }>
      <GuestMapContent />
    </Suspense>
  );
}