"use client";

import React, { useState, useEffect, useRef } from "react";
import { Stage, Layer, Circle, Line, Image as KonvaImage, Text as KonvaText } from "react-konva";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Loader2, MousePointer2, PlusCircle, Route, Trash2, Save, Layers, Settings2, MapPin, Search } from "lucide-react";

export default function HostEditor() {
  const searchParams = useSearchParams();
  const venueId = searchParams.get("venueId") || "default-venue"; // Fallback for testing

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([{ id: "1", name: "Main Floor", mapUrl: "" }]);
  const [currentFloor, setCurrentFloor] = useState("1");

  const [tool, setTool] = useState<"select" | "addNode" | "addEdge" | "delete">("select");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [edgeStartNode, setEdgeStartNode] = useState<string | null>(null);

  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const stageRef = useRef<any>(null);

  // 1. Fetch Dimensions
  useEffect(() => {
    const update = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 2. Fetch Data
  useEffect(() => {
    const fetchVenue = async () => {
      try {
        const docSnap = await getDoc(doc(db, "venues", venueId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.nodes) setNodes(data.nodes);
          if (data.edges) setEdges(data.edges);
          if (data.floors) setFloors(data.floors);
        }
      } catch (error) {
        console.error("Fetch error", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVenue();
  }, [venueId]);

  // 3. Load Background Image
  useEffect(() => {
    const floor = floors.find(f => f.id === currentFloor);
    if (!floor?.mapUrl) { setBgImage(null); return; }
    const img = new window.Image();
    img.src = floor.mapUrl;
    img.onload = () => setBgImage(img);
  }, [currentFloor, floors]);

  // 4. Save Function
  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "venues", venueId), { nodes, edges, floors }, { merge: true });
      // Add a quick success toast here later!
    } catch (error) {
      console.error("Save error", error);
    } finally {
      setTimeout(() => setSaving(false), 500);
    }
  };

  // --- Canvas Interactions ---
  const handleStageClick = (e: any) => {
    if (e.target !== stageRef.current && e.target.className !== "Image") return; // Only trigger if clicking empty space

    if (tool === "addNode") {
      const pos = e.target.getStage().getPointerPosition();
      const newNode = { id: Date.now().toString(), x: pos.x, y: pos.y, floorId: currentFloor, label: "" };
      setNodes([...nodes, newNode]);
      setSelectedNode(newNode.id);
      setTool("select"); // Auto-switch back to select
    } else {
      setSelectedNode(null);
      setEdgeStartNode(null);
    }
  };

  const handleNodeClick = (nodeId: string) => {
    if (tool === "select") {
      setSelectedNode(nodeId);
    } else if (tool === "delete") {
      setNodes(nodes.filter(n => n.id !== nodeId));
      setEdges(edges.filter(e => e.from !== nodeId && e.to !== nodeId));
      if (selectedNode === nodeId) setSelectedNode(null);
    } else if (tool === "addEdge") {
      if (!edgeStartNode) {
        setEdgeStartNode(nodeId);
      } else if (edgeStartNode !== nodeId) {
        setEdges([...edges, { id: Date.now().toString(), from: edgeStartNode, to: nodeId }]);
        setEdgeStartNode(null);
        setTool("select"); // Auto-switch back
      }
    }
  };

  const updateSelectedNode = (key: string, value: string) => {
    setNodes(nodes.map(n => n.id === selectedNode ? { ...n, [key]: value } : n));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-emerald-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const activeFloorNodes = nodes.filter(n => n.floorId === currentFloor);
  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div className="fixed inset-0 bg-[#09090b] text-white font-sans overflow-hidden select-none">
      
      {/* 1. MAP CANVAS (Edge to Edge) */}
      <div className="absolute inset-0 z-0">
        {dims.w > 0 && (
          <Stage width={dims.w} height={dims.h} ref={stageRef} onClick={handleStageClick} draggable={tool === "select"}>
            <Layer listening={false}>
              {bgImage && <KonvaImage image={bgImage} x={0} y={0} opacity={0.5} />}
            </Layer>
            <Layer>
              {/* Edges */}
              {edges.map((edge) => {
                const n1 = nodes.find((n) => n.id === edge.from);
                const n2 = nodes.find((n) => n.id === edge.to);
                if (!n1 || !n2 || n1.floorId !== currentFloor || n2.floorId !== currentFloor) return null;
                return <Line key={edge.id} points={[n1.x, n1.y, n2.x, n2.y]} stroke="#3f3f46" strokeWidth={3} />;
              })}

              {/* Edge being drawn */}
              {tool === "addEdge" && edgeStartNode && (
                 <Circle x={nodes.find(n => n.id === edgeStartNode)?.x} y={nodes.find(n => n.id === edgeStartNode)?.y} radius={15} fill="rgba(16, 185, 129, 0.3)" />
              )}

              {/* Nodes */}
              {activeFloorNodes.map((node) => (
                <React.Fragment key={node.id}>
                  <Circle
                    x={node.x} y={node.y}
                    radius={selectedNode === node.id ? 10 : 7}
                    fill={selectedNode === node.id ? "#10b981" : "#52525b"}
                    stroke="#ffffff" strokeWidth={selectedNode === node.id ? 3 : 1}
                    draggable={tool === "select"}
                    onClick={() => handleNodeClick(node.id)}
                    onDragEnd={(e) => {
                      const newNodes = nodes.map(n => n.id === node.id ? { ...n, x: e.target.x(), y: e.target.y() } : n);
                      setNodes(newNodes);
                    }}
                    // Performance optimization for editor
                    shadowBlur={0} perfectDrawEnabled={false}
                  />
                  {node.label && (
                    <KonvaText x={node.x + 15} y={node.y - 7} text={node.label} fill="#a1a1aa" fontSize={14} fontStyle="bold" listening={false} />
                  )}
                </React.Fragment>
              ))}
            </Layer>
          </Stage>
        )}
      </div>

      {/* 2. TOP LEFT: Logo & Save Button */}
      <div className="absolute top-6 left-6 z-20 flex items-center gap-4">
        <div className="bg-zinc-900/80 backdrop-blur-2xl border border-white/10 px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold tracking-wide">Studio Editor</span>
        </div>
        
        <button 
          onClick={handleSave}
          className="bg-emerald-500 hover:bg-emerald-400 text-black px-5 py-2.5 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] font-bold text-sm transition-all flex items-center gap-2 active:scale-95"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save Draft"}
        </button>
      </div>

      {/* 3. BOTTOM CENTER: Floating Tool Pill */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 p-1.5 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center gap-1">
        {[
          { id: "select", icon: MousePointer2, label: "Select" },
          { id: "addNode", icon: PlusCircle, label: "Add Node" },
          { id: "addEdge", icon: Route, label: "Connect" },
          { id: "delete", icon: Trash2, label: "Erase" }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id as any)}
            className={`px-4 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-2 ${
              tool === t.id 
              ? "bg-white text-black shadow-md" 
              : "text-zinc-400 hover:text-white hover:bg-zinc-800/80"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* 4. RIGHT SIDE: Floating Inspector Sheet */}
      <aside className="absolute top-6 right-6 bottom-6 w-80 bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 shadow-2xl flex flex-col gap-6 overflow-hidden">
        
        {/* Floor Switcher */}
        <div>
          <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-3 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" /> Workspace
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {floors.map((f) => (
              <button
                key={f.id} onClick={() => setCurrentFloor(f.id)}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition ${
                  currentFloor === f.id ? "bg-zinc-800 text-white border border-white/10" : "bg-transparent text-zinc-500 hover:bg-zinc-800/50"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/5 w-full" />

        {/* Selected Node Properties */}
        <div className="flex-1 flex flex-col gap-4">
          <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5" /> Inspector
          </h3>

          {selectedNodeData ? (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-zinc-950/50 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Node Label / Table Name</label>
                <input
                  type="text"
                  placeholder="e.g. Table 12, Entrance..."
                  value={selectedNodeData.label || ""}
                  onChange={(e) => updateSelectedNode("label", e.target.value)}
                  className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="bg-zinc-950/50 border border-white/5 rounded-2xl p-4">
                <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                  This node is currently placed on <strong>{floors.find(f => f.id === currentFloor)?.name}</strong>. Drag it to reposition.
                </p>
                <div className="flex gap-2">
                   <div className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-500 text-center font-mono">
                     X: {Math.round(selectedNodeData.x)}
                   </div>
                   <div className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-500 text-center font-mono">
                     Y: {Math.round(selectedNodeData.y)}
                   </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <Search className="w-8 h-8 text-zinc-700 mb-3" />
              <p className="text-sm font-medium text-zinc-400">No element selected.</p>
              <p className="text-xs text-zinc-600 mt-1">Select a node to edit its properties, or use the toolbar below to draw new paths.</p>
            </div>
          )}
        </div>
      </aside>

    </div>
  );
}