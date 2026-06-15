import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { generateHeightMap, TerrainRegion, getHeightAt } from './terrainData';

const TERRAIN_SIZE = 20;
const SEGMENTS = 200;

interface TerrainProps {
  region: TerrainRegion;
  onPointerMove?: (point: THREE.Vector3, nx: number, nz: number, height: number) => void;
  onPointerOut?: () => void;
  profilePoints?: THREE.Vector3[] | null;
  measurePoints?: THREE.Vector3[] | null;
}

export default function Terrain({ region, onPointerMove, onPointerOut, profilePoints, measurePoints }: TerrainProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, colors, heightData } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);

    const heights = generateHeightMap(region, SEGMENTS);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);

    const halfSize = TERRAIN_SIZE / 2;
    const maxHeight = TERRAIN_SIZE * 0.45;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const nx = (x + halfSize) / TERRAIN_SIZE;
      const nz = (z + halfSize) / TERRAIN_SIZE;

      const idx = Math.round(nz * SEGMENTS) * (SEGMENTS + 1) + Math.round(nx * SEGMENTS);
      const h = heights[Math.min(idx, heights.length - 1)] * maxHeight;

      pos.setY(i, h);

      // Color based on height
      const hn = heights[Math.min(idx, heights.length - 1)];
      let r, g, b;
      if (hn < 0.08) {
        // Water
        r = 0.15; g = 0.35; b = 0.65;
      } else if (hn < 0.15) {
        // Shore / lowland
        r = 0.22; g = 0.52; b = 0.28;
      } else if (hn < 0.35) {
        // Grassland
        const t = (hn - 0.15) / 0.2;
        r = 0.22 + t * 0.15; g = 0.52 - t * 0.1; b = 0.28 - t * 0.05;
      } else if (hn < 0.55) {
        // Forest / rocky
        const t = (hn - 0.35) / 0.2;
        r = 0.37 + t * 0.2; g = 0.42 - t * 0.08; b = 0.23 + t * 0.1;
      } else if (hn < 0.7) {
        // High altitude rock
        const t = (hn - 0.55) / 0.15;
        r = 0.57 + t * 0.2; g = 0.44 + t * 0.15; b = 0.33 + t * 0.2;
      } else {
        // Snow
        const t = Math.min(1, (hn - 0.7) / 0.15);
        r = 0.77 + t * 0.2; g = 0.59 + t * 0.35; b = 0.53 + t * 0.42;
      }

      // Add subtle noise for variation
      const n = (hash(i) - 0.5) * 0.04;
      col[i * 3] = Math.max(0, Math.min(1, r + n));
      col[i * 3 + 1] = Math.max(0, Math.min(1, g + n));
      col[i * 3 + 2] = Math.max(0, Math.min(1, b + n));
    }

    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();

    return { geometry: geo, colors: col, heightData: heights };
  }, [region]);

  const handlePointerMove = (e: THREE.Event & { point: THREE.Vector3 }) => {
    if (!onPointerMove) return;
    const point = e.point;
    const halfSize = TERRAIN_SIZE / 2;
    const nx = (point.x + halfSize) / TERRAIN_SIZE;
    const nz = (point.z + halfSize) / TERRAIN_SIZE;
    const idx = Math.round(nz * SEGMENTS) * (SEGMENTS + 1) + Math.round(nx * SEGMENTS);
    const height = heightData[Math.min(idx, heightData.length - 1)];
    onPointerMove(point, nx, nz, height);
  };

  const buildTerrainPath = (p0: THREE.Vector3, p1: THREE.Vector3, numSamples: number = 150): Float32Array => {
    const halfSize = TERRAIN_SIZE / 2;
    const maxHeight = TERRAIN_SIZE * 0.45;
    const nx0 = (p0.x + halfSize) / TERRAIN_SIZE;
    const nz0 = (p0.z + halfSize) / TERRAIN_SIZE;
    const nx1 = (p1.x + halfSize) / TERRAIN_SIZE;
    const nz1 = (p1.z + halfSize) / TERRAIN_SIZE;

    const positions = new Float32Array((numSamples + 1) * 3);

    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const nx = nx0 + (nx1 - nx0) * t;
      const nz = nz0 + (nz1 - nz0) * t;
      const h = getHeightAt(region, nx, nz) * maxHeight;
      const x = nx * TERRAIN_SIZE - halfSize;
      const z = nz * TERRAIN_SIZE - halfSize;
      positions[i * 3] = x;
      positions[i * 3 + 1] = h + 0.3;
      positions[i * 3 + 2] = z;
    }

    return positions;
  };

  const getTerrainPoint = (p: THREE.Vector3): THREE.Vector3 => {
    const halfSize = TERRAIN_SIZE / 2;
    const maxHeight = TERRAIN_SIZE * 0.45;
    const nx = (p.x + halfSize) / TERRAIN_SIZE;
    const nz = (p.z + halfSize) / TERRAIN_SIZE;
    const h = getHeightAt(region, nx, nz) * maxHeight;
    return new THREE.Vector3(p.x, h, p.z);
  };

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerMove={handlePointerMove}
        onPointerOut={onPointerOut}
      >
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {/* Water plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TERRAIN_SIZE * 0.08 * 0.45, 0]}>
        <planeGeometry args={[TERRAIN_SIZE, TERRAIN_SIZE]} />
        <meshStandardMaterial
          color="#1a5276"
          transparent
          opacity={0.55}
          roughness={0.1}
          metalness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Profile line */}
      {profilePoints && profilePoints.length === 2 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={151}
              array={buildTerrainPath(profilePoints[0], profilePoints[1])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#f59e0b" linewidth={2} />
        </line>
      )}

      {/* Profile point markers */}
      {profilePoints && profilePoints.map((p, i) => {
        const tp = getTerrainPoint(p);
        return (
          <mesh key={i} position={[tp.x, tp.y + 0.3, tp.z]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} />
          </mesh>
        );
      })}

      {/* Measure line */}
      {measurePoints && measurePoints.length === 2 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={151}
              array={buildTerrainPath(measurePoints[0], measurePoints[1])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#06b6d4" linewidth={2} />
        </line>
      )}

      {/* Measure point markers */}
      {measurePoints && measurePoints.map((p, i) => {
        const tp = getTerrainPoint(p);
        return (
          <mesh key={`m-${i}`} position={[tp.x, tp.y + 0.3, tp.z]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

function hash(i: number): number {
  let h = i * 374761393;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h & 0x7fffffff) / 0x7fffffff;
}

export { TERRAIN_SIZE, SEGMENTS };
