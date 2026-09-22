import React from 'react';

// Small, subtle orientation compass fixed to the top-right of the 3D canvas.
export const CompassOverlay: React.FC = () => (
  <div
    className="absolute top-16 right-3 w-12 h-12 rounded-full bg-white/90 backdrop-blur-md border border-[#DDD9D0] shadow-sm select-none pointer-events-none flex items-center justify-center"
    title="Plant orientation"
  >
    <span className="absolute top-0.5 text-[8px] font-extrabold text-[#2563EB]">N</span>
    <span className="absolute bottom-0.5 text-[8px] font-extrabold text-[#64748B]">S</span>
    <span className="absolute left-0.5 text-[8px] font-extrabold text-[#64748B]">W</span>
    <span className="absolute right-0.5 text-[8px] font-extrabold text-[#64748B]">E</span>
    <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
  </div>
);
