import React from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Ground Zoning System for PlantOps Industrial Campus
// Replaces uniform flat gray with functional, subtle industrial surface zones:
// 1. Base Earth & Lawn / Green Buffer (#70886A / #7E9478)
// 2. Production Concrete Aprons (#D7D4CC / #E3E0D8) under the 6 manufacturing cells
// 3. Heavy Logistics Reinforced Concrete Pad (#CBD5E1) at Shipping / Goods Area
// 4. Utility Area Equipment Base (#B8C0C8) with safety fencing
// 5. Parking Area Asphalt Base (#3A3D40) with pedestrian walkways
// 6. Perimeter Security Fence & Campus Boundary
// ─────────────────────────────────────────────────────────────────────────────

interface CampusGroundPlanesProps {
  plantLevel?: boolean;
}

export const CampusGroundPlanes: React.FC<CampusGroundPlanesProps> = ({ plantLevel = true }) => {
  const FW = 110, FD = 72;

  return (
    <group>
      {/* ── 1. GLOBAL BASE TERRAIN (Muted Industrial Green Grass / Landscape Buffer) ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <planeGeometry args={[FW + 60, FD + 60]} />
        <meshStandardMaterial color="#6B8065" roughness={0.98} metalness={0.01} />
      </mesh>

      {/* ── 2. CAMPUS PLAZA FOUNDATION (Subtle Warm Industrial Compacted Ground) ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 2]} receiveShadow>
        <planeGeometry args={[FW + 28, FD + 32]} />
        <meshStandardMaterial color="#C8C5BC" roughness={0.94} metalness={0.02} />
      </mesh>

      {/* ── 3. SIX PRODUCTION BUILDING CONCRETE APRONS ── */}
      {/* Machining Cell Concrete Apron ([-35, 0, -20.5], 28x23) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-35, -0.02, -20.5]} receiveShadow>
        <planeGeometry args={[26, 21]} />
        <meshStandardMaterial color="#D7D4CC" roughness={0.88} metalness={0.04} />
      </mesh>

      {/* Processing Cell Concrete Apron ([0, 0, -21], 25x21) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -21]} receiveShadow>
        <planeGeometry args={[25, 21]} />
        <meshStandardMaterial color="#DBD8CE" roughness={0.88} metalness={0.04} />
      </mesh>

      {/* Robot Cell Concrete Apron ([33, 0, -20.5], 22x21) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[33, -0.02, -20.5]} receiveShadow>
        <planeGeometry args={[22, 21]} />
        <meshStandardMaterial color="#D5D9D6" roughness={0.88} metalness={0.04} />
      </mesh>

      {/* Assembly Cell Concrete Apron ([-35, 0, 15], 25x21) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-35, -0.02, 15]} receiveShadow>
        <planeGeometry args={[25, 21]} />
        <meshStandardMaterial color="#D7D4CC" roughness={0.88} metalness={0.04} />
      </mesh>

      {/* Maintenance Bay Concrete Apron ([0, 0, 15.5], 24x21) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 15.5]} receiveShadow>
        <planeGeometry args={[24, 21]} />
        <meshStandardMaterial color="#D8D4DB" roughness={0.88} metalness={0.04} />
      </mesh>

      {/* Packaging Cell Concrete Apron ([31, 0, 16], 21x21) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[31, -0.02, 16]} receiveShadow>
        <planeGeometry args={[21, 21]} />
        <meshStandardMaterial color="#DCD7CE" roughness={0.88} metalness={0.04} />
      </mesh>

      {/* ── 4. LOGISTICS & SHIPPING HEAVY-DUTY REINFORCED APRON ([52, 0, 15.5], 24x22) ── */}
      <group position={[52, -0.015, 15.5]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[22, 22]} />
          <meshStandardMaterial color="#CCD4DC" roughness={0.82} metalness={0.08} />
        </mesh>
        {/* Yellow Safety Boundary Border around Loading Apron */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, -10.8]}>
          <planeGeometry args={[21.6, 0.35]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 10.8]}>
          <planeGeometry args={[21.6, 0.35]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-10.8, 0.002, 0]}>
          <planeGeometry args={[0.35, 21.6]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[10.8, 0.002, 0]}>
          <planeGeometry args={[0.35, 21.6]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
      </group>

      {/* ── 5. UTILITY AREA RESTRICTED FOUNDATION PAD ([60, 0, -24], 20x22) ── */}
      <group position={[60, -0.02, -24]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[18, 20]} />
          <meshStandardMaterial color="#B0BAC3" roughness={0.92} metalness={0.12} />
        </mesh>
        {/* Diagonal Warning Hazard Stripes on Pad Perimeter */}
        {[-8.5, 8.5].map((hx, hi) => (
          <mesh key={hi} rotation={[-Math.PI / 2, 0, 0]} position={[hx, 0.002, 0]}>
            <planeGeometry args={[0.4, 19.5]} />
            <meshBasicMaterial color="#F59E0B" />
          </mesh>
        ))}
      </group>

      {/* ── 6. PARKING LOT ASPHALT PAD ([-58, 0, 31], 20x15) ── */}
      <group position={[-58, -0.018, 31]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[18, 14]} />
          <meshStandardMaterial color="#333538" roughness={0.92} metalness={0.05} />
        </mesh>
        {/* Concrete Curb Framing */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, -6.8]}>
          <planeGeometry args={[18, 0.4]} />
          <meshStandardMaterial color="#CBD5E1" roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 6.8]}>
          <planeGeometry args={[18, 0.4]} />
          <meshStandardMaterial color="#CBD5E1" roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8.8, 0.003, 0]}>
          <planeGeometry args={[0.4, 14]} />
          <meshStandardMaterial color="#CBD5E1" roughness={0.9} />
        </mesh>
      </group>

      {/* ── 7. MAIN GATE PEDESTRIAN & ENTRY PLAZA ([0, 0, 48]) ── */}
      <group position={[0, -0.015, 48]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[32, 14]} />
          <meshStandardMaterial color="#D2CEBF" roughness={0.88} />
        </mesh>
      </group>

      {/* ── 8. PERIMETER FENCE & SECURITY POSTS (Plant Overview Only) ── */}
      {plantLevel && (
        <group>
          {/* North Boundary Fence */}
          {Array.from({ length: 18 }).map((_, i) => {
            const x = -65 + i * (130 / 17);
            return (
              <group key={`p-n-${i}`} position={[x, 0, -46]}>
                <mesh position={[0, 0.75, 0]}>
                  <cylinderGeometry args={[0.08, 0.08, 1.5, 8]} />
                  <meshStandardMaterial color="#64748B" metalness={0.7} roughness={0.3} />
                </mesh>
                {i < 17 && (
                  <mesh position={[130 / 34, 0.8, 0]}>
                    <boxGeometry args={[130 / 17, 0.06, 0.06]} />
                    <meshStandardMaterial color="#94A3B8" metalness={0.6} />
                  </mesh>
                )}
              </group>
            );
          })}

          {/* South Boundary Fence (with Main Gate opening between x=-16 and x=+16) */}
          {Array.from({ length: 7 }).map((_, i) => {
            const xWest = -65 + i * 7.5;
            return (
              <group key={`p-sw-${i}`} position={[xWest, 0, 55]}>
                <mesh position={[0, 0.75, 0]}>
                  <cylinderGeometry args={[0.08, 0.08, 1.5, 8]} />
                  <meshStandardMaterial color="#64748B" metalness={0.7} roughness={0.3} />
                </mesh>
                {i < 6 && (
                  <mesh position={[3.75, 0.8, 0]}>
                    <boxGeometry args={[7.5, 0.06, 0.06]} />
                    <meshStandardMaterial color="#94A3B8" metalness={0.6} />
                  </mesh>
                )}
              </group>
            );
          })}
          {Array.from({ length: 7 }).map((_, i) => {
            const xEast = 20 + i * 7.5;
            return (
              <group key={`p-se-${i}`} position={[xEast, 0, 55]}>
                <mesh position={[0, 0.75, 0]}>
                  <cylinderGeometry args={[0.08, 0.08, 1.5, 8]} />
                  <meshStandardMaterial color="#64748B" metalness={0.7} roughness={0.3} />
                </mesh>
                {i < 6 && (
                  <mesh position={[3.75, 0.8, 0]}>
                    <boxGeometry args={[7.5, 0.06, 0.06]} />
                    <meshStandardMaterial color="#94A3B8" metalness={0.6} />
                  </mesh>
                )}
              </group>
            );
          })}

          {/* West Boundary Fence */}
          {Array.from({ length: 14 }).map((_, i) => {
            const z = -46 + i * (101 / 13);
            return (
              <group key={`p-w-${i}`} position={[-65, 0, z]}>
                <mesh position={[0, 0.75, 0]}>
                  <cylinderGeometry args={[0.08, 0.08, 1.5, 8]} />
                  <meshStandardMaterial color="#64748B" metalness={0.7} roughness={0.3} />
                </mesh>
                {i < 13 && (
                  <mesh position={[0, 0.8, 101 / 26]}>
                    <boxGeometry args={[0.06, 0.06, 101 / 13]} />
                    <meshStandardMaterial color="#94A3B8" metalness={0.6} />
                  </mesh>
                )}
              </group>
            );
          })}

          {/* East Boundary Fence */}
          {Array.from({ length: 14 }).map((_, i) => {
            const z = -46 + i * (101 / 13);
            return (
              <group key={`p-e-${i}`} position={[68, 0, z]}>
                <mesh position={[0, 0.75, 0]}>
                  <cylinderGeometry args={[0.08, 0.08, 1.5, 8]} />
                  <meshStandardMaterial color="#64748B" metalness={0.7} roughness={0.3} />
                </mesh>
                {i < 13 && (
                  <mesh position={[0, 0.8, 101 / 26]}>
                    <boxGeometry args={[0.06, 0.06, 101 / 13]} />
                    <meshStandardMaterial color="#94A3B8" metalness={0.6} />
                  </mesh>
                )}
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
};
