"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UploadCloud, Trash2, ArrowRight, Loader2, Map, Clock } from "lucide-react";
import { db } from "../../lib/firebase";
// NEW: Added getDocs to fetch our saved venues
import { collection, addDoc, getDocs } from "firebase/firestore";

interface FloorPlan {
  id: string;
  name: string;
  image: string; 
}

export default function UploadFloorPlan() {
  const router = useRouter();
  const [floors, setFloors] = useState<FloorPlan[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // NEW: State for loading recent venues
  const [recentVenues, setRecentVenues] = useState<any[]>([]);
  const [isLoadingVenues, setIsLoadingVenues] = useState(true);

  // NEW: Fetch venues on page load
  useEffect(() => {
    const fetchRecentVenues = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "venues"));
        const venues = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as any)
        }));
        
        // Sort them so the newest ones are at the top
        venues.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        
        setRecentVenues(venues);
      } catch (error) {
        console.error("Error fetching recent venues:", error);
      } finally {
        setIsLoadingVenues(false);
      }
    };
    
    fetchRecentVenues();
  }, []);

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
            if (width > height) {
              height = Math.round(height * (maxSize / width));
              width = maxSize;
            } else {
              width = Math.round(width * (maxSize / height));
              height = maxSize;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
          }
          resolve(canvas.toDataURL("image/jpeg", 0.5)); 
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressedBase64 = await compressImage(file);
      const newFloor: FloorPlan = {
        id: Date.now().toString(),
        name: `Floor ${floors.length + 1}`,
        image: compressedBase64,
      };
      setFloors([...floors, newFloor]);
    }
  };

  const removeFloor = (id: string) => setFloors(floors.filter(floor => floor.id !== id));
  
  const updateFloorName = (id: string, newName: string) => {
    setFloors(floors.map(floor => floor.id === id ? { ...floor, name: newName } : floor));
  };

  const handleContinue = async () => {
    if (floors.length === 0) return;
    setIsUploading(true);

    try {
      const docRef = await addDoc(collection(db, "venues"), {
        name: "My Awesome Event",
        floors: floors,
        createdAt: new Date().toISOString()
      });
      router.push(`/editor?venueId=${docRef.id}`);
    } catch (error) {
      console.error("Error saving to Firestore:", error);
      alert("Failed to save to database. Check the console for details.");
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-6 pb-32">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <Link href="/dashboard" className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-xl font-semibold">Venue Setup</h1>
        </header>

        <label className={`bg-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center border-2 border-dashed border-slate-600 mb-8 transition ${isUploading ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-750 cursor-pointer"} relative`}>
          <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          <UploadCloud className="w-12 h-12 text-emerald-400 mb-4" />
          <p className="text-sm font-medium mb-1">Upload new floor plan</p>
          <p className="text-[10px] text-slate-500 mt-4">JPG or PNG. Auto-compressed for cloud sync.</p>
        </label>

        {/* NEW: Recent Venues List (Only shows if you haven't uploaded a new image yet) */}
        {floors.length === 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold mb-4 text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Recent Venues
            </h2>
            
            {isLoadingVenues ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
            ) : recentVenues.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentVenues.map(venue => (
                  <button
                    key={venue.id}
                    onClick={() => router.push(`/editor?venueId=${venue.id}`)}
                    className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center gap-4 hover:bg-slate-750 transition text-left group"
                  >
                    <div className="p-3 bg-slate-700 rounded-lg group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition">
                      <Map className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-200">{venue.name || "Unnamed Venue"}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {venue.floors?.length || 0} Floor{(venue.floors?.length !== 1) ? 's' : ''} • {venue.createdAt ? new Date(venue.createdAt).toLocaleDateString() : 'Draft'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 text-center">
                No recent venues found. Upload a floor plan above to create your first one!
              </p>
            )}
          </div>
        )}

        {/* The rest of the floor preview logic */}
        {floors.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold mb-4 text-slate-300">Venue Floors ({floors.length})</h2>
            <div className="flex flex-col gap-3">
              {floors.map((floor) => (
                <div key={floor.id} className="bg-slate-800 p-3 rounded-xl flex items-center justify-between border border-slate-700">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden">
                      <img src={floor.image} alt="preview" className="w-full h-full object-cover opacity-60" />
                    </div>
                    <input 
                      type="text" 
                      value={floor.name}
                      onChange={(e) => updateFloorName(floor.id, e.target.value)}
                      disabled={isUploading}
                      className="bg-transparent border-b border-slate-600 text-sm font-medium text-white focus:outline-none focus:border-emerald-500 w-1/2 pb-1"
                      placeholder="e.g. Ground Floor"
                    />
                  </div>
                  <button onClick={() => removeFloor(floor.id)} disabled={isUploading} className="p-2 text-slate-500 hover:text-red-400 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {floors.length > 0 && (
          <div className="fixed bottom-0 left-0 w-full p-6 bg-slate-900 border-t border-slate-800 z-10">
            <button 
              onClick={handleContinue}
              disabled={isUploading}
              className="w-full max-w-4xl mx-auto flex items-center justify-center gap-2 py-3 bg-emerald-500 text-slate-900 font-bold rounded-xl hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 disabled:opacity-70"
            >
              {isUploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving to Cloud...</>
              ) : (
                <>Continue to Editor <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}