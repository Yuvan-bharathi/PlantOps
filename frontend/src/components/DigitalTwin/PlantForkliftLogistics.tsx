import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface PlantForkliftLogisticsProps {
  visible?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detailed Industrial Forklift 3D Model (Safety Orange + Mast + Forks + VMC + RFID)
// ─────────────────────────────────────────────────────────────────────────────
interface ForkliftModelProps {
  position: [number, number, number];
  rotationY: number;
  forkLiftHeight: number; // 0.05 (lowered) to 0.7 (raised)
  cargoType: 'machined' | 'welded' | 'none';
  wheelRotation?: number;
}

const ForkliftModel: React.FC<ForkliftModelProps> = ({
  position,
  rotationY,
  forkLiftHeight,
  cargoType,
  wheelRotation = 0,
}) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* ── 1. MAIN CHASSIS (Industrial Safety Orange) ── */}
      <group position={[0, 0.55, 0]}>
        {/* Main Body */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.65, 2.2]} />
          <meshStandardMaterial color="#EA580C" metalness={0.65} roughness={0.35} />
        </mesh>

        {/* Heavy Cast Iron Rear Counterweight */}
        <mesh position={[0, 0.1, -1.05]} castShadow>
          <boxGeometry args={[1.45, 0.75, 0.45]} />
          <meshStandardMaterial color="#0F172A" metalness={0.85} roughness={0.4} />
        </mesh>

        {/* Operator Footwell */}
        <mesh position={[0, 0.15, 0.1]}>
          <boxGeometry args={[1.2, 0.1, 1.1]} />
          <meshStandardMaterial color="#1E293B" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Ergonomic Driver Seat */}
        <group position={[0, 0.45, -0.25]}>
          <mesh castShadow>
            <boxGeometry args={[0.65, 0.15, 0.65]} />
            <meshStandardMaterial color="#020617" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.38, -0.28]} rotation={[-0.1, 0, 0]} castShadow>
            <boxGeometry args={[0.62, 0.65, 0.14]} />
            <meshStandardMaterial color="#020617" roughness={0.9} />
          </mesh>
        </group>

        {/* Steering Column & Wheel */}
        <group position={[0.2, 0.55, 0.45]} rotation={[-0.45, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.04, 0.04, 0.5, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.26, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2, 0.035, 8, 16]} />
            <meshStandardMaterial color="#0F172A" roughness={0.9} />
          </mesh>
        </group>
      </group>

      {/* ── 2. OPERATOR OVERHEAD GUARD / ROLL CAGE ── */}
      <group position={[0, 1.6, 0]}>
        {[
          [-0.68, -0.7, -0.85], [0.68, -0.7, -0.85],
          [-0.68, -0.7, 0.65],  [0.68, -0.7, 0.65],
        ].map(([px, py, pz], pi) => (
          <mesh key={pi} position={[px, py + 0.35, pz]} castShadow>
            <boxGeometry args={[0.07, 1.45, 0.07]} />
            <meshStandardMaterial color="#0F172A" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}

        {/* Roof Overhead Canopy Grille */}
        <group position={[0, 0.72, -0.1]}>
          <mesh castShadow>
            <boxGeometry args={[1.44, 0.06, 1.6]} />
            <meshStandardMaterial color="#0F172A" metalness={0.9} />
          </mesh>
          {[-0.5, -0.25, 0, 0.25, 0.5].map((gx, gi) => (
            <mesh key={gi} position={[gx, 0.04, 0]}>
              <boxGeometry args={[0.12, 0.04, 1.45]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
          ))}
        </group>

        {/* Flashing Amber Safety Strobe Beacon */}
        <group position={[0.45, 0.85, -0.7]}>
          <mesh>
            <cylinderGeometry args={[0.09, 0.09, 0.16, 12]} />
            <meshStandardMaterial color="#F59E0B" emissive="#D97706" emissiveIntensity={0.9} />
          </mesh>
          <pointLight color="#F59E0B" intensity={1.2} distance={6} decay={2} />
        </group>

        {/* Vehicle Mount Computer (VMC Tablet VT-768K) */}
        <group position={[0.62, 0.15, 0.68]} rotation={[0, -0.6, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.26, 0.18, 0.04]} />
            <meshStandardMaterial color="#1E293B" metalness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.025]}>
            <planeGeometry args={[0.22, 0.14]} />
            <meshBasicMaterial color="#06B6D4" />
          </mesh>
        </group>
      </group>

      {/* ── 3. VERTICAL DUAL-STAGE MAST (Front Assembly) ── */}
      <group position={[0, 1.25, 1.2]}>
        {[-0.45, 0.45].map((mx, mi) => (
          <mesh key={mi} position={[mx, 0, 0]} castShadow>
            <boxGeometry args={[0.1, 2.2, 0.14]} />
            <meshStandardMaterial color="#0F172A" metalness={0.95} roughness={0.2} />
          </mesh>
        ))}

        {/* Central Hydraulic Ram Cylinder */}
        <mesh position={[0, 0, 0.02]}>
          <cylinderGeometry args={[0.05, 0.05, 2.0, 12]} />
          <meshStandardMaterial color="#E2E8F0" metalness={0.98} roughness={0.1} />
        </mesh>

        {/* Top Mast Cross-Brace & RFID Reader */}
        <group position={[0, 1.1, 0]}>
          <mesh>
            <boxGeometry args={[1.0, 0.1, 0.15]} />
            <meshStandardMaterial color="#0F172A" metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.1, 0.05]}>
            <boxGeometry args={[0.28, 0.08, 0.18]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.3} />
          </mesh>
        </group>

        {/* Headlamps */}
        {[-0.55, 0.55].map((hx, hi) => (
          <group key={hi} position={[hx, 0.6, 0.08]}>
            <mesh>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color="#FEF08A" />
            </mesh>
            <pointLight color="#FEF08A" intensity={1.5} distance={10} decay={2} />
          </group>
        ))}

        {/* ── 4. VERTICAL MOVING FORK CARRIAGE & TINES ── */}
        <group position={[0, -0.9 + forkLiftHeight, 0.12]}>
          <mesh castShadow>
            <boxGeometry args={[1.1, 0.65, 0.06]} />
            <meshStandardMaterial color="#0F172A" metalness={0.9} />
          </mesh>

          {/* Dual Forged Steel Forks */}
          {[-0.32, 0.32].map((fx, fi) => (
            <group key={fi} position={[fx, -0.32, 0]}>
              <mesh position={[0, 0.15, 0]}>
                <boxGeometry args={[0.08, 0.35, 0.04]} />
                <meshStandardMaterial color="#1E293B" metalness={0.95} />
              </mesh>
              <mesh position={[0, 0.02, 0.6]} castShadow>
                <boxGeometry args={[0.08, 0.04, 1.2]} />
                <meshStandardMaterial color="#1E293B" metalness={0.95} />
              </mesh>
            </group>
          ))}

          {/* ── 5. PALLETIZED CARGO LOADED ON FORKS ── */}
          {cargoType !== 'none' && (
            <group position={[0, 0.06, 0.65]}>
              <mesh position={[0, 0.06, 0]} castShadow>
                <boxGeometry args={[1.2, 0.12, 1.2]} />
                <meshStandardMaterial color="#92400E" roughness={0.9} />
              </mesh>

              {/* FLOW 1: Machined Aluminum Parts */}
              {cargoType === 'machined' && (
                <group position={[0, 0.45, 0]}>
                  <mesh castShadow>
                    <boxGeometry args={[0.95, 0.65, 0.95]} />
                    <meshStandardMaterial color="#CBD5E1" metalness={0.9} roughness={0.15} />
                  </mesh>
                  {[-0.25, 0.25].map((cx, ci) => (
                    <mesh key={ci} position={[cx, 0.42, 0]} rotation={[0, 0, Math.PI / 2]}>
                      <cylinderGeometry args={[0.1, 0.1, 0.45, 16]} />
                      <meshStandardMaterial color="#E2E8F0" metalness={0.98} roughness={0.1} />
                    </mesh>
                  ))}
                  <mesh position={[0.49, 0.1, 0]}>
                    <planeGeometry args={[0.18, 0.24]} />
                    <meshBasicMaterial color="#10B981" />
                  </mesh>
                </group>
              )}

              {/* FLOW 2: Finished Welded Sub-Assemblies */}
              {cargoType === 'welded' && (
                <group position={[0, 0.5, 0]}>
                  <mesh castShadow>
                    <boxGeometry args={[1.0, 0.75, 1.0]} />
                    <meshStandardMaterial color="#94A3B8" metalness={0.85} roughness={0.25} />
                  </mesh>
                  {[-0.35, 0.35].map((wx, wi) => (
                    <mesh key={wi} position={[wx, 0.4, 0]}>
                      <boxGeometry args={[0.06, 0.06, 0.9]} />
                      <meshStandardMaterial color="#FACC15" roughness={0.4} />
                    </mesh>
                  ))}
                  <mesh position={[0.51, 0.1, 0]}>
                    <planeGeometry args={[0.18, 0.24]} />
                    <meshBasicMaterial color="#3B82F6" />
                  </mesh>
                </group>
              )}
            </group>
          )}
        </group>
      </group>

      {/* ── 6. 4 SOLID INDUSTRIAL RUBBER TIRES ── */}
      {[-0.72, 0.72].map((wx, wi) => (
        <mesh key={wi} position={[wx, 0.35, 0.75]} rotation={[wheelRotation, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.22, 16]} />
          <meshStandardMaterial color="#020617" roughness={0.9} />
        </mesh>
      ))}
      {[-0.65, 0.65].map((wx, wi) => (
        <mesh key={wi} position={[wx, 0.3, -0.75]} rotation={[wheelRotation, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 0.18, 16]} />
          <meshStandardMaterial color="#020617" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Plant Forklift Logistics Component with Clean Dedicated Bay Routing
// ─────────────────────────────────────────────────────────────────────────────
export const PlantForkliftLogistics: React.FC<PlantForkliftLogisticsProps> = ({
  visible = true,
}) => {
  const [cycleTime, setCycleTime] = useState(0);

  const CYCLE_DURATION = 120.0;

  const [forkliftState, setForkliftState] = useState<{
    pos: [number, number, number];
    rotY: number;
    forkHeight: number;
    cargo: 'machined' | 'welded' | 'none';
    wheelRot: number;
    statusText: string;
    flowBadge: string;
  }>({
    pos: [-25.5, 0, -18.5],
    rotY: 0,
    forkHeight: 0.1,
    cargo: 'machined',
    wheelRot: 0,
    statusText: 'LOADING MACHINED PARTS AT MACHINING BAY',
    flowBadge: 'FLOW 1: MACHINING ➔ ROBOT',
  });

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    const t = elapsed % CYCLE_DURATION;
    setCycleTime(t);

    let x = -25.5;
    let z = -18.5;
    let rotY = 0;
    let forkHeight = 0.1;
    let cargo: 'machined' | 'welded' | 'none' = 'machined';
    let statusText = '';
    let flowBadge = '';
    const speed = 4.0;
    const wheelRot = elapsed * speed * 3.0;

    // ─────────────────────────────────────────────────────────────────────────
    // ── 1ST FLOW: MACHINING CELL BAY ➔ ROBOT CELL INFEED BAY (0s - 55s) ──
    // ─────────────────────────────────────────────────────────────────────────
    if (t < 55.0) {
      flowBadge = 'FLOW 1: MACHINING ➔ ROBOT CELL';

      if (t < 6.0) {
        // Phase 1A (0s - 6s): In Machining Cell Dedicated Forklift Bay, lifts machined parts pallet
        const liftT = Math.min(1.0, t / 5.0);
        x = -25.5;
        z = -18.5;
        rotY = 0; // Facing South
        forkHeight = 0.1 + liftT * 0.45;
        cargo = 'machined';
        statusText = 'PICKING UP MACHINED PARTS AT DEDICATED STAGING BAY';
      } else if (t < 14.0) {
        // Phase 1B (6s - 14s): Pulls South out of Machining door to road at z = -9.0
        const prog = (t - 6.0) / 8.0;
        x = -25.5;
        z = -18.5 + prog * 9.5; // z: -18.5 -> -9.0
        rotY = 0; // Facing South
        forkHeight = 0.55;
        cargo = 'machined';
        statusText = 'EXITING MACHINING CELL LOGISTICS BAY';
      } else if (t < 17.0) {
        // Phase 1C (14s - 17s): Turns East onto Central Road
        const turnT = (t - 14.0) / 3.0;
        x = -25.5 + turnT * 3.0;
        z = -9.0;
        rotY = turnT * (Math.PI / 2); // Facing East
        forkHeight = 0.55;
        cargo = 'machined';
        statusText = 'TURNING EAST ONTO CENTRAL ARTERY';
      } else if (t < 36.0) {
        // Phase 1D (17s - 36s): Drives East along artery to East Logistics Road (x = 43.2)
        const driveT = (t - 17.0) / 19.0;
        x = -22.5 + driveT * 65.7; // x: -22.5 -> 43.2
        z = -9.0;
        rotY = Math.PI / 2; // Facing East
        forkHeight = 0.55;
        cargo = 'machined';
        statusText = 'TRANSPORTING MACHINED PARTS PAST PROCESSING CELL';
      } else if (t < 41.0) {
        // Phase 1E (36s - 41s): Turns North onto East Logistics Road towards Infeed Pad (z = -24.0)
        const turnT = (t - 36.0) / 5.0;
        x = 43.2;
        z = -9.0 - turnT * 5.0;
        rotY = Math.PI / 2 + turnT * (Math.PI / 2); // Facing North (Math.PI)
        forkHeight = 0.55;
        cargo = 'machined';
        statusText = 'ENTERING ROBOT CELL EAST LOGISTICS TERMINAL';
      } else if (t < 48.0) {
        // Phase 1F (41s - 48s): Drives North along East Logistics Pad to Infeed Pad at z = -24.0 (after ROBOT-02)
        const inT = (t - 41.0) / 7.0;
        x = 43.2;
        z = -14.0 - inT * 10.0; // z: -14.0 -> -24.0
        rotY = Math.PI; // Facing North
        forkHeight = 0.55;
        cargo = 'machined';
        statusText = 'DELIVERING RAW PARTS TO ROBOT INFEED PAD (AFTER ROBOT-02)';
      } else {
        // Phase 1G (48s - 55s): Lowers pallet onto Infeed Pad
        const dropT = Math.min(1.0, (t - 48.0) / 6.0);
        x = 43.2;
        z = -24.0;
        rotY = Math.PI;
        forkHeight = 0.55 - dropT * 0.45;
        cargo = dropT > 0.8 ? 'none' : 'machined';
        statusText = 'PARTS TRANSFERRED TO WELDING ROBOT INFEED';
      }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ── 2ND FLOW: ROBOT CELL OUTFEED BAY ➔ PACKAGING CELL INFEED BAY (55s - 110s) ──
    // ─────────────────────────────────────────────────────────────────────────
    else if (t < 110.0) {
      flowBadge = 'FLOW 2: ROBOT CELL ➔ PACKAGING CELL';

      if (t < 64.0) {
        // Phase 2A (55s - 64s): Moves to Robot Cell East Outfeed Pad (x = 43.2, z = -17.0, after ROBOT-04) and lifts welded pallet
        const liftT = Math.min(1.0, (t - 55.0) / 7.0);
        const moveT = Math.min(1.0, (t - 55.0) / 4.0);
        x = 43.2;
        z = -24.0 + moveT * 7.0; // moves from -24.0 to -17.0
        rotY = 0; // Facing South
        forkHeight = 0.1 + liftT * 0.45;
        cargo = 'welded';
        statusText = 'PICKING UP WELDED ASSEMBLIES AT ROBOT OUTFEED BAY (AFTER ROBOT-04)';
      } else if (t < 76.0) {
        // Phase 2B (64s - 76s): Drives South down East Logistics Road (z: -17.0 -> 0.0)
        const outT = (t - 64.0) / 12.0;
        x = 43.2;
        z = -17.0 + outT * 17.0; // z: -17.0 -> 0.0
        rotY = 0; // Facing South
        forkHeight = 0.55;
        cargo = 'welded';
        statusText = 'EXITING ROBOT CELL ONTO EAST LOGISTICS ROAD';
      } else if (t < 94.0) {
        // Phase 2C (76s - 94s): Drives South down East Road towards Packaging Cell entrance
        const roadT = (t - 76.0) / 18.0;
        x = 43.2 - roadT * 15.7; // x: 43.2 -> 27.5
        z = 0.0 + roadT * 9.0;   // z: 0.0 -> 9.0
        rotY = 0; // Facing South
        forkHeight = 0.55;
        cargo = 'welded';
        statusText = 'TRANSPORTING WELDED ASSEMBLIES TO PACKAGING CELL';
      } else if (t < 102.0) {
        // Phase 2D (94s - 102s): Turns West into Packaging Cell Dedicated Infeed Bay (x = 21.5)
        const inT = (t - 94.0) / 8.0;
        x = 27.5 - inT * 6.0; // x: 27.5 -> 21.5
        z = 9.0;
        rotY = -Math.PI / 2; // Turns West
        forkHeight = 0.55;
        cargo = 'welded';
        statusText = 'ENTERING PACKAGING CELL RECEPTION DOCK';
      } else {
        // Phase 2E (102s - 110s): Lowers welded parts onto Packaging Infeed Roller Bed
        const dropT = Math.min(1.0, (t - 102.0) / 6.0);
        x = 21.5;
        z = 9.0;
        rotY = -Math.PI / 2;
        forkHeight = 0.55 - dropT * 0.45;
        cargo = dropT > 0.8 ? 'none' : 'welded';
        statusText = 'WELDED GOODS DELIVERED TO PACKAGING CONVEYOR DOCK';
      }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ── REPOSITION / RETURN TO MACHINING CELL (110s - 120s) ──
    // ─────────────────────────────────────────────────────────────────────────
    else {
      flowBadge = 'REPOSITIONING TO MACHINING CELL';
      const repT = (t - 110.0) / 10.0;
      x = 21.5 - repT * 47.0; // 21.5 -> -25.5
      z = 9.0 - repT * 27.5;  // 9.0 -> -18.5
      rotY = -Math.PI / 2; // Facing West
      forkHeight = 0.1;
      cargo = 'none';
      statusText = 'RETURNING TO MACHINING CELL FOR NEXT 2-MIN CYCLE';
    }

    setForkliftState({
      pos: [x, 0, z],
      rotY,
      forkHeight,
      cargo,
      wheelRot,
      statusText,
      flowBadge,
    });
  });

  if (!visible) return null;

  const secondsRemaining = Math.max(0, Math.floor(CYCLE_DURATION - cycleTime));
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timerStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <group>
      {/* ── 1. ACTIVE LOGISTICS FORKLIFTER ── */}
      <ForkliftModel
        position={forkliftState.pos}
        rotationY={forkliftState.rotY}
        forkLiftHeight={forkliftState.forkHeight}
        cargoType={forkliftState.cargo}
        wheelRotation={forkliftState.wheelRot}
      />

      {/* ── 2. FORKLIFT REAL-TIME TELEMETRY & ROUTING HUD ── */}
      <group position={[forkliftState.pos[0], 3.8, forkliftState.pos[2]]}>
        <Html transform scale={0.06} position={[0, 0, 0]} className="pointer-events-none select-none">
          <div className="px-3 py-1.5 bg-slate-950/95 text-white font-mono text-[8px] rounded-md border border-orange-500 shadow-2xl space-y-0.5 whitespace-nowrap">
            <div className="font-extrabold text-orange-400 border-b border-orange-800 pb-0.5 flex justify-between items-center space-x-2">
              <span>FORKLIFT FL-01 (AUTOMATED AGV)</span>
              <span className="text-[6.5px] px-1 py-0.2 rounded font-bold bg-orange-950 text-orange-300 border border-orange-500 animate-pulse">
                {forkliftState.flowBadge}
              </span>
            </div>
            <div className="text-[7.5px] text-cyan-300 font-semibold">
              {forkliftState.statusText}
            </div>
            <div className="flex justify-between text-[7px] text-slate-400 pt-0.5 border-t border-slate-800">
              <span>INTERVAL: <strong className="text-amber-300">2 MINS</strong></span>
              <span>CYCLE: <strong className="text-emerald-300">{timerStr}</strong></span>
            </div>
          </div>
        </Html>
      </group>
    </group>
  );
};
