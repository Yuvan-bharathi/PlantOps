import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';

// ─────────────────────────────────────────────────────────────────────────────
// Shared GLB-instancing helper — one clone-and-shadow-flag utility reused by
// every part of the Digital Twin scene that places a Kenney CC0 asset
// (buildings, campus props, road furniture). useGLTF caches one shared scene
// graph per URL; since an Object3D can only have a single parent, every
// placed instance needs its own clone. Materials are ALSO cloned per
// instance (three.js's default Object3D.clone() shares material/geometry by
// reference) — without that, tinting one building would silently recolor
// every other instance of the same source GLB (e.g. the same tank model
// reused across Processing/Machining/Assembly/Maintenance).
// ─────────────────────────────────────────────────────────────────────────────

export function useClonedGLTF(url: string, tint?: string, tintStrength = 0.45): THREE.Object3D {
  const gltf = useGLTF(url);
  return useMemo(() => {
    const clone = gltf.scene.clone(true);
    const tintColor = tint ? new THREE.Color(tint) : null;
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const applyTint = (mat: THREE.Material) => {
        const cloned = mat.clone();
        // Blend toward the tint rather than replacing the color outright —
        // GLTFLoader sets material.color from baseColorFactor (default
        // white), and the renderer multiplies it against the baked texture,
        // so a partial lerp keeps the kit's panel-line/window texture detail
        // visible while shifting the overall hue. Building exteriors use a
        // subtle wash (default 0.45); machine assemblies use a much
        // stronger blend (~0.85) to neutralize the kit's default blue/
        // orange palette into industrial gray, per the explicit "don't
        // make machines bright colors" requirement.
        if (tintColor && 'color' in cloned) {
          (cloned as THREE.MeshStandardMaterial).color.lerp(tintColor, tintStrength);
        }
        return cloned;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(applyTint)
        : applyTint(mesh.material);
    });
    return clone;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf.scene, tint, tintStrength]);
}

export const Asset: React.FC<{
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  tint?: string;
  tintStrength?: number;
}> = ({ url, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, tint, tintStrength }) => {
  const object = useClonedGLTF(url, tint, tintStrength);
  return <primitive object={object} position={position} rotation={rotation} scale={scale} />;
};
