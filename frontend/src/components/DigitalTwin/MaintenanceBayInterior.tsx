import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Asset } from './GLBAsset';
import { Machine, WorkOrder, TelemetryData } from '../../types';

const FACTORY_KIT = '/models/kenney-factory-kit';

interface MaintenanceBayInteriorProps {
  cx: number;
  cz: number;
  visible: boolean;
  machines?: Machine[];
  workOrders?: WorkOrder[];
  liveTelemetry?: Record<string, TelemetryData>;
  onSelectMachine?: (m: Machine) => void;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. MAIN POWER & ELECTRICAL ZONE + OSHA LOTO STATION (North-West)
 * ─────────────────────────────────────────────────────────────────────────────
 */
const MainPowerAndLOTOZone: React.FC = () => {
  const ledRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ledRef.current) return;
    const t = state.clock.elapsedTime;
    const mat = ledRef.current.material as THREE.MeshStandardMaterial;
    if (mat && 'emissiveIntensity' in mat) {
      mat.emissiveIntensity = 0.8 + Math.sin(t * 3) * 0.4;
    }
  });

  return (
    <group position={[-6.2, 0, -6.8]}>
      {/* Zone Floor Perimeter Stripe (Yellow/Black Safety Boundary) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[5.2, 3.2]} />
        <meshBasicMaterial color="#E2E8F0" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 1.55]}>
        <planeGeometry args={[5.2, 0.1]} />
        <meshBasicMaterial color="#F59E0B" />
      </mesh>

      {/* Main MCC Electrical Distribution Cabinets (3 Bay Enclosure) */}
      {[-1.5, 0, 1.5].map((x, idx) => (
        <group key={idx} position={[x, 0, -0.6]}>
          {/* Main Cabinet Body */}
          <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.3, 3.2, 0.7]} />
            <meshStandardMaterial color="#475569" metalness={0.65} roughness={0.4} />
          </mesh>
          {/* Darker Inset Door Panels */}
          <mesh position={[0, 1.6, 0.36]}>
            <boxGeometry args={[1.15, 3.0, 0.04]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Chrome Door Handle */}
          <mesh position={[0.45, 1.6, 0.4]}>
            <boxGeometry args={[0.04, 0.3, 0.06]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Ventilation Louvers at Top */}
          {[-0.2, 0, 0.2].map((ly, lIdx) => (
            <mesh key={lIdx} position={[0, 2.7 + ly * 0.15, 0.38]}>
              <boxGeometry args={[0.9, 0.04, 0.02]} />
              <meshStandardMaterial color="#1E293B" />
            </mesh>
          ))}
          {/* Status Indicator Lights on Cabinet Top Door */}
          <mesh position={[-0.3, 2.9, 0.39]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color="#22C55E" emissive="#22C55E" emissiveIntensity={1.2} />
          </mesh>
          <mesh ref={idx === 1 ? ledRef : undefined} position={[-0.15, 2.9, 0.39]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color="#EAB308" emissive="#EAB308" emissiveIntensity={0.9} />
          </mesh>
          <mesh position={[0.0, 2.9, 0.39]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={0.4} />
          </mesh>
        </group>
      ))}

      {/* Main 480V Power Isolator Lever (Center Cabinet) */}
      <group position={[0, 1.8, -0.2]}>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.25, 0.35, 0.08]} />
          <meshStandardMaterial color="#DC2626" />
        </mesh>
        <Asset url={`${FACTORY_KIT}/lever-single.glb`} position={[0, -0.05, 0.05]} scale={1.3} />
        <mesh position={[0, 0.22, 0.02]}>
          <planeGeometry args={[0.22, 0.08]} />
          <meshBasicMaterial color="#FEF08A" />
        </mesh>
      </group>

      {/* High-Voltage Danger Signage (Wall mounted) */}
      <Asset url={`${FACTORY_KIT}/warning-orange.glb`} position={[2.1, 2.6, -0.9]} scale={1.1} />

      {/* Wall Cable Conduit Tray (Slim & Clean against back wall) */}
      <mesh position={[0, 3.25, -0.9]}>
        <boxGeometry args={[4.8, 0.12, 0.15]} />
        <meshStandardMaterial color="#64748B" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* ── OSHA 1910.147 LOTO SHADOW BOARD ── */}
      <group position={[2.5, 1.5, -0.65]}>
        {/* Red Backing Board */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[1.4, 1.8, 0.06]} />
          <meshStandardMaterial color="#DC2626" roughness={0.4} />
        </mesh>
        {/* Header Strip */}
        <mesh position={[0, 0.72, 0.035]}>
          <planeGeometry args={[1.25, 0.22]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        {/* Padlock Hooks & Digital Padlocks */}
        {[-0.4, -0.13, 0.13, 0.4].map((px, pIdx) => (
          <group key={pIdx} position={[px, 0.2, 0.04]}>
            {/* Shackle */}
            <mesh position={[0, 0.12, 0]}>
              <torusGeometry args={[0.05, 0.015, 8, 16, Math.PI]} />
              <meshStandardMaterial color="#CBD5E1" metalness={0.9} />
            </mesh>
            {/* Solid Padlock Body */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.12, 0.16, 0.06]} />
              <meshStandardMaterial color={pIdx % 2 === 0 ? '#EF4444' : '#F59E0B'} roughness={0.3} />
            </mesh>
            {/* Yellow Inspection Tag Hanging Below */}
            <mesh position={[0, -0.18, 0.02]} rotation={[0, 0, 0.1]}>
              <planeGeometry args={[0.1, 0.16]} />
              <meshStandardMaterial color="#FEF08A" />
            </mesh>
          </group>
        ))}
        {/* Lockout Hasps on Lower Shelf */}
        <Asset url={`${FACTORY_KIT}/lever-double.glb`} position={[-0.3, -0.45, 0.08]} scale={0.9} />
        <Asset url={`${FACTORY_KIT}/lever-double.glb`} position={[0.3, -0.45, 0.08]} scale={0.9} />
        {/* LOTO Procedure Document Sheet */}
        <mesh position={[0, -0.48, 0.04]}>
          <planeGeometry args={[0.38, 0.42]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      </group>
    </group>
  );
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. MONITORING & SCADA CONTROL DESK ZONE (North-East)
 * ─────────────────────────────────────────────────────────────────────────────
 */
const MonitoringAndSCADAZone: React.FC<{
  machines?: Machine[];
  workOrders?: WorkOrder[];
  liveTelemetry?: Record<string, TelemetryData>;
}> = ({ machines = [], workOrders = [], liveTelemetry = {} }) => {
  const activeWO = workOrders[0];
  const runningCount = machines.filter((m) => m.status === 'RUNNING').length || 20;
  const faultCount = machines.filter((m) => m.status === 'FAULT').length || 1;
  const cnc01Telemetry = liveTelemetry['CNC-01'] || { temperature: 58.2, vibration: 2.1, pressure: 5.4 };

  return (
    <group position={[5.2, 0, -6.8]}>
      {/* Floor Mat Boundary */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[4.6, 3.2]} />
        <meshBasicMaterial color="#E2E8F0" />
      </mesh>

      {/* Ergonomic Heavy Wide Control Desk with Grounded Legs */}
      <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 0.08, 1.2]} />
        <meshStandardMaterial color="#1E293B" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Desk Steel Frame Legs (Grounded firmly at y=0) */}
      {[[-1.6, -0.45], [-1.6, 0.45], [1.6, -0.45], [1.6, 0.45]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.47, lz]}>
          <cylinderGeometry args={[0.04, 0.04, 0.95, 8]} />
          <meshStandardMaterial color="#64748B" metalness={0.8} />
        </mesh>
      ))}

      {/* ── Screen 1 (Left): PLANT FLEET STATUS OVERVIEW ── */}
      <group position={[-1.1, 1.6, -0.15]} rotation={[0, 0.18, 0]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.95, 0.65, 0.05]} />
          <meshStandardMaterial color="#0F172A" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.028]}>
          <planeGeometry args={[0.88, 0.58]} />
          <meshBasicMaterial color="#020617" />
        </mesh>
        <mesh position={[0, -0.38, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.25, 8]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <Html transform scale={0.06} position={[0, 0, 0.035]} className="pointer-events-none select-none">
          <div className="w-[180px] p-2 bg-slate-950/95 text-white font-mono text-[8px] rounded border border-slate-700 space-y-1">
            <div className="font-extrabold text-blue-400 border-b border-slate-700 pb-0.5 flex justify-between">
              <span>PLANT OVERVIEW</span>
              <span className="text-emerald-400">ONLINE</span>
            </div>
            <div className="space-y-0.5 text-[7px]">
              <div className="flex justify-between"><span>RUNNING UNITS:</span><strong className="text-emerald-400">{runningCount}</strong></div>
              <div className="flex justify-between"><span>ACTIVE FAULTS:</span><strong className="text-red-400">{faultCount}</strong></div>
              <div className="flex justify-between"><span>MQTT BROKER:</span><span className="text-cyan-400">1883 [OK]</span></div>
              <div className="flex justify-between"><span>TIMESCALE DB:</span><span className="text-purple-400">STREAMING</span></div>
            </div>
          </div>
        </Html>
      </group>

      {/* ── Screen 2 (Center): LIVE TELEMETRY CHANNELS & WAVEFORM ── */}
      <group position={[0, 1.68, -0.2]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[1.1, 0.75, 0.05]} />
          <meshStandardMaterial color="#0F172A" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.028]}>
          <planeGeometry args={[1.02, 0.68]} />
          <meshBasicMaterial color="#020617" />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.28, 8]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <Html transform scale={0.065} position={[0, 0, 0.035]} className="pointer-events-none select-none">
          <div className="w-[200px] p-2 bg-slate-950/95 text-white font-mono text-[8px] rounded border border-cyan-800 space-y-1">
            <div className="font-extrabold text-cyan-400 border-b border-cyan-800 pb-0.5 flex justify-between">
              <span>IOT TELEMETRY</span>
              <span className="text-amber-400">100 Hz</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[7px] pt-0.5">
              <div className="bg-slate-900 p-1 rounded">TEMP: <strong className="text-orange-400">{cnc01Telemetry.temperature?.toFixed(1)}°C</strong></div>
              <div className="bg-slate-900 p-1 rounded">VIB: <strong className="text-cyan-300">{cnc01Telemetry.vibration?.toFixed(2)}mm/s</strong></div>
              <div className="bg-slate-900 p-1 rounded">PRES: <strong className="text-emerald-300">{cnc01Telemetry.pressure?.toFixed(1)}bar</strong></div>
              <div className="bg-slate-900 p-1 rounded">AI DIAG: <strong className="text-purple-300">GROQ 70B</strong></div>
            </div>
          </div>
        </Html>
      </group>

      {/* ── Screen 3 (Right): ACTIVE WORK ORDERS & TECHNICIAN DISPATCH ── */}
      <group position={[1.1, 1.6, -0.15]} rotation={[0, -0.18, 0]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.95, 0.65, 0.05]} />
          <meshStandardMaterial color="#0F172A" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.028]}>
          <planeGeometry args={[0.88, 0.58]} />
          <meshBasicMaterial color="#020617" />
        </mesh>
        <mesh position={[0, -0.38, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.25, 8]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <Html transform scale={0.06} position={[0, 0, 0.035]} className="pointer-events-none select-none">
          <div className="w-[180px] p-2 bg-slate-950/95 text-white font-mono text-[8px] rounded border border-slate-700 space-y-1">
            <div className="font-extrabold text-amber-400 border-b border-slate-700 pb-0.5 flex justify-between">
              <span>ACTIVE WO QUEUE</span>
              <span className="text-blue-400 font-bold">{activeWO?.id || 'WO-1082'}</span>
            </div>
            <div className="space-y-0.5 text-[7px]">
              <div>TARGET: <strong>{activeWO?.machine_code || 'CNC-01'}</strong></div>
              <div>LEAD TECH: <strong>Frank Moore</strong></div>
              <div className="text-emerald-400">LOTO: <strong>VERIFIED (PL-8894)</strong></div>
              <div className="text-cyan-300">SOP RAG: <strong>READY</strong></div>
            </div>
          </div>
        </Html>
      </group>

      {/* Desk Peripherals: Keyboard, Optical Mouse, Rugged Tablet */}
      <mesh position={[0, 1.0, 0.2]}>
        <boxGeometry args={[0.55, 0.02, 0.18]} />
        <meshStandardMaterial color="#0F172A" roughness={0.3} />
      </mesh>
      <mesh position={[0.4, 1.0, 0.2]}>
        <boxGeometry args={[0.08, 0.02, 0.12]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[-0.8, 1.01, 0.15]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.22]} />
        <meshStandardMaterial color="#EAB308" metalness={0.2} roughness={0.5} />
      </mesh>

      {/* Ergonomic Office Mesh Chair */}
      <group position={[0, 0, 0.8]}>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.08, 16]} />
          <meshStandardMaterial color="#1E293B" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.8, -0.22]}>
          <boxGeometry args={[0.45, 0.55, 0.06]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.45, 8]} />
          <meshStandardMaterial color="#64748B" metalness={0.9} />
        </mesh>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.04, 5]} />
          <meshStandardMaterial color="#0F172A" />
        </mesh>
      </group>
    </group>
  );
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. SPARE PARTS MULTI-TIER STORAGE RACKS & INVENTORY (West Wall)
 * ─────────────────────────────────────────────────────────────────────────────
 */
const SparePartsStorageZone: React.FC = () => {
  const rackCategories = [
    { label: 'BEARINGS (SKF-6205)', color: '#2563EB' },
    { label: 'PUMPS & SEALS', color: '#059669' },
    { label: 'VALVES & HYDRAULIC', color: '#DC2626' },
    { label: 'MOTORS & SERVOS', color: '#D97706' },
  ];

  return (
    <group position={[-9.2, 0, -1.0]}>
      {/* Heavy-Duty 4-Tier Steel Storage Racks (Two Double Units) */}
      {[-2.0, 2.0].map((rz, rIdx) => (
        <group key={rIdx} position={[0, 0, rz]}>
          {/* 4 Vertical Steel Uprights */}
          {[[-0.6, -1.6], [-0.6, 1.6], [0.6, -1.6], [0.6, 1.6]].map(([ux, uz], uIdx) => (
            <mesh key={uIdx} position={[ux, 2.1, uz]} castShadow>
              <boxGeometry args={[0.08, 4.2, 0.08]} />
              <meshStandardMaterial color="#1E3A8A" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}

          {/* 4 Horizontal Cross Beams & Shelves */}
          {[0.5, 1.5, 2.5, 3.5].map((sy, sIdx) => (
            <group key={sIdx} position={[0, sy, 0]}>
              {/* Shelf Base Board */}
              <mesh position={[0, 0, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.2, 0.05, 3.2]} />
                <meshStandardMaterial color="#D97706" metalness={0.1} roughness={0.7} />
              </mesh>
              {/* Front Safety Orange Edge Lip */}
              <mesh position={[0.6, 0.04, 0]}>
                <boxGeometry args={[0.02, 0.08, 3.2]} />
                <meshStandardMaterial color="#EA580C" metalness={0.6} />
              </mesh>
              <mesh position={[-0.6, 0.04, 0]}>
                <boxGeometry args={[0.02, 0.08, 3.2]} />
                <meshStandardMaterial color="#EA580C" metalness={0.6} />
              </mesh>

              {/* Shelf Stored Components */}
              {sIdx === 0 && (
                <>
                  <Asset url={`${FACTORY_KIT}/machine.glb`} position={[0, 0.05, -0.8]} scale={1.1} />
                  <Asset url={`${FACTORY_KIT}/machine.glb`} position={[0, 0.05, 0.8]} scale={1.1} />
                </>
              )}
              {sIdx === 1 && (
                <>
                  <Asset url={`${FACTORY_KIT}/pipe-large-valve.glb`} position={[0, 0.05, -0.8]} scale={1.0} />
                  <Asset url={`${FACTORY_KIT}/pipe-large-valve.glb`} position={[0, 0.05, 0.2]} scale={1.0} />
                  <Asset url={`${FACTORY_KIT}/box-small.glb`} position={[0, 0.05, 1.0]} scale={1.3} />
                </>
              )}
              {sIdx === 2 && (
                <>
                  {[-1.0, -0.5, 0.0, 0.5, 1.0].map((bx, bIdx) => (
                    <group key={bIdx} position={[0, 0.15, bx]}>
                      <mesh castShadow>
                        <boxGeometry args={[0.4, 0.25, 0.35]} />
                        <meshStandardMaterial color={bIdx % 2 === 0 ? '#1D4ED8' : '#B45309'} roughness={0.5} />
                      </mesh>
                      <mesh position={[0.21, 0, 0]}>
                        <planeGeometry args={[0.15, 0.15]} />
                        <meshBasicMaterial color="#FFFFFF" />
                      </mesh>
                    </group>
                  ))}
                </>
              )}
              {sIdx === 3 && (
                <>
                  <Asset url={`${FACTORY_KIT}/piston-round.glb`} position={[0, 0.05, -0.8]} scale={1.0} />
                  <Asset url={`${FACTORY_KIT}/piston-square.glb`} position={[0, 0.05, 0.1]} scale={1.0} />
                  <Asset url={`${FACTORY_KIT}/box-small.glb`} position={[0, 0.05, 0.9]} scale={1.2} />
                </>
              )}
            </group>
          ))}

          {/* Category Banner Sign on Top */}
          <group position={[0, 4.3, 0]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.8, 0.3, 2.2]} />
              <meshStandardMaterial color="#0F172A" />
            </mesh>
            <Html transform scale={0.07} position={[0.42, 0, 0]} rotation={[0, Math.PI / 2, 0]} className="pointer-events-none select-none">
              <div className="px-2 py-0.5 bg-blue-900 text-yellow-300 font-mono text-[9px] font-extrabold rounded border border-blue-400 whitespace-nowrap">
                {rackCategories[rIdx]?.label || 'SPARE PARTS'}
              </div>
            </Html>
          </group>
        </group>
      ))}

      {/* Wooden Pallets Staged Neatly with Replacement Assemblies (NO huge pipes) */}
      <group position={[1.4, 0, 0]}>
        <group position={[0, 0, -1.2]}>
          <mesh position={[0, 0.08, 0]} castShadow>
            <boxGeometry args={[1.3, 0.16, 1.3]} />
            <meshStandardMaterial color="#92400E" roughness={0.9} />
          </mesh>
          <Asset url={`${FACTORY_KIT}/machine.glb`} position={[0, 0.16, 0]} scale={1.3} />
        </group>
        <group position={[0, 0, 1.2]}>
          <mesh position={[0, 0.08, 0]} castShadow>
            <boxGeometry args={[1.3, 0.16, 1.3]} />
            <meshStandardMaterial color="#92400E" roughness={0.9} />
          </mesh>
          <Asset url={`${FACTORY_KIT}/machine-bed.glb`} position={[0, 0.16, 0]} scale={1.2} />
        </group>
      </group>
    </group>
  );
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 4. REPAIR WORKSHOP — BENCH-01 MECHANICAL REPAIR (Center-West)
 * ─────────────────────────────────────────────────────────────────────────────
 */
const MechanicalRepairStation: React.FC = () => {
  return (
    <group position={[-6.0, 0, -3.8]}>
      {/* Heavy Steel Pegboard Wall Panel */}
      <group position={[0, 2.2, -1.1]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[3.2, 1.8, 0.06]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
        </mesh>
        {/* Wrench Array */}
        {[-1.2, -0.9, -0.6, -0.3, 0.0].map((wx, i) => (
          <group key={i} position={[wx, 0.25, 0.04]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.04, 0.32 + i * 0.05, 0.02]} />
              <meshStandardMaterial color="#CBD5E1" metalness={0.95} roughness={0.1} />
            </mesh>
            <mesh position={[0, 0.16 + i * 0.025, 0]}>
              <ringGeometry args={[0.02, 0.04, 8]} />
              <meshStandardMaterial color="#CBD5E1" metalness={0.95} />
            </mesh>
          </group>
        ))}
        {/* Calibrated Torque Wrench */}
        <group position={[0.4, 0.35, 0.05]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.05, 0.65, 0.03]} />
            <meshStandardMaterial color="#2563EB" metalness={0.6} />
          </mesh>
          <mesh position={[0, 0.25, 0.02]}>
            <cylinderGeometry args={[0.04, 0.04, 0.03, 12]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.9} />
          </mesh>
        </group>
        {/* Heavy Ball-Peen Hammer */}
        <group position={[0.85, 0.35, 0.05]} rotation={[0, 0, 0.15]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.48, 8]} />
            <meshStandardMaterial color="#B45309" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.24, 0]}>
            <boxGeometry args={[0.18, 0.08, 0.08]} />
            <meshStandardMaterial color="#1E293B" metalness={0.8} />
          </mesh>
        </group>
        {/* Screwdrivers */}
        {[1.2, 1.35].map((sx, si) => (
          <group key={si} position={[sx, 0.25, 0.04]}>
            <mesh position={[0, 0.1, 0]}>
              <boxGeometry args={[0.03, 0.12, 0.03]} />
              <meshStandardMaterial color="#DC2626" />
            </mesh>
            <mesh position={[0, -0.1, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.28, 6]} />
              <meshStandardMaterial color="#E2E8F0" metalness={0.9} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Heavy Red Rolling Tool Chest (Grounded firmly at y=0) */}
      <group position={[-2.2, 0, 0.5]} rotation={[0, 0.25, 0]}>
        <mesh position={[0, 0.65, 0]} castShadow>
          <boxGeometry args={[0.85, 1.2, 0.55]} />
          <meshStandardMaterial color="#DC2626" metalness={0.3} roughness={0.4} />
        </mesh>
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((dy, di) => (
          <mesh key={di} position={[0, dy, 0.28]}>
            <boxGeometry args={[0.7, 0.03, 0.04]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.9} />
          </mesh>
        ))}
        <mesh position={[-0.45, 1.15, 0]}>
          <boxGeometry args={[0.1, 0.03, 0.4]} />
          <meshStandardMaterial color="#1E293B" />
        </mesh>
        {[[-0.35, -0.2], [-0.35, 0.2], [0.35, -0.2], [0.35, 0.2]].map(([cx, cz], ci) => (
          <mesh key={ci} position={[cx, 0.05, cz]}>
            <cylinderGeometry args={[0.05, 0.05, 0.04, 10]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
        ))}
      </group>

      {/* Bench Vise Clamp (Positioned on the workbench top) */}
      <group position={[1.3, 1.08, -0.2]}>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 0.1, 12]} />
          <meshStandardMaterial color="#0F172A" metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.2, 0.12, 0.28]} />
          <meshStandardMaterial color="#1E293B" metalness={0.8} />
        </mesh>
        <mesh position={[0.07, 0.2, 0]}>
          <boxGeometry args={[0.05, 0.07, 0.22]} />
          <meshStandardMaterial color="#94A3B8" metalness={0.95} />
        </mesh>
        <mesh position={[-0.07, 0.2, 0]}>
          <boxGeometry args={[0.05, 0.07, 0.22]} />
          <meshStandardMaterial color="#94A3B8" metalness={0.95} />
        </mesh>
        <mesh position={[-0.16, 0.15, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.32, 8]} />
          <meshStandardMaterial color="#CBD5E1" metalness={0.9} />
        </mesh>
      </group>

      {/* Disassembled Spindle / Motor Under Repair (Resting on workbench top) */}
      <group position={[-0.2, 1.08, 0.1]}>
        <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.8, 16]} />
          <meshStandardMaterial color="#94A3B8" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0.25, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.14, 0.035, 12, 24]} />
          <meshStandardMaterial color="#F59E0B" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0.005, 0]}>
          <boxGeometry args={[1.1, 0.02, 0.6]} />
          <meshStandardMaterial color="#E2E8F0" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Multimeter */}
        <group position={[-0.45, 0.03, 0.15]} rotation={[0, 0.3, 0]}>
          <mesh>
            <boxGeometry args={[0.16, 0.035, 0.26]} />
            <meshStandardMaterial color="#EAB308" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.02, -0.05]}>
            <planeGeometry args={[0.11, 0.07]} />
            <meshBasicMaterial color="#22D3EE" />
          </mesh>
          <mesh position={[0.04, 0.018, 0.14]}>
            <cylinderGeometry args={[0.005, 0.005, 0.12, 6]} />
            <meshStandardMaterial color="#EF4444" />
          </mesh>
          <mesh position={[-0.04, 0.018, 0.14]}>
            <cylinderGeometry args={[0.005, 0.005, 0.12, 6]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
        </group>
      </group>
    </group>
  );
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 5. REPAIR WORKSHOP — BENCH-02 MOTOR & ELECTRICAL REBUILD (Center-East)
 * ─────────────────────────────────────────────────────────────────────────────
 */
const MotorAndElectricalRebuildStation: React.FC = () => {
  return (
    <group position={[6.0, 0, -3.8]}>
      {/* Heavy Dual Bench Grinder on Table */}
      <group position={[-1.2, 1.08, 0]}>
        {/* Grinder Motor Body */}
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.35, 12]} />
          <meshStandardMaterial color="#1E293B" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.2, 0.08, 0.2]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        {/* Left & Right Grinding Wheels with Guards */}
        {[-0.2, 0.2].map((gx, gi) => (
          <group key={gi} position={[gx, 0.12, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.15, 0.15, 0.04, 16]} />
              <meshStandardMaterial color="#475569" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.08, 0.05]}>
              <boxGeometry args={[0.06, 0.08, 0.08]} />
              <meshStandardMaterial color="#38BDF8" transparent opacity={0.6} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Granite Surface Inspection Plate with Dial Runout Indicator */}
      <group position={[0.4, 1.08, 0.1]}>
        {/* Black Granite Surface Block */}
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.7, 0.08, 0.5]} />
          <meshStandardMaterial color="#0F172A" roughness={0.1} metalness={0.2} />
        </mesh>
        {/* Magnetic Base & Articulated Arm */}
        <mesh position={[-0.2, 0.12, -0.1]}>
          <boxGeometry args={[0.08, 0.08, 0.08]} />
          <meshStandardMaterial color="#DC2626" />
        </mesh>
        <mesh position={[-0.2, 0.28, -0.05]} rotation={[0.2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.25, 6]} />
          <meshStandardMaterial color="#CBD5E1" metalness={0.9} />
        </mesh>
        {/* Dial Indicator Gauge Head */}
        <mesh position={[-0.2, 0.38, 0.05]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, 0.02, 16]} />
          <meshStandardMaterial color="#F8FAFC" metalness={0.8} />
        </mesh>
      </group>

      {/* Grease Gun & Chemical Spray Cans */}
      <group position={[1.2, 1.08, -0.2]}>
        <mesh position={[0, 0.1, 0]} rotation={[0.4, 0.3, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
          <meshStandardMaterial color="#EAB308" metalness={0.8} />
        </mesh>
        {/* Cleaning Spray Cans */}
        {[-0.15, 0.15].map((cx, ci) => (
          <mesh key={ci} position={[cx, 0.1, 0.15]}>
            <cylinderGeometry args={[0.025, 0.025, 0.18, 10]} />
            <meshStandardMaterial color={ci === 0 ? '#2563EB' : '#16A34A'} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 6. HYDRAULIC SHOP PRESS & COLUMN DRILL PRESS (East Wall / Front-Right)
 * ─────────────────────────────────────────────────────────────────────────────
 */
const HydraulicAndMachiningZone: React.FC = () => {
  return (
    <group position={[8.6, 0, 2.0]}>
      {/* ── 50-TON HEAVY HYDRAULIC SHOP PRESS ── */}
      <group position={[0, 0, -1.8]}>
        {/* Blue Heavy Steel H-Frame Uprights (Grounded at y=0) */}
        {[-0.55, 0.55].map((px, pi) => (
          <mesh key={pi} position={[px, 1.4, 0]} castShadow>
            <boxGeometry args={[0.12, 2.8, 0.2]} />
            <meshStandardMaterial color="#1D4ED8" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        {/* Top Cross Head Beam */}
        <mesh position={[0, 2.7, 0]} castShadow>
          <boxGeometry args={[1.3, 0.25, 0.25]} />
          <meshStandardMaterial color="#1E40AF" metalness={0.6} />
        </mesh>
        {/* Bottom Base Feet */}
        {[-0.55, 0.55].map((px, pi) => (
          <mesh key={pi} position={[px, 0.04, 0]}>
            <boxGeometry args={[0.14, 0.08, 0.7]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
        ))}
        {/* Adjustable Bolster Bed Table */}
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[1.15, 0.16, 0.35]} />
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>
        {/* V-Blocks on Bed Plate */}
        {[-0.25, 0.25].map((vx, vi) => (
          <mesh key={vi} position={[vx, 1.04, 0]}>
            <boxGeometry args={[0.16, 0.12, 0.2]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.9} />
          </mesh>
        ))}
        {/* Hydraulic Cylinder Ram */}
        <mesh position={[0, 2.1, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.95, 14]} />
          <meshStandardMaterial color="#CBD5E1" metalness={0.95} roughness={0.1} />
        </mesh>
        {/* Ram Piston Rod */}
        <mesh position={[0, 1.4, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.5, 12]} />
          <meshStandardMaterial color="#F8FAFC" metalness={0.99} roughness={0.05} />
        </mesh>
        {/* Pressure Dial Gauge (0 - 50 Ton / 0 - 500 Bar) */}
        <group position={[0.4, 2.5, 0.15]} rotation={[0, -0.3, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.03, 16]} />
            <meshStandardMaterial color="#F8FAFC" metalness={0.8} />
          </mesh>
          <mesh position={[0.016, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.11, 0.11]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>
        {/* Manual Hydraulic Hand Pump Lever */}
        <group position={[0.65, 1.3, 0]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.12, 0.35, 0.12]} />
            <meshStandardMaterial color="#DC2626" />
          </mesh>
          <mesh position={[0.08, 0.15, 0]} rotation={[0, 0, 0.6]}>
            <cylinderGeometry args={[0.012, 0.012, 0.45, 8]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.9} />
          </mesh>
        </group>
      </group>

      {/* ── HEAVY COLUMN DRILL PRESS ── */}
      <group position={[0, 0, 1.8]}>
        {/* Cast Iron Base Plate (Firmly on Floor y=0) */}
        <mesh position={[0, 0.06, 0]} castShadow>
          <boxGeometry args={[0.65, 0.12, 0.8]} />
          <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.4} />
        </mesh>
        {/* Precision Vertical Steel Column */}
        <mesh position={[0, 1.35, -0.2]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 2.6, 16]} />
          <meshStandardMaterial color="#CBD5E1" metalness={0.95} roughness={0.15} />
        </mesh>
        {/* Adjustable Drill Table */}
        <group position={[0, 1.1, 0.05]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.5, 0.08, 0.45]} />
            <meshStandardMaterial color="#334155" metalness={0.7} />
          </mesh>
          <mesh position={[0, -0.08, -0.22]}>
            <cylinderGeometry args={[0.1, 0.1, 0.12, 12]} />
            <meshStandardMaterial color="#1E293B" />
          </mesh>
        </group>
        {/* Cast Metal Head & Motor Housing at Top */}
        <group position={[0, 2.5, -0.05]}>
          <mesh position={[0, 0, 0]} castShadow>
            <boxGeometry args={[0.4, 0.45, 0.7]} />
            <meshStandardMaterial color="#059669" metalness={0.5} roughness={0.4} />
          </mesh>
          {/* Electric Motor at Rear */}
          <mesh position={[0, 0.1, -0.32]}>
            <cylinderGeometry args={[0.12, 0.12, 0.35, 12]} />
            <meshStandardMaterial color="#1E293B" />
          </mesh>
          {/* Drill Spindle Chuck & Bit */}
          <mesh position={[0, -0.32, 0.18]}>
            <cylinderGeometry args={[0.04, 0.04, 0.2, 10]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.95} />
          </mesh>
          <mesh position={[0, -0.48, 0.18]}>
            <cylinderGeometry args={[0.008, 0.008, 0.16, 6]} />
            <meshStandardMaterial color="#F8FAFC" metalness={0.99} />
          </mesh>
          {/* 3-Spoke Feed Handle */}
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((rad, ri) => (
            <mesh key={ri} position={[0.22, 0, 0.18]} rotation={[0, 0, rad]}>
              <cylinderGeometry args={[0.008, 0.008, 0.25, 6]} />
              <meshStandardMaterial color="#CBD5E1" metalness={0.9} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 7. TIG/MIG WELDING & FABRICATION BAY (Front-Right)
 * ─────────────────────────────────────────────────────────────────────────────
 */
const WeldingAndFabricationZone: React.FC = () => {
  return (
    <group position={[5.2, 0, 5.0]}>
      {/* Floor Demarcation for Hot Work Zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <planeGeometry args={[4.2, 3.4]} />
        <meshBasicMaterial color="#E2E8F0" />
      </mesh>

      {/* ── MOBILE WELDING CART WITH COMPRESSED GAS CYLINDERS ── */}
      <group position={[-1.2, 0, 0.2]} rotation={[0, 0.4, 0]}>
        {/* Welder Cart Base Frame with 4 Rubber Wheels */}
        <mesh position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[0.75, 0.1, 0.9]} />
          <meshStandardMaterial color="#1E293B" />
        </mesh>
        {[[-0.32, -0.38], [-0.32, 0.38], [0.32, -0.38], [0.32, 0.38]].map(([wx, wz], wi) => (
          <mesh key={wi} position={[wx, 0.07, wz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.05, 10]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
        ))}
        {/* Inverter Welder Unit Body (Miller Blue) */}
        <mesh position={[0, 0.55, 0.12]} castShadow>
          <boxGeometry args={[0.55, 0.65, 0.5]} />
          <meshStandardMaterial color="#0284C7" metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Welder Front Control Panel with Digital Current Display */}
        <mesh position={[0, 0.72, 0.38]}>
          <planeGeometry args={[0.18, 0.08]} />
          <meshBasicMaterial color="#EF4444" />
        </mesh>
        {/* Twin Industrial Gas Cylinders (Argon & CO2) */}
        {[-0.15, 0.15].map((cx, ci) => (
          <group key={ci} position={[cx, 0, -0.28]}>
            <mesh position={[0, 0.85, 0]} castShadow>
              <cylinderGeometry args={[0.11, 0.11, 1.5, 14]} />
              <meshStandardMaterial color={ci === 0 ? '#15803D' : '#64748B'} metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0, 1.65, 0]}>
              <sphereGeometry args={[0.11, 12, 12]} />
              <meshStandardMaterial color={ci === 0 ? '#15803D' : '#64748B'} metalness={0.7} />
            </mesh>
            {/* Brass Pressure Regulator & Flowmeter */}
            <mesh position={[0, 1.78, 0.06]}>
              <boxGeometry args={[0.08, 0.08, 0.08]} />
              <meshStandardMaterial color="#EAB308" metalness={0.9} />
            </mesh>
            <mesh position={[0, 1.88, 0.06]}>
              <cylinderGeometry args={[0.015, 0.015, 0.14, 8]} />
              <meshStandardMaterial color="#A5F3FC" transparent opacity={0.8} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ── HEAVY STEEL WELDING TABLE ── */}
      <group position={[0.8, 0, 0]}>
        {/* Heavy Perforated Steel Table Top */}
        <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.8, 0.1, 1.2]} />
          <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} />
        </mesh>
        {/* Table Steel Legs (Touching Floor at y=0) */}
        {[[-0.8, -0.5], [-0.8, 0.5], [0.8, -0.5], [0.8, 0.5]].map(([lx, lz], li) => (
          <mesh key={li} position={[lx, 0.47, lz]}>
            <boxGeometry args={[0.08, 0.95, 0.08]} />
            <meshStandardMaterial color="#1E293B" metalness={0.8} />
          </mesh>
        ))}
        {/* Welding Helmet / Mask on Table */}
        <group position={[-0.4, 1.1, 0.2]} rotation={[0, 0.5, 0]}>
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[0.22, 0.24, 0.24]} />
            <meshStandardMaterial color="#0F172A" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.08, 0.125]}>
            <planeGeometry args={[0.14, 0.08]} />
            <meshStandardMaterial color="#166534" roughness={0.1} />
          </mesh>
        </group>
        {/* Welding Torch Head & Ground Clamp */}
        <group position={[0.3, 1.02, -0.1]}>
          <mesh rotation={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.28, 6]} />
            <meshStandardMaterial color="#0284C7" />
          </mesh>
          <mesh position={[0.12, 0, 0.05]} rotation={[0, 0, Math.PI / 4]}>
            <cylinderGeometry args={[0.015, 0.008, 0.1, 8]} />
            <meshStandardMaterial color="#EAB308" metalness={0.9} />
          </mesh>
        </group>
      </group>

      {/* ── FREESTANDING AMBER UV WELDING SAFETY SCREEN ── */}
      <group position={[-0.4, 0, 1.5]}>
        {/* Steel Pipe Frame on Floor Casters */}
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[2.4, 0.04, 0.04]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        {[-1.15, 1.15].map((fx, fi) => (
          <group key={fi} position={[fx, 0, 0]}>
            <mesh position={[0, 1.0, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 2.0, 8]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
            <mesh position={[0, 0.03, 0]}>
              <boxGeometry args={[0.05, 0.06, 0.4]} />
              <meshStandardMaterial color="#1E293B" />
            </mesh>
          </group>
        ))}
        {/* Semi-Translucent Amber Flame-Retardant PVC Curtain */}
        <mesh position={[0, 1.05, 0]}>
          <planeGeometry args={[2.2, 1.8]} />
          <meshStandardMaterial color="#D97706" transparent opacity={0.7} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 8. FLUID & CHEMICAL CONTAINMENT + SPILL RESPONSE STATION (Front-Left)
 * ─────────────────────────────────────────────────────────────────────────────
 */
const FluidContainmentZone: React.FC = () => {
  return (
    <group position={[-6.0, 0, 4.8]}>
      {/* ── SPILL CONTAINMENT BUND PALLET ── */}
      <group position={[0, 0, 0]}>
        {/* Heavy Safety Yellow Polyethylene Sump Base */}
        <mesh position={[0, 0.18, 0]} castShadow>
          <boxGeometry args={[2.2, 0.36, 1.4]} />
          <meshStandardMaterial color="#EAB308" roughness={0.4} />
        </mesh>
        {/* Galvanized Steel Floor Grating */}
        <mesh position={[0, 0.37, 0]}>
          <boxGeometry args={[2.1, 0.02, 1.3]} />
          <meshStandardMaterial color="#64748B" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* 55-Gallon Steel Oil Drum 1 (Blue - ISO VG 68 Hydraulic Oil) */}
        <group position={[-0.55, 0.38, 0]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 1.0, 16]} />
            <meshStandardMaterial color="#1D4ED8" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Drum Reinforcing Ribs */}
          {[-0.2, 0.2].map((ry, ri) => (
            <mesh key={ri} position={[0, 0.5 + ry, 0]}>
              <torusGeometry args={[0.305, 0.015, 6, 16]} />
              <meshStandardMaterial color="#1E3A8A" />
            </mesh>
          ))}
          {/* Chrome Rotary Hand Barrel Pump */}
          <group position={[0.15, 1.02, 0]}>
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
              <meshStandardMaterial color="#CBD5E1" metalness={0.95} />
            </mesh>
            <mesh position={[0.08, 0.45, 0]}>
              <boxGeometry args={[0.12, 0.08, 0.08]} />
              <meshStandardMaterial color="#DC2626" />
            </mesh>
            <mesh position={[0.08, 0.45, 0.08]} rotation={[0.4, 0, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
              <meshStandardMaterial color="#0F172A" />
            </mesh>
          </group>
        </group>

        {/* 55-Gallon Steel Oil Drum 2 (Green - Synthetic Gear Oil) */}
        <group position={[0.55, 0.38, 0]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 1.0, 16]} />
            <meshStandardMaterial color="#059669" metalness={0.7} roughness={0.3} />
          </mesh>
          {[-0.2, 0.2].map((ry, ri) => (
            <mesh key={ri} position={[0, 0.5 + ry, 0]}>
              <torusGeometry args={[0.305, 0.015, 6, 16]} />
              <meshStandardMaterial color="#047857" />
            </mesh>
          ))}
          <group position={[-0.15, 1.02, 0]}>
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
              <meshStandardMaterial color="#CBD5E1" metalness={0.95} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ── WHEELED OIL SPILL RESPONSE KIT BIN ── */}
      <group position={[1.8, 0, -0.2]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.65, 1.0, 0.55]} />
          <meshStandardMaterial color="#FACC15" roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.06, 0]}>
          <boxGeometry args={[0.68, 0.06, 0.58]} />
          <meshStandardMaterial color="#CA8A04" />
        </mesh>
        <mesh position={[0, 0.65, 0.28]}>
          <planeGeometry args={[0.4, 0.3]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
        {/* Wheels */}
        {[-0.28, 0.28].map((wx, wi) => (
          <mesh key={wi} position={[wx, 0.08, -0.24]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, 0.05, 10]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
        ))}
      </group>

      {/* ── 10KG INDUSTRIAL CO2 / DRY POWDER FIRE EXTINGUISHER ── */}
      <group position={[-1.7, 0, -0.2]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.75, 14]} />
          <meshStandardMaterial color="#DC2626" roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.85, 0]}>
          <sphereGeometry args={[0.11, 10, 10]} />
          <meshStandardMaterial color="#DC2626" />
        </mesh>
        {/* Brass Valve Head & Black Discharge Horn */}
        <mesh position={[0, 0.96, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.08, 8]} />
          <meshStandardMaterial color="#CBD5E1" metalness={0.9} />
        </mesh>
        <mesh position={[0.08, 0.88, 0.06]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.015, 0.25, 8]} />
          <meshStandardMaterial color="#0F172A" />
        </mesh>
      </group>
    </group>
  );
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 9. BATTERY CHARGING, UPS & SAFETY EYEWASH STATION (West Wall Front)
 * ─────────────────────────────────────────────────────────────────────────────
 */
const BatteryAndSafetyZone: React.FC = () => {
  return (
    <group position={[-9.2, 0, 4.8]}>
      {/* ── UPS & BACKUP BATTERY CHARGING RACK ── */}
      <group position={[0, 0, -1.0]}>
        {/* 2-Tier Steel Rack Frame */}
        {[-0.5, 0.5].map((rx, ri) => (
          <mesh key={ri} position={[rx, 0.8, 0]}>
            <boxGeometry args={[0.06, 1.6, 0.6]} />
            <meshStandardMaterial color="#334155" metalness={0.7} />
          </mesh>
        ))}
        {/* Shelves */}
        {[0.3, 0.9].map((sy, si) => (
          <group key={si} position={[0, sy, 0]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[1.0, 0.04, 0.55]} />
              <meshStandardMaterial color="#1E293B" />
            </mesh>
            {/* Battery Modules with Terminals */}
            {[-0.26, 0.26].map((bx, bi) => (
              <group key={bi} position={[bx, 0.16, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.38, 0.28, 0.45]} />
                  <meshStandardMaterial color="#0F172A" roughness={0.4} />
                </mesh>
                {/* Red & Black Terminals */}
                <mesh position={[-0.1, 0.15, 0.1]}>
                  <cylinderGeometry args={[0.015, 0.015, 0.03, 8]} />
                  <meshStandardMaterial color="#EF4444" />
                </mesh>
                <mesh position={[0.1, 0.15, 0.1]}>
                  <cylinderGeometry args={[0.015, 0.015, 0.03, 8]} />
                  <meshStandardMaterial color="#000000" />
                </mesh>
              </group>
            ))}
          </group>
        ))}
        {/* Smart Charging Unit with Digital Display */}
        <group position={[0, 1.65, 0]}>
          <mesh>
            <boxGeometry args={[0.65, 0.25, 0.35]} />
            <meshStandardMaterial color="#475569" metalness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.18]}>
            <planeGeometry args={[0.2, 0.08]} />
            <meshBasicMaterial color="#22C55E" />
          </mesh>
        </group>
      </group>

      {/* ── OSHA EMERGENCY EYEWASH & SAFETY STATION ── */}
      <group position={[0, 0, 1.2]}>
        {/* Safety Green Pedestal Stand (Grounded at y=0) */}
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.1, 10]} />
          <meshStandardMaterial color="#16A34A" />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.04, 12]} />
          <meshStandardMaterial color="#15803D" />
        </mesh>
        {/* Stainless Steel Eyewash Catchment Bowl */}
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.22, 0.16, 0.14, 16]} />
          <meshStandardMaterial color="#E2E8F0" metalness={0.9} roughness={0.15} />
        </mesh>
        {/* Dual Aerated Spray Heads */}
        {[-0.06, 0.06].map((sx, si) => (
          <mesh key={si} position={[sx, 1.19, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.04, 8]} />
            <meshStandardMaterial color="#EAB308" metalness={0.8} />
          </mesh>
        ))}
        {/* Large Push Flag Actuator Handle */}
        <mesh position={[0.24, 1.12, 0]}>
          <boxGeometry args={[0.02, 0.12, 0.12]} />
          <meshStandardMaterial color="#EAB308" />
        </mesh>
        {/* Wall First Aid & Burn Care Cabinet */}
        <group position={[-0.4, 1.6, 0]}>
          <mesh position={[0, 0, 0]} castShadow>
            <boxGeometry args={[0.1, 0.45, 0.35]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.2} />
          </mesh>
          <mesh position={[0.052, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.2, 0.2]} />
            <meshBasicMaterial color="#16A34A" />
          </mesh>
        </group>
      </group>
    </group>
  );
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 10. TEST & DIAGNOSTIC WORKSTATION ZONE (TEST-01) — (Center-South)
 * ─────────────────────────────────────────────────────────────────────────────
 */
const TestAndDiagnosticZone: React.FC = () => {
  const waveRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!waveRef.current) return;
    const t = state.clock.elapsedTime;
    const mat = waveRef.current.material as THREE.MeshBasicMaterial;
    if (mat) {
      mat.opacity = 0.7 + Math.sin(t * 8) * 0.3;
    }
  });

  return (
    <group position={[0.0, 0, 5.8]}>
      {/* Floor Safety Demarcation Area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[4.2, 3.4]} />
        <meshBasicMaterial color="#E2E8F0" />
      </mesh>

      {/* ── SOLID DIAGNOSTIC WORKBENCH (Grounded Firmly with 4 Legs at y=0) ── */}
      <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.1, 1.4]} />
        <meshStandardMaterial color="#1E293B" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* 4 Solid Steel Legs (No floating in air!) */}
      {[[-1.45, -0.55], [-1.45, 0.55], [1.45, -0.55], [1.45, 0.55]].map(([lx, lz], li) => (
        <mesh key={li} position={[lx, 0.47, lz]}>
          <boxGeometry args={[0.08, 0.95, 0.08]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
      ))}
      {/* Lower Storage Shelf */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[2.9, 0.04, 1.1]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* ── BENCHTOP DUAL-TRACE OSCILLOSCOPE (On Table at y=1.0) ── */}
      <group position={[-0.8, 1.25, -0.2]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.75, 0.45, 0.45]} />
          <meshStandardMaterial color="#1E293B" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[-0.12, 0.04, 0.228]}>
          <planeGeometry args={[0.42, 0.32]} />
          <meshBasicMaterial color="#020617" />
        </mesh>
        <mesh ref={waveRef} position={[-0.12, 0.04, 0.23]}>
          <planeGeometry args={[0.38, 0.12]} />
          <meshBasicMaterial color="#4ADE80" transparent opacity={0.9} />
        </mesh>
        {[0.18, 0.26].map((kx, ki) => (
          <group key={ki} position={[kx, 0.04, 0.23]}>
            <cylinderGeometry args={[0.03, 0.03, 0.02, 10]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.9} />
          </group>
        ))}
      </group>

      {/* ── BENCHTOP ADJUSTABLE DC POWER SUPPLY (On Table at y=1.0) ── */}
      <group position={[0.2, 1.18, -0.2]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.55, 0.32, 0.4]} />
          <meshStandardMaterial color="#334155" metalness={0.6} />
        </mesh>
        <mesh position={[-0.1, 0.06, 0.205]}>
          <planeGeometry args={[0.16, 0.08]} />
          <meshBasicMaterial color="#EF4444" />
        </mesh>
        <mesh position={[0.1, 0.06, 0.205]}>
          <planeGeometry args={[0.16, 0.08]} />
          <meshBasicMaterial color="#22C55E" />
        </mesh>
      </group>

      {/* ── MOTOR SPIN TEST FIXTURE & VIBRATION PROBE (On Table at y=1.0) ── */}
      <group position={[1.0, 1.05, 0.05]}>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.7, 0.04, 0.5]} />
          <meshStandardMaterial color="#0F172A" metalness={0.8} />
        </mesh>
        <Asset url={`${FACTORY_KIT}/machine.glb`} position={[0, 0.04, 0]} scale={0.9} />
        <group position={[0, 0.35, 0]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.05, 8]} />
            <meshStandardMaterial color="#EAB308" metalness={0.9} />
          </mesh>
          <mesh position={[-0.35, 0.06, -0.15]} rotation={[0, 0.3, 0.2]}>
            <cylinderGeometry args={[0.006, 0.006, 0.7, 6]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
        </group>
      </group>

      {/* ── RUGGED FIELD DIAGNOSTIC LAPTOP (Resting Securely on the Workbench Top!) ── */}
      <group position={[-0.8, 1.01, 0.35]} rotation={[0, 0.2, 0]}>
        {/* Base Keyboard resting on table */}
        <mesh position={[0, 0.015, 0]}>
          <boxGeometry args={[0.42, 0.025, 0.3]} />
          <meshStandardMaterial color="#1E293B" metalness={0.7} />
        </mesh>
        {/* Screen Bezel opened at 110 degrees */}
        <group position={[0, 0.03, -0.14]} rotation={[-0.35, 0, 0]}>
          <mesh position={[0, 0.14, 0]}>
            <boxGeometry args={[0.42, 0.26, 0.02]} />
            <meshStandardMaterial color="#0F172A" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.14, 0.012]}>
            <planeGeometry args={[0.38, 0.22]} />
            <meshBasicMaterial color="#0284C7" />
          </mesh>
        </group>
      </group>
    </group>
  );
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MAIN MAINTENANCE BAY INTERIOR COMPONENT
 * Mounted when viewLevel === 'INTERIOR' && activeZoneId === 'MAINTENANCE'
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const MaintenanceBayInteriorDetail: React.FC<MaintenanceBayInteriorProps> = ({
  cx,
  cz,
  visible,
  machines,
  workOrders,
  liveTelemetry,
}) => {
  if (!visible) return null;

  return (
    <group position={[cx, 0, cz]}>
      {/* 1. Main Power / MCC & LOTO Area (North-West) */}
      <MainPowerAndLOTOZone />

      {/* 2. Monitoring & SCADA Control Desk (North-East) */}
      <MonitoringAndSCADAZone
        machines={machines}
        workOrders={workOrders}
        liveTelemetry={liveTelemetry}
      />

      {/* 3. Spare Parts Storage Racks (West Wall) */}
      <SparePartsStorageZone />

      {/* 4. Repair Workshop — BENCH-01 Mechanical Repair (Center-West) */}
      <MechanicalRepairStation />

      {/* 5. Repair Workshop — BENCH-02 Motor & Electrical Rebuild (Center-East) */}
      <MotorAndElectricalRebuildStation />

      {/* 6. Hydraulic Press & Column Drill Press (East Wall / Front-Right) */}
      <HydraulicAndMachiningZone />

      {/* 7. TIG/MIG Welding & Fabrication Bay (Front-Right) */}
      <WeldingAndFabricationZone />

      {/* 8. Fluid & Chemical Containment Station (Front-Left) */}
      <FluidContainmentZone />

      {/* 9. Battery Charging, UPS & Emergency Safety Station (West Wall Front) */}
      <BatteryAndSafetyZone />

      {/* 10. Test & Diagnostic Workstation (Center-South TEST-01) */}
      <TestAndDiagnosticZone />

      {/* Central Pedestrian Epoxy Walkway Stripe (Connecting South Entrance to North SCADA) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <planeGeometry args={[1.8, 18.0]} />
        <meshBasicMaterial color="#DDE9E3" transparent opacity={0.65} />
      </mesh>
    </group>
  );
};
