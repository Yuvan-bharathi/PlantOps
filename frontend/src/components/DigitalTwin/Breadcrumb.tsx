import React from 'react';
import { Home, ChevronRight, ArrowLeft } from 'lucide-react';
import { ViewLevel } from './FactoryCanvas';

interface BreadcrumbProps {
  viewLevel: ViewLevel;
  zoneLabel: string | null;
  onExitBuilding: () => void;
}

// Two levels only — Plant Overview, or directly inside a building. There is
// no intermediate stage, so the zone segment is a plain location indicator,
// not a click target; the only navigation action is Exit Building.
export const Breadcrumb: React.FC<BreadcrumbProps> = ({ viewLevel, zoneLabel, onExitBuilding }) => (
  <div className="absolute top-3 left-3 flex items-center gap-2 bg-white/95 backdrop-blur-md border border-[#DDD9D0] rounded-xl px-3 py-1.5 shadow-sm text-xs">
    <span className="w-2 h-2 rounded-full bg-[#22A06B] animate-pulse flex-shrink-0" />
    <span className={`flex items-center gap-1 font-bold ${viewLevel === 'PLANT' ? 'text-[#1E293B]' : 'text-[#64748B]'}`}>
      <Home size={12} /> Plant Overview
    </span>

    {viewLevel === 'INTERIOR' && zoneLabel && (
      <>
        <ChevronRight size={12} className="text-[#DDD9D0] flex-shrink-0" />
        <span className="font-bold text-[#1E293B]">{zoneLabel}</span>

        <span className="w-px h-3 bg-[#DDD9D0]" />
        <button
          onClick={onExitBuilding}
          className="flex items-center gap-1 font-bold text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
        >
          <ArrowLeft size={12} /> Exit Building
        </button>
      </>
    )}
  </div>
);
