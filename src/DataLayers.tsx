import { useMemo } from 'react';
import * as THREE from 'three';
import { DataLayer, TerrainRegion, generateHeightMap } from './terrainData';
import { TERRAIN_SIZE, SEGMENTS } from './Terrain';

interface DataLayersProps {
  region: TerrainRegion;
  activeLayers: string[];
  layers: DataLayer[];
}

export default function DataLayers({ region, activeLayers, layers }: DataLayersProps) {
  return (
    <group>
      {layers
        .filter((l) => activeLayers.includes(l.id))
        .map((layer) => (
          <LayerMesh key={layer.id} layer={layer} region={region} />
        ))}
    </group>
  );
}

function LayerMesh({ layer, region }: { layer: DataLayer; region: TerrainRegion }) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);

    const heights = generateHeightMap(region, SEGMENTS);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 4);
    const halfSize = TERRAIN_SIZE / 2;
    const maxHeight = TERRAIN_SIZE * 0.45;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const nx = (x + halfSize) / TERRAIN_SIZE;
      const nz = (z + halfSize) / TERRAIN_SIZE;

      const idx = Math.round(nz * SEGMENTS) * (SEGMENTS + 1) + Math.round(nx * SEGMENTS);
      const hn = heights[Math.min(idx, heights.length - 1)];

      pos.setY(i, hn * maxHeight + 0.05); // Slightly above terrain

      const result = layer.colorFn(nx, nz, hn);
      if (result) {
        col[i * 4] = result.r;
        col[i * 4 + 1] = result.g;
        col[i * 4 + 2] = result.b;
        col[i * 4 + 3] = result.a;
      } else {
        col[i * 4 + 3] = 0; // Fully transparent
      }
    }

    // Build index buffer - only include triangles where at least one vertex is visible
    const indices: number[] = [];
    for (let j = 0; j < SEGMENTS; j++) {
      for (let i = 0; i < SEGMENTS; i++) {
        const a = j * (SEGMENTS + 1) + i;
        const b = a + 1;
        const c = a + (SEGMENTS + 1);
        const d = c + 1;
        const hasVisible =
          col[a * 4 + 3] > 0 || col[b * 4 + 3] > 0 ||
          col[c * 4 + 3] > 0 || col[d * 4 + 3] > 0;
        if (hasVisible) {
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }
    }

    geo.setIndex(indices);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    geo.computeVertexNormals();
    return geo;
  }, [layer, region]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={1}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
