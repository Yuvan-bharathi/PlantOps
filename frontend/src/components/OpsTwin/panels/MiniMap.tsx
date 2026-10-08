import React, { useEffect, useRef } from 'react';
import { CameraApi } from '../sceneKit';
import { BACK_Z, FENCE_Z, HALF_W, ROAD_Z, SITE_DEFS, WORLD_BOUNDS } from '../yard/layout';

export interface MiniMapDots {
  trucks: [number, number][];
  forklifts: [number, number][];
  alerts: [number, number][];
  selected?: [number, number] | null;
}

const W = 230;
const H = 140;
const PAD = 6;
const spanX = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
const spanZ = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanZ);
const ox = (W - spanX * scale) / 2;
const oz = (H - spanZ * scale) / 2;
const toPx = (x: number, z: number): [number, number] => [ox + (x - WORLD_BOUNDS.minX) * scale, oz + (z - WORLD_BOUNDS.minZ) * scale];
const toWorld = (px: number, py: number): [number, number] => [(px - ox) / scale + WORLD_BOUNDS.minX, (py - oz) / scale + WORLD_BOUNDS.minZ];

/** 2D overview of the whole plant with the current view footprint; click to jump there. */
export const MiniMap: React.FC<{ camera: React.RefObject<CameraApi>; dots: () => MiniMapDots; dark: boolean }> = ({ camera, dots, dark }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef(dots);
  dotsRef.current = dots;

  useEffect(() => {
    const draw = () => {
      const c = canvas.current;
      const g = c?.getContext('2d');
      if (!c || !g) return;
      const dpr = window.devicePixelRatio || 1;
      if (c.width !== W * dpr) {
        c.width = W * dpr;
        c.height = H * dpr;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.fillStyle = dark ? '#0F172A' : '#E8EEF6';
      g.fillRect(0, 0, W, H);
      // public roads
      g.fillStyle = dark ? '#334155' : '#C3CEDD';
      for (const r of [0, 1]) {
        const [, y] = toPx(0, r * 104 - 52 + ROAD_Z);
        g.fillRect(0, y - 6 * scale, W, 12 * scale);
      }
      // sites + buildings
      for (const s of SITE_DEFS) {
        const [x0, y0] = toPx(s.origin[0] - HALF_W, s.origin[2] + BACK_Z);
        const [x1, y1] = toPx(s.origin[0] + HALF_W, s.origin[2] + FENCE_Z);
        g.fillStyle = dark ? '#1E293B' : '#F8FAFC';
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.fillStyle = dark ? '#3B82F6' : '#2F6FED';
        for (const b of s.buildings) {
          const [bx0, by0] = toPx(s.origin[0] + b.x - b.width / 2, s.origin[2] - b.depth);
          const [bx1, by1] = toPx(s.origin[0] + b.x + b.width / 2, s.origin[2]);
          g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
        }
        g.fillStyle = dark ? '#CBD5E1' : '#475569';
        g.font = 'bold 8px Inter, Arial, sans-serif';
        g.fillText(s.code, x0 + 2, y1 - 2);
      }
      const d = dotsRef.current();
      const dot = (p: [number, number], r: number, color: string) => {
        const [x, y] = toPx(p[0], p[1]);
        g.fillStyle = color;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      };
      d.forklifts.forEach((p) => dot(p, 1.4, '#F59E0B'));
      d.trucks.forEach((p) => dot(p, 2, dark ? '#E2E8F0' : '#1E293B'));
      d.alerts.forEach((p) => {
        const [x, y] = toPx(p[0], p[1]);
        g.strokeStyle = '#EF4444';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(x, y, 4 + (Date.now() % 1200) / 400, 0, Math.PI * 2);
        g.stroke();
      });
      if (d.selected) dot(d.selected, 3, '#2563EB');
      // current view footprint
      const v = camera.current?.getView();
      if (v) {
        g.strokeStyle = '#2563EB';
        g.fillStyle = 'rgba(37,99,235,0.12)';
        g.lineWidth = 1.5;
        g.beginPath();
        v.corners.forEach(([x0, z0], i) => {
          // keep the outline inside the plant even when the view reaches the horizon
          const x = Math.max(WORLD_BOUNDS.minX - 20, Math.min(WORLD_BOUNDS.maxX + 20, x0));
          const z = Math.max(WORLD_BOUNDS.minZ - 20, Math.min(WORLD_BOUNDS.maxZ + 20, z0));
          const [px, py] = toPx(x, z);
          if (i) g.lineTo(px, py);
          else g.moveTo(px, py);
        });
        g.closePath();
        g.fill();
        g.stroke();
      }
    };
    draw();
    const id = window.setInterval(draw, 250);
    return () => window.clearInterval(id);
  }, [camera, dark]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-1 shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
      <canvas
        ref={canvas}
        style={{ width: W, height: H, display: 'block', cursor: 'crosshair', borderRadius: 12 }}
        onClick={(e) => {
          const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
          const [x, z] = toWorld(e.clientX - r.left, e.clientY - r.top);
          camera.current?.panTo([x, 0, z]);
        }}
        title="Click to jump there"
      />
    </div>
  );
};
