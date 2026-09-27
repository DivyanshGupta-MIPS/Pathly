"use client";

import React, { useState, useEffect } from "react";
import { Stage, Layer, Rect, Circle, Line, Group, Text, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import { Trash2, Share2, Asterisk, Spline, Save, Loader2, LocateFixed, ShieldAlert } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

// --- START OF PATHFINDING & GEOMETRY ENGINE ---
const getDistance = (p1: any, p2: any) => Math.hypot(p2.x - p1.x, p2.y - p1.y);

const doIntersect = (p1: any, q1: any, p2: any, q2: any) => {
  const orientation = (p: any, q: any, r: any) => {
    let val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (val === 0) return 0;
    return (val > 0) ? 1 : 2;
  }
  const onSegment = (p: any, q: any, r: any) => q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
  let o1 = orientation(p1, q1, p2);
  let o2 = orientation(p1, q1, q2);
  let o3 = orientation(p2, q2, p1);
  let o4 = orientation(p2, q2, q1);
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
    const w = Math.abs(b.width);
    const h = Math.abs(b.height);
    
    const pad = 2; 
    const tl = {x: x - pad, y: y - pad};
    const tr = {x: x + w + pad, y: y - pad};
    const bl = {x: x - pad, y: y + h + pad};
    const br = {x: x + w + pad, y: y + h + pad};

    if (doIntersect(p1, p2, tl, tr)) return false;
    if (doIntersect(p1, p2, tr, br)) return false;
    if (doIntersect(p1, p2, br, bl)) return false;
    if (doIntersect(p1, p2, bl, tl)) return false;
  }
  return true;
};

const isInsideBlockade = (x: number, y: number, blockades: any[]) => {
  return blockades.some(b => {
    const bx = b.width < 0 ? b.x + b.width : b.x;
    const by = b.height < 0 ? b.y + b.height : b.y;
    const w = Math.abs(b.width);
    const h = Math.abs(b.height);
    return x >= bx - 2 && x <= bx + w + 2 && y >= by - 2 && y <= by + h + 2;
  });
};

const calculateSmartPath = (start: any, end: any, blockades: any[]) => {
  if (isLineClear(start, end, blockades)) return [start.x, start.y, end.x, end.y];
  
  const points = [{x: start.x, y: start.y, id: 'start'}, {x: end.x, y: end.y, id: 'end'}];
  const pad = 15; 
  
  blockades.forEach((b, i) => {
    const x = b.width < 0 ? b.x + b.width : b.x;
    const y = b.height < 0 ? b.y + b.height : b.y;
    const w = Math.abs(b.width);
    const h = Math.abs(b.height);
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
  
  const dist: any = {};
  const prev: any = {};
  const unvisited = new Set<string>();
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
      if (alt < dist[neighbor.node]) {
        dist[neighbor.node] = alt;
        prev[neighbor.node] = u;
      }
    }
  }
  
  const pathPoints = [];
  let curr = 'end';
  if (prev[curr] || curr === 'start') {
    while (curr) {
      const pt = points.find(p => p.id === curr);
      if (pt) {
        pathPoints.unshift(pt.y);
        pathPoints.unshift(pt.x);
      }
      curr = prev[curr];
    }
  }
  
  return pathPoints.length > 0 ? pathPoints : [start.x, start.y, end.x, end.y];
};
// --- END OF PATHFINDING ENGINE ---

// Added isBlocked flag to edges
interface Node { id: string; x: number; y: number; label: string; floorId: string; }
interface Edge { id: string; from: string; to: string; isBlocked?: boolean; }
interface Zone { id: string; x: number; y: number; width: number; height: number; floorId: string; type: "blockade" | "poi"; label: string; }
interface HistoryState { nodes: Node[]; edges: Edge[]; zones: Zone[]; }

export default function MapCanvas({ 
  activeTool, undoTrigger, activeFloorImage, activeFloorId, venueId,
  initialNodes = [], initialEdges = [], initialZones = []
}: { 
  activeTool: string, undoTrigger: number, activeFloorImage: string, activeFloorId: string, venueId: string,
  initialNodes?: Node[], initialEdges?: Edge[], initialZones?: Zone[]
}) {
  
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [zones, setZones] = useState<Zone[]>(initialZones);
  
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null); // NEW: Track selected Edge
  
  const [linkingNodeId, setLinkingNodeId] = useState<string | null>(null);
  const [lastContinuousNodeId, setLastContinuousNodeId] = useState<string | null>(null);
  const [selectionBox, setSelectionBox] = useState({ x1: 0, y1: 0, x2: 0, y2: 0, visible: false });
  const [draftZone, setDraftZone] = useState<{ x: number, y: number, width: number, height: number, type: "blockade"|"poi" } | null>(null);

  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });

  const [windowSize, setWindowSize] = useState({ width: 800, height: 600 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const updateSize = () => setWindowSize({ width: window.innerWidth - 100, height: window.innerHeight - 100 });
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const [bgImage] = useImage(activeFloorImage);
  const snapshot = () => setHistory(prev => [...prev, { nodes: [...nodes], edges: [...edges], zones: [...zones] }]);

  const saveToCloud = async () => {
    if (!venueId) return;
    setIsSaving(true);
    try {
      const venueRef = doc(db, "venues", venueId);
      await updateDoc(venueRef, { nodes, edges, zones, lastUpdated: new Date().toISOString() });
      setTimeout(() => setIsSaving(false), 500);
    } catch (error) {
      console.error("Error saving to cloud:", error);
      alert("Failed to save to cloud.");
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (undoTrigger > 0 && history.length > 0) {
      const lastState = history[history.length - 1];
      setNodes(lastState.nodes);
      setEdges(lastState.edges);
      setZones(lastState.zones);
      setHistory(prev => prev.slice(0, -1));
      setSelectedNodeIds([]);
      setSelectedZoneId(null);
      setSelectedEdgeId(null);
    }
  }, [undoTrigger]);

  useEffect(() => {
    setSelectedNodeIds([]);
    setSelectedZoneId(null);
    setSelectedEdgeId(null);
    setLastContinuousNodeId(null);
    setSelectionBox({ ...selectionBox, visible: false });
    setDraftZone(null);
  }, [activeTool, activeFloorId]);

  const visibleNodes = nodes.filter(n => n.floorId === activeFloorId);
  const visibleEdges = edges.filter(e => {
    const fromNode = nodes.find(n => n.id === e.from);
    const toNode = nodes.find(n => n.id === e.to);
    return fromNode?.floorId === activeFloorId && toNode?.floorId === activeFloorId;
  });
  const visibleZones = zones.filter(z => z.floorId === activeFloorId);
  const visibleBlockades = visibleZones.filter(z => z.type === "blockade");

  const isPortalNode = (nodeId: string) => {
    return edges.some(e => {
      if (e.from === nodeId) return nodes.find(n => n.id === e.to)?.floorId !== activeFloorId;
      if (e.to === nodeId) return nodes.find(n => n.id === e.from)?.floorId !== activeFloorId;
      return false;
    });
  };

  const getCursor = () => {
    if (activeTool === "pan") return "grab";
    if (activeTool === "point" || activeTool === "continuous" || activeTool === "blockade" || activeTool === "zone") return "crosshair"; 
    if (activeTool === "direct_link") return "cell";
    if (activeTool === "eraser") return "not-allowed";
    return "default";
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    if (newScale < 0.1 || newScale > 5) return;
    setStageScale(newScale);
    setStagePosition({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
  };

  const getRelativePointerPosition = (stage: any) => {
    const pointerPosition = stage.getPointerPosition();
    return { x: (pointerPosition.x - stage.x()) / stage.scaleX(), y: (pointerPosition.y - stage.y()) / stage.scaleY() };
  };

  const handleStageMouseDown = (e: any) => {
    if (e.target.name() !== "background") return;

    if (activeTool === "select") {
      const pos = getRelativePointerPosition(e.target.getStage());
      setSelectionBox({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, visible: true });
      setSelectedNodeIds([]);
      setSelectedZoneId(null);
      setSelectedEdgeId(null);
    } else if (activeTool === "blockade" || activeTool === "zone") {
      const pos = getRelativePointerPosition(e.target.getStage());
      setDraftZone({ x: pos.x, y: pos.y, width: 0, height: 0, type: activeTool === "blockade" ? "blockade" : "poi" });
    } else if (activeTool === "point") {
      const pos = getRelativePointerPosition(e.target.getStage());
      if (isInsideBlockade(pos.x, pos.y, visibleBlockades)) return; 
      
      snapshot();
      setNodes([...nodes, { id: Date.now().toString(), x: pos.x, y: pos.y, label: (nodes.length + 1).toString(), floorId: activeFloorId }]);
    } else if (activeTool === "continuous") {
      const pos = getRelativePointerPosition(e.target.getStage());
      if (isInsideBlockade(pos.x, pos.y, visibleBlockades)) return; 
      
      snapshot();
      const newNodeId = Date.now().toString();
      setNodes([...nodes, { id: newNodeId, x: pos.x, y: pos.y, label: (nodes.length + 1).toString(), floorId: activeFloorId }]);
      if (lastContinuousNodeId) setEdges([...edges, { id: Date.now().toString() + "e", from: lastContinuousNodeId, to: newNodeId }]);
      setLastContinuousNodeId(newNodeId);
    }
  };

  const handleStageMouseMove = (e: any) => {
    const pos = getRelativePointerPosition(e.target.getStage());
    if (selectionBox.visible && activeTool === "select") {
      setSelectionBox({ ...selectionBox, x2: pos.x, y2: pos.y });
    } else if ((activeTool === "blockade" || activeTool === "zone") && draftZone) {
      setDraftZone({ ...draftZone, width: pos.x - draftZone.x, height: pos.y - draftZone.y });
    }
  };

  const handleStageMouseUp = () => {
    if (selectionBox.visible && activeTool === "select") {
      setSelectionBox({ ...selectionBox, visible: false });
      const xMin = Math.min(selectionBox.x1, selectionBox.x2);
      const xMax = Math.max(selectionBox.x1, selectionBox.x2);
      const yMin = Math.min(selectionBox.y1, selectionBox.y2);
      const yMax = Math.max(selectionBox.y1, selectionBox.y2);
      const nodesInBox = visibleNodes.filter(n => n.x >= xMin && n.x <= xMax && n.y >= yMin && n.y <= yMax).map(n => n.id);
      if (nodesInBox.length > 0) setSelectedNodeIds(nodesInBox);
    } else if ((activeTool === "blockade" || activeTool === "zone") && draftZone) {
      snapshot();
      const x = draftZone.width < 0 ? draftZone.x + draftZone.width : draftZone.x;
      const y = draftZone.height < 0 ? draftZone.y + draftZone.height : draftZone.y;
      const width = Math.abs(draftZone.width);
      const height = Math.abs(draftZone.height);

      if (width > 10 && height > 10) {
        setZones([...zones, { 
          id: Date.now().toString(), x, y, width, height, 
          floorId: activeFloorId, type: draftZone.type, 
          label: draftZone.type === "poi" ? "New Zone" : "" 
        }]);
      }
      setDraftZone(null);
    }
  };

  const handleNodeClick = (nodeId: string) => {
    if (activeTool === "select") {
      setSelectedZoneId(null);
      setSelectedEdgeId(null);
      setSelectedNodeIds(prev => prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]);
    } else if (activeTool === "eraser") {
      snapshot();
      setNodes(nodes.filter(n => n.id !== nodeId));
      setEdges(edges.filter(e => e.from !== nodeId && e.to !== nodeId));
    } else if (activeTool === "direct_link") {
      if (!linkingNodeId) setLinkingNodeId(nodeId);
      else {
        if (linkingNodeId !== nodeId) { snapshot(); setEdges([...edges, { id: Date.now().toString(), from: linkingNodeId, to: nodeId }]); }
        setLinkingNodeId(null);
      }
    } else if (activeTool === "continuous") {
      if (lastContinuousNodeId && lastContinuousNodeId !== nodeId) {
        snapshot();
        setEdges([...edges, { id: Date.now().toString(), from: lastContinuousNodeId, to: nodeId }]);
      }
      setLastContinuousNodeId(nodeId);
    }
  };

  // NEW: Updated to handle selecting an edge
  const handleEdgeClick = (edgeId: string) => {
    if (activeTool === "select") {
      setSelectedNodeIds([]);
      setSelectedZoneId(null);
      setSelectedEdgeId(edgeId);
    } else if (activeTool === "eraser") {
      snapshot();
      setEdges(edges.filter(e => e.id !== edgeId));
    }
  };

  const handleZoneClick = (zoneId: string) => {
    if (activeTool === "select") {
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setSelectedZoneId(zoneId);
    } else if (activeTool === "eraser") {
      snapshot();
      setZones(zones.filter(z => z.id !== zoneId));
    }
  };

  const updateZoneLabel = (id: string, newLabel: string) => {
    setZones(zones.map(z => z.id === id ? { ...z, label: newLabel } : z));
  };

  // ADD THIS FUNCTION
  const updateNodeLabel = (id: string, newLabel: string) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, label: newLabel } : n));
  };

  // NEW: Toggle Edge Block State
  const toggleEdgeBlock = () => {
    if (!selectedEdgeId) return;
    snapshot();
    setEdges(edges.map(e => e.id === selectedEdgeId ? { ...e, isBlocked: !e.isBlocked } : e));
  };

  const generateTopology = (type: "bus" | "star" | "mesh") => {
    snapshot();
    let newEdges = [...edges];
    const checkEdgeExists = (from: string, to: string) => newEdges.some(e => (e.from === from && e.to === to) || (e.from === to && e.to === from));
    
    if (type === "bus") {
      for (let i = 0; i < selectedNodeIds.length - 1; i++) {
        if (!checkEdgeExists(selectedNodeIds[i], selectedNodeIds[i+1])) newEdges.push({ id: Date.now().toString() + i, from: selectedNodeIds[i], to: selectedNodeIds[i+1] });
      }
    } else if (type === "star" && selectedNodeIds.length >= 2) {
      const hub = selectedNodeIds[0];
      for (let i = 1; i < selectedNodeIds.length; i++) {
        if (!checkEdgeExists(hub, selectedNodeIds[i])) newEdges.push({ id: Date.now().toString() + i, from: hub, to: selectedNodeIds[i] });
      }
    } else if (type === "mesh") {
      let c = 0;
      for (let i = 0; i < selectedNodeIds.length; i++) {
        for (let j = i + 1; j < selectedNodeIds.length; j++) {
          if (!checkEdgeExists(selectedNodeIds[i], selectedNodeIds[j])) newEdges.push({ id: Date.now().toString() + c++, from: selectedNodeIds[i], to: selectedNodeIds[j] });
        }
      }
    }
    setEdges(newEdges);
    setSelectedNodeIds([]);
  };

  const deleteSelected = () => {
    snapshot();
    if (selectedZoneId) {
      setZones(zones.filter(z => z.id !== selectedZoneId));
      setSelectedZoneId(null);
    } else if (selectedEdgeId) {
      setEdges(edges.filter(e => e.id !== selectedEdgeId));
      setSelectedEdgeId(null);
    } else {
      setNodes(nodes.filter(n => !selectedNodeIds.includes(n.id)));
      setEdges(edges.filter(e => !selectedNodeIds.includes(e.from) && !selectedNodeIds.includes(e.to)));
      setSelectedNodeIds([]);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="relative w-full h-full">
      
      <button 
        onClick={() => {
          setStageScale(1);
          setStagePosition({ x: 0, y: 0 });
        }}
        className="absolute bottom-6 left-6 bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl shadow-lg font-semibold flex items-center gap-2 border border-slate-600 transition z-20"
      >
        <LocateFixed className="w-5 h-5 text-blue-400" /> 
        Reset View
      </button>

      <button 
        onClick={saveToCloud}
        disabled={isSaving}
        className="fixed bottom-6 right-8 bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-4 py-3 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] font-bold flex items-center gap-2 transition z-[100] disabled:opacity-70"
      >
        {isSaving ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
        ) : (
          <><Save className="w-5 h-5" /> Save to Cloud</>
        )}
      </button>

      {/* Floating Panel: Zone Selection */}
      {selectedZoneId && activeTool === "select" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900 rounded-xl shadow-2xl flex items-center gap-2 p-2 z-10 border border-blue-500/50">
          <span className="text-xs font-semibold text-blue-400 px-3 border-r border-slate-700">Zone Settings</span>
          <input 
            type="text" 
            value={zones.find(z => z.id === selectedZoneId)?.label || ""}
            onChange={(e) => selectedZoneId && updateZoneLabel(selectedZoneId, e.target.value)}
            onKeyDown={(e) => e.stopPropagation()} 
            placeholder="Name this zone..."
            className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500 w-48"
          />
          <button onClick={deleteSelected} className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
        </div>
      )}

      {/* NEW Floating Panel: Edge/Path Selection */}
      {selectedEdgeId && activeTool === "select" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900 rounded-xl shadow-2xl flex items-center gap-2 p-2 z-10 border border-slate-700">
          <span className="text-xs font-semibold text-slate-300 px-3 border-r border-slate-700">Path Selected</span>
          <button
            onClick={toggleEdgeBlock}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              edges.find(e => e.id === selectedEdgeId)?.isBlocked
                ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
                : "bg-slate-800 text-slate-300 border border-slate-600 hover:bg-slate-700 hover:text-white"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            {edges.find(e => e.id === selectedEdgeId)?.isBlocked ? "Unblock Path" : "Block Path"}
          </button>
          <div className="w-px h-6 bg-slate-700 mx-1"></div>
          <button onClick={deleteSelected} className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
        </div>
      )}

      {/* Floating Panel: Node Selection */}
      {/* Floating Panel: Node Selection */}
      {selectedNodeIds.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900 rounded-xl shadow-2xl flex items-center gap-2 p-2 z-10 border border-slate-700">
          
          {/* NEW: Input field for naming a single node */}
          {selectedNodeIds.length === 1 && (
            <>
              <span className="text-xs font-semibold text-blue-400 px-3 border-r border-slate-700">Node Settings</span>
              <input 
                type="text" 
                value={nodes.find(n => n.id === selectedNodeIds[0])?.label || ""}
                onChange={(e) => updateNodeLabel(selectedNodeIds[0], e.target.value)}
                onKeyDown={(e) => e.stopPropagation()} 
                placeholder="Name this node (e.g. Entrance)"
                className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500 w-48"
              />
            </>
          )}

          <span className="text-xs font-semibold text-slate-300 px-3 border-r border-slate-700">{selectedNodeIds.length} Selected</span>
          <button onClick={deleteSelected} className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
          
          {selectedNodeIds.length >= 2 && (
            <>
              <div className="w-px h-6 bg-slate-700 mx-1"></div>
              <button onClick={() => generateTopology("bus")} className="flex items-center gap-2 p-2 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg">
                <Spline className="w-4 h-4" /> <span className="text-xs pr-1">Bus</span>
              </button>
              <button onClick={() => generateTopology("star")} className="flex items-center gap-2 p-2 hover:bg-slate-800 text-slate-400 hover:text-blue-400 rounded-lg">
                <Asterisk className="w-4 h-4" /> <span className="text-xs pr-1">Star</span>
              </button>
              <button onClick={() => generateTopology("mesh")} className="flex items-center gap-2 p-2 hover:bg-slate-800 text-slate-400 hover:text-purple-400 rounded-lg">
                <Share2 className="w-4 h-4" /> <span className="text-xs pr-1">Mesh</span>
              </button>
            </>
          )}
        </div>
      )}

      <div style={{ width: "100%", height: "100%", cursor: getCursor() }}>
        <Stage 
          width={windowSize.width} height={windowSize.height} scaleX={stageScale} scaleY={stageScale} x={stagePosition.x} y={stagePosition.y}
          draggable={activeTool === "pan"} onDragEnd={(e) => { if (e.target === e.target.getStage()) setStagePosition({ x: e.target.x(), y: e.target.y() }); }}
          onWheel={handleWheel} onMouseDown={handleStageMouseDown} onMouseMove={handleStageMouseMove} onMouseUp={handleStageMouseUp}
        >
          <Layer>
            {bgImage ? <KonvaImage image={bgImage} name="background" /> : <Rect x={0} y={0} width={3000} height={3000} fill="#e2e8f0" name="background" />}
            
            {visibleZones.map(zone => {
              const isBlockade = zone.type === "blockade";
              const isSelected = selectedZoneId === zone.id;
              
              return (
                <Group key={zone.id}>
                  <Rect
                    x={zone.x} y={zone.y} width={zone.width} height={zone.height}
                    fill={isBlockade ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.2)"}
                    stroke={isSelected ? "#ffffff" : (isBlockade ? "#ef4444" : "#3b82f6")} 
                    strokeWidth={(isSelected ? 3 : 2) / stageScale}
                    onClick={() => handleZoneClick(zone.id)}
                    onMouseEnter={(e) => {
                      const container = e.target.getStage()?.container();
                      if (activeTool === "select") { if (container) container.style.cursor = "pointer"; }
                      else if (activeTool === "eraser") { if (container) container.style.cursor = "not-allowed"; (e.target as any).fill("rgba(239, 68, 68, 0.4)"); }
                    }}
                    onMouseLeave={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container) container.style.cursor = getCursor();
                      if (activeTool === "eraser") (e.target as any).fill(isBlockade ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.2)");
                    }}
                  />
                  {!isBlockade && (
                    <Text
                      x={zone.x} y={zone.y + (zone.height / 2) - (14 / stageScale)} width={zone.width}
                      text={zone.label} fill="#1e3a8a" fontSize={16 / stageScale} fontStyle="bold" align="center" listening={false}
                    />
                  )}
                </Group>
              );
            })}

            {draftZone && (activeTool === "blockade" || activeTool === "zone") && (
              <Rect 
                x={draftZone.width < 0 ? draftZone.x + draftZone.width : draftZone.x} y={draftZone.height < 0 ? draftZone.y + draftZone.height : draftZone.y}
                width={Math.abs(draftZone.width)} height={Math.abs(draftZone.height)} 
                fill={draftZone.type === "blockade" ? "rgba(239, 68, 68, 0.3)" : "rgba(59, 130, 246, 0.3)"} 
                stroke={draftZone.type === "blockade" ? "#ef4444" : "#3b82f6"} strokeWidth={2 / stageScale} listening={false} 
              />
            )}

            {visibleEdges.map(edge => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              
              const pathPoints = calculateSmartPath(fromNode, toNode, visibleBlockades);
              
              // Edge Styling logic
              const isBlocked = edge.isBlocked;
              const isSelected = selectedEdgeId === edge.id;
              
              return (
                <Line
                  key={edge.id} 
                  points={pathPoints} 
                  stroke={isBlocked ? "#ef4444" : (isSelected ? "#60a5fa" : "#3b82f6")} 
                  strokeWidth={(isSelected ? 8 : 6) / stageScale} 
                  lineCap="round" 
                  lineJoin="round" 
                  dash={isBlocked ? [15 / stageScale, 15 / stageScale] : undefined}
                  hitStrokeWidth={20 / stageScale}
                  onClick={() => handleEdgeClick(edge.id)}
                  onMouseEnter={(e) => {
                    const container = e.target.getStage()?.container();
                    if (activeTool === "select") { 
                      if (container) container.style.cursor = "pointer";
                      (e.target as any).strokeWidth(8 / stageScale);
                    }
                    else if (activeTool === "eraser") { 
                      if (container) container.style.cursor = "not-allowed"; 
                      (e.target as any).stroke("#ef4444"); 
                    }
                  }}
                  onMouseLeave={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = getCursor();
                    (e.target as any).strokeWidth((isSelected ? 8 : 6) / stageScale);
                    (e.target as any).stroke(isBlocked ? "#ef4444" : (isSelected ? "#60a5fa" : "#3b82f6"));
                  }}
                />
              );
            })}
            
            {visibleNodes.map(node => (
              <Group 
                key={node.id} x={node.x} y={node.y} 
                onClick={() => handleNodeClick(node.id)} 
                draggable={activeTool === "select"} 
                dragBoundFunc={(pos) => {
                  const localX = (pos.x - stagePosition.x) / stageScale;
                  const localY = (pos.y - stagePosition.y) / stageScale;
                  if (isInsideBlockade(localX, localY, visibleBlockades)) {
                    return { x: node.x * stageScale + stagePosition.x, y: node.y * stageScale + stagePosition.y };
                  }
                  return pos;
                }}
                onDragMove={(e) => setNodes(nodes.map(n => n.id === node.id ? { ...n, x: e.target.x(), y: e.target.y() } : n))}
              >
                <Circle radius={10 / Math.max(0.5, stageScale)} fill={selectedNodeIds.includes(node.id) ? "#047857" : (isPortalNode(node.id) ? "#a855f7" : "#10b981")} stroke={(linkingNodeId === node.id || lastContinuousNodeId === node.id) ? "#064e3b" : "transparent"} strokeWidth={3 / stageScale} />
                <Text text={node.label} fill="white" fontSize={11 / Math.max(0.5, stageScale)} fontStyle="bold" x={-10 / Math.max(0.5, stageScale)} y={-5.5 / Math.max(0.5, stageScale)} width={20 / Math.max(0.5, stageScale)} align="center" verticalAlign="middle" listening={false} />
              </Group>
            ))}
            {selectionBox.visible && activeTool === "select" && (
              <Rect
                x={Math.min(selectionBox.x1, selectionBox.x2)}
                y={Math.min(selectionBox.y1, selectionBox.y2)}
                width={Math.abs(selectionBox.x2 - selectionBox.x1)}
                height={Math.abs(selectionBox.y2 - selectionBox.y1)}
                fill="rgba(59, 130, 246, 0.3)"
                stroke="#3b82f6"
                strokeWidth={1 / stageScale}
                listening={false}
              />
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}