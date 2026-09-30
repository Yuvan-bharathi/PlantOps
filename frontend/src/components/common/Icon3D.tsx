import React from 'react';

export type Icon3DType =
  | 'health'
  | 'edge'
  | 'database'
  | 'telemetry'
  | 'security'
  | 'ai'
  | 'procurement'
  | 'loto'
  | 'agv'
  | 'server'
  | 'alert'
  | 'sync';

interface Icon3DProps {
  type: Icon3DType;
  size?: number;
  className?: string;
}

export const Icon3D: React.FC<Icon3DProps> = ({ type, size = 36, className = '' }) => {
  const w = size;
  const h = size;

  switch (type) {
    case 'health':
      return (
        <div
          className={`relative flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${className}`}
          style={{ width: w, height: h }}
        >
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full drop-shadow-[0_4px_8px_rgba(16,185,129,0.25)]">
            <defs>
              <linearGradient id="g-health-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="g-health-spec" x1="16" y1="8" x2="48" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="g-health-pulse" x1="8" y1="32" x2="56" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ECFDF5" />
                <stop offset="100%" stopColor="#FFFFFF" />
              </linearGradient>
            </defs>
            {/* 3D Orb Outer Shadow Base */}
            <circle cx="32" cy="34" r="26" fill="#047857" opacity="0.4" />
            {/* 3D Glossy Sphere */}
            <circle cx="32" cy="32" r="26" fill="url(#g-health-bg)" />
            {/* Top Specular Rim Reflection */}
            <path
              d="M 14 26 C 18 14, 46 14, 50 26 C 44 20, 20 20, 14 26 Z"
              fill="url(#g-health-spec)"
              opacity="0.9"
            />
            {/* 3D Heartbeat / Pulse Wave */}
            <path
              d="M 12 33 L 22 33 L 26 21 L 32 43 L 38 27 L 42 33 L 52 33"
              stroke="url(#g-health-pulse)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Center Pulse Core */}
            <circle cx="32" cy="43" r="2" fill="#FFFFFF" />
          </svg>
        </div>
      );

    case 'edge':
      return (
        <div
          className={`relative flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${className}`}
          style={{ width: w, height: h }}
        >
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full drop-shadow-[0_4px_8px_rgba(59,130,246,0.25)]">
            <defs>
              <linearGradient id="g-edge-top" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#2563EB" />
              </linearGradient>
              <linearGradient id="g-edge-left" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1D4ED8" />
                <stop offset="100%" stopColor="#1E3A8A" />
              </linearGradient>
              <linearGradient id="g-edge-right" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
            </defs>
            {/* 3D Isometric Gateway Box */}
            {/* Top Face */}
            <polygon points="32,10 54,22 32,34 10,22" fill="url(#g-edge-top)" />
            {/* Left Face */}
            <polygon points="10,22 32,34 32,54 10,42" fill="url(#g-edge-left)" />
            {/* Right Face */}
            <polygon points="32,34 54,22 54,42 32,54" fill="url(#g-edge-right)" />
            {/* Top Bevel Highlight */}
            <line x1="32" y1="10" x2="54" y2="22" stroke="#93C5FD" strokeWidth="1.5" />
            <line x1="32" y1="10" x2="10" y2="22" stroke="#BFDBFE" strokeWidth="1.5" />
            {/* Glowing Antenna & Waves */}
            <line x1="32" y1="10" x2="32" y2="2" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="32" cy="2" r="2.5" fill="#38BDF8" />
            {/* Signal Waves */}
            <path d="M 24 0 C 28 -3, 36 -3, 40 0" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 20 -4 C 27 -8, 37 -8, 44 -4" stroke="#7DD3FC" strokeWidth="1.2" strokeLinecap="round" />
            {/* Front LEDs */}
            <circle cx="20" cy="35" r="1.5" fill="#4ADE80" />
            <circle cx="26" cy="38" r="1.5" fill="#38BDF8" />
            <circle cx="38" cy="45" r="1.5" fill="#60A5FA" />
            <circle cx="44" cy="42" r="1.5" fill="#4ADE80" />
          </svg>
        </div>
      );

    case 'database':
      return (
        <div
          className={`relative flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${className}`}
          style={{ width: w, height: h }}
        >
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full drop-shadow-[0_4px_8px_rgba(6,182,212,0.25)]">
            <defs>
              <linearGradient id="g-db-cyl1" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#22D3EE" />
                <stop offset="100%" stopColor="#0891B2" />
              </linearGradient>
              <linearGradient id="g-db-cyl2" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#06B6D4" />
                <stop offset="100%" stopColor="#0E7490" />
              </linearGradient>
              <linearGradient id="g-db-top" x1="16" y1="8" x2="48" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#A5F3FC" />
                <stop offset="100%" stopColor="#22D3EE" />
              </linearGradient>
            </defs>
            {/* Tier 3 (Bottom) */}
            <path d="M 12 40 C 12 34, 52 34, 52 40 L 52 48 C 52 54, 12 54, 12 48 Z" fill="url(#g-db-cyl2)" />
            <ellipse cx="32" cy="40" rx="20" ry="6" fill="#164E63" opacity="0.6" />
            {/* Tier 2 (Middle) */}
            <path d="M 12 26 C 12 20, 52 20, 52 26 L 52 34 C 52 40, 12 40, 12 34 Z" fill="url(#g-db-cyl1)" />
            <ellipse cx="32" cy="26" rx="20" ry="6" fill="#0E7490" opacity="0.6" />
            {/* Tier 1 (Top) */}
            <path d="M 12 12 C 12 6, 52 6, 52 12 L 52 20 C 52 26, 12 26, 12 20 Z" fill="url(#g-db-cyl1)" />
            {/* Top Cap */}
            <ellipse cx="32" cy="12" rx="20" ry="6" fill="url(#g-db-top)" />
            {/* Glowing Data Ring Indicator */}
            <circle cx="20" cy="16" r="1.5" fill="#FFFFFF" />
            <circle cx="20" cy="30" r="1.5" fill="#67E8F9" />
            <circle cx="20" cy="44" r="1.5" fill="#A5F3FC" />
            <line x1="26" y1="16" x2="44" y2="16" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <line x1="26" y1="30" x2="44" y2="30" stroke="#67E8F9" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <line x1="26" y1="44" x2="44" y2="44" stroke="#A5F3FC" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          </svg>
        </div>
      );

    case 'telemetry':
      return (
        <div
          className={`relative flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${className}`}
          style={{ width: w, height: h }}
        >
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full drop-shadow-[0_4px_8px_rgba(168,85,247,0.25)]">
            <defs>
              <linearGradient id="g-tel-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#C084FC" />
                <stop offset="100%" stopColor="#7E22CE" />
              </linearGradient>
              <linearGradient id="g-tel-ring" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#E9D5FF" />
                <stop offset="100%" stopColor="#A855F7" />
              </linearGradient>
            </defs>
            {/* 3D Wave Rings */}
            <circle cx="32" cy="32" r="28" stroke="url(#g-tel-ring)" strokeWidth="1.5" opacity="0.3" strokeDasharray="4 3" />
            <circle cx="32" cy="32" r="22" stroke="url(#g-tel-ring)" strokeWidth="2" opacity="0.6" />
            <circle cx="32" cy="32" r="16" stroke="url(#g-tel-ring)" strokeWidth="2.5" opacity="0.85" />
            {/* Central 3D Core Sphere */}
            <circle cx="32" cy="32" r="10" fill="url(#g-tel-bg)" />
            <ellipse cx="30" cy="28" rx="4" ry="2" fill="#FFFFFF" opacity="0.7" />
            {/* Cross Waves */}
            <path d="M 14 32 L 22 32 M 42 32 L 50 32 M 32 14 L 32 22 M 32 42 L 32 50" stroke="#E9D5FF" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      );

    case 'security':
      return (
        <div
          className={`relative flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${className}`}
          style={{ width: w, height: h }}
        >
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full drop-shadow-[0_4px_8px_rgba(99,102,241,0.25)]">
            <defs>
              <linearGradient id="g-sec-left" x1="0" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#4338CA" />
              </linearGradient>
              <linearGradient id="g-sec-right" x1="32" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#312E81" />
              </linearGradient>
              <linearGradient id="g-sec-bevel" x1="12" y1="8" x2="52" y2="30" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#E0E7FF" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Left Shield Half */}
            <path d="M 32 6 L 10 16 C 10 38, 22 52, 32 58 L 32 6 Z" fill="url(#g-sec-left)" />
            {/* Right Shield Half */}
            <path d="M 32 6 L 54 16 C 54 38, 42 52, 32 58 L 32 6 Z" fill="url(#g-sec-right)" />
            {/* Bevel Highlight */}
            <path d="M 32 8 L 13 17 C 13 36, 23 49, 32 55" stroke="url(#g-sec-bevel)" strokeWidth="2" strokeLinecap="round" />
            {/* Center Lock Badge */}
            <circle cx="32" cy="33" r="8" fill="#1E1B4B" />
            <path d="M 28 30 L 28 26 C 28 23.8, 29.8 22, 32 22 C 34.2 22, 36 23.8, 36 26 L 36 30" stroke="#A5B4FC" strokeWidth="2" strokeLinecap="round" />
            <rect x="27" y="30" width="10" height="8" rx="2" fill="#E0E7FF" />
            <circle cx="32" cy="34" r="1.5" fill="#312E81" />
          </svg>
        </div>
      );

    case 'ai':
      return (
        <div
          className={`relative flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${className}`}
          style={{ width: w, height: h }}
        >
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full drop-shadow-[0_4px_8px_rgba(244,63,94,0.25)]">
            <defs>
              <linearGradient id="g-ai-core" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FB7185" />
                <stop offset="100%" stopColor="#BE123C" />
              </linearGradient>
            </defs>
            {/* 3D Neural Nodes & Links */}
            <circle cx="32" cy="32" r="14" fill="url(#g-ai-core)" />
            <ellipse cx="29" cy="27" rx="5" ry="2.5" fill="#FFE4E6" opacity="0.8" />
            {/* Floating Orbiting Satellite Nodes */}
            <line x1="32" y1="18" x2="32" y2="8" stroke="#F43F5E" strokeWidth="2" />
            <circle cx="32" cy="8" r="4" fill="#FDA4AF" />
            <line x1="32" y1="46" x2="32" y2="56" stroke="#F43F5E" strokeWidth="2" />
            <circle cx="32" cy="56" r="4" fill="#FDA4AF" />
            <line x1="18" y1="32" x2="8" y2="32" stroke="#F43F5E" strokeWidth="2" />
            <circle cx="8" cy="32" r="4" fill="#FDA4AF" />
            <line x1="46" y1="32" x2="56" y2="32" stroke="#F43F5E" strokeWidth="2" />
            <circle cx="56" cy="32" r="4" fill="#FDA4AF" />
            {/* Sparkle Synapse */}
            <polygon points="32,25 34,30 39,32 34,34 32,39 30,34 25,32 30,30" fill="#FFFFFF" />
          </svg>
        </div>
      );

    case 'procurement':
      return (
        <div
          className={`relative flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${className}`}
          style={{ width: w, height: h }}
        >
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full drop-shadow-[0_4px_8px_rgba(245,158,11,0.25)]">
            <defs>
              <linearGradient id="g-proc-box" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
            </defs>
            {/* Isometric Package Box */}
            <polygon points="32,8 54,20 32,32 10,20" fill="#FDE68A" />
            <polygon points="10,20 32,32 32,54 10,42" fill="url(#g-proc-box)" />
            <polygon points="32,32 54,20 54,42 32,54" fill="#D97706" />
            {/* Tape Seam */}
            <polygon points="28,10 36,14 36,30 28,26" fill="#F59E0B" opacity="0.6" />
            {/* Checkmark Badge */}
            <circle cx="46" cy="44" r="9" fill="#10B981" />
            <path d="M 42 44 L 45 47 L 50 41" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      );

    case 'loto':
      return (
        <div
          className={`relative flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${className}`}
          style={{ width: w, height: h }}
        >
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full drop-shadow-[0_4px_8px_rgba(239,68,68,0.25)]">
            <defs>
              <linearGradient id="g-loto-body" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="100%" stopColor="#991B1B" />
              </linearGradient>
              <linearGradient id="g-loto-shackle" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#E2E8F0" />
                <stop offset="50%" stopColor="#94A3B8" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
            </defs>
            {/* Heavy Steel Shackle */}
            <path
              d="M 22 28 L 22 18 C 22 12.5, 26.5 8, 32 8 C 37.5 8, 42 12.5, 42 18 L 42 28"
              stroke="url(#g-loto-shackle)"
              strokeWidth="5.5"
              strokeLinecap="round"
            />
            {/* Padlock Body */}
            <rect x="14" y="26" width="36" height="30" rx="6" fill="url(#g-loto-body)" />
            {/* OSHA Caution Stripes */}
            <path d="M 16 34 L 24 26 M 22 42 L 34 30 M 28 50 L 44 34 M 38 54 L 48 44" stroke="#FEE2E2" strokeWidth="2.5" opacity="0.4" />
            {/* Keyhole */}
            <circle cx="32" cy="40" r="3" fill="#1E293B" />
            <polygon points="30,40 34,40 33,48 31,48" fill="#1E293B" />
          </svg>
        </div>
      );

    case 'agv':
      return (
        <div
          className={`relative flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${className}`}
          style={{ width: w, height: h }}
        >
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full drop-shadow-[0_4px_8px_rgba(20,184,166,0.25)]">
            <defs>
              <linearGradient id="g-agv-top" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2DD4BF" />
                <stop offset="100%" stopColor="#0F766E" />
              </linearGradient>
            </defs>
            {/* AGV Chassis */}
            <polygon points="32,14 54,26 32,38 10,26" fill="url(#g-agv-top)" />
            <polygon points="10,26 32,38 32,50 10,38" fill="#115E59" />
            <polygon points="32,38 54,26 54,38 32,50" fill="#042F2E" />
            {/* LiDAR Dome on Top */}
            <circle cx="32" cy="22" r="4" fill="#38BDF8" />
            <path d="M 26 20 C 29 17, 35 17, 38 20" stroke="#7DD3FC" strokeWidth="1.5" strokeLinecap="round" />
            {/* Omnidirectional Wheels */}
            <ellipse cx="14" cy="44" rx="3" ry="5" fill="#334155" />
            <ellipse cx="50" cy="44" rx="3" ry="5" fill="#334155" />
            {/* Front LED Safety Strip */}
            <line x1="20" y1="36" x2="28" y2="40" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      );

    case 'server':
    default:
      return (
        <div
          className={`relative flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${className}`}
          style={{ width: w, height: h }}
        >
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full drop-shadow-[0_4px_8px_rgba(30,41,59,0.25)]">
            <defs>
              <linearGradient id="g-srv-top" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="100%" stopColor="#1E293B" />
              </linearGradient>
            </defs>
            <rect x="12" y="10" width="40" height="12" rx="3" fill="url(#g-srv-top)" />
            <rect x="12" y="26" width="40" height="12" rx="3" fill="url(#g-srv-top)" />
            <rect x="12" y="42" width="40" height="12" rx="3" fill="url(#g-srv-top)" />
            {/* LED indicators */}
            <circle cx="18" cy="16" r="1.5" fill="#10B981" />
            <circle cx="23" cy="16" r="1.5" fill="#38BDF8" />
            <circle cx="18" cy="32" r="1.5" fill="#10B981" />
            <circle cx="23" cy="32" r="1.5" fill="#38BDF8" />
            <circle cx="18" cy="48" r="1.5" fill="#10B981" />
            <circle cx="23" cy="48" r="1.5" fill="#38BDF8" />
            {/* Drive vent slots */}
            <line x1="32" y1="16" x2="46" y2="16" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="32" y1="32" x2="46" y2="32" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="32" y1="48" x2="46" y2="48" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      );
  }
};
