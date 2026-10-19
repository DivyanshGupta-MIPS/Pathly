import React from "react";

interface PremiumLayoutProps {
  children: React.ReactNode;
  title: string;
  actionButton?: React.ReactNode; // Optional button for the top right
}

export default function PremiumLayout({ children, title, actionButton }: PremiumLayoutProps) {
  return (
    <div className="min-h-screen p-6 md:p-12 font-sans flex flex-col">
      {/* The Glass Container */}
      <div className="w-full max-w-6xl mx-auto bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex-1">
        
        {/* Chic Header */}
        <div className="flex items-center justify-between mb-10 border-b border-white/5 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          {actionButton && <div>{actionButton}</div>}
        </div>

        {/* Page Content Goes Here */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>

      </div>
    </div>
  );
}