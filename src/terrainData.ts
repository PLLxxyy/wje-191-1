// Simple 2D noise implementation (value noise)
function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function noise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function fbm(x: number, y: number, octaves: number = 6): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, y * frequency);
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value;
}

export interface TerrainRegion {
  id: string;
  name: string;
  description: string;
  heightFn: (x: number, z: number) => number;
  baseLat: number;
  baseLon: number;
}

// x, z are in range [-1, 1], returns height value
export const terrainRegions: TerrainRegion[] = [
  {
    id: 'plateau',
    name: '青藏高原',
    description: '世界屋脊，平均海拔超过4000米。地势高亢，雪山连绵，湖泊星罗棋布，是亚洲主要河流的发源地。',
    baseLat: 32.0,
    baseLon: 90.0,
    heightFn: (x: number, z: number): number => {
      const base = 0.55 + 0.15 * fbm(x * 2 + 5, z * 2 + 5, 5);
      const ridge = 0.2 * Math.pow(Math.max(0, fbm(x * 3 + 10, z * 3 + 10, 4) - 0.3), 1.5);
      const peaks = 0.12 * Math.exp(-8 * ((x + 0.3) ** 2 + (z - 0.2) ** 2))
                  + 0.1  * Math.exp(-10 * ((x - 0.4) ** 2 + (z + 0.3) ** 2))
                  + 0.08 * Math.exp(-6 * ((x - 0.1) ** 2 + (z - 0.5) ** 2));
      return base + ridge + peaks;
    }
  },
  {
    id: 'basin',
    name: '四川盆地',
    description: '四周高山环绕，中间低平，气候温暖湿润，河网密布。盆地底部海拔200-750米，是中国重要的农业区。',
    baseLat: 30.5,
    baseLon: 105.0,
    heightFn: (x: number, z: number): number => {
      const dist = Math.sqrt(x * x + z * z);
      const rim = 0.5 * Math.pow(Math.min(1, dist * 1.8), 2);
      const inner = 0.08 + 0.04 * fbm(x * 4 + 20, z * 4 + 20, 4);
      const river = -0.03 * Math.exp(-30 * (x - 0.1 * Math.sin(z * 4)) ** 2);
      return rim + inner + river;
    }
  },
  {
    id: 'canyon',
    name: '雅鲁藏布大峡谷',
    description: '世界上最深最长的河流峡谷，谷深超过5000米。峡谷两侧山壁陡峭，谷底河流湍急，垂直气候带分明。',
    baseLat: 29.8,
    baseLon: 95.0,
    heightFn: (x: number, z: number): number => {
      const canyonCenter = 0.15 * Math.sin(z * 3.5) + 0.05 * Math.cos(z * 7);
      const dist = Math.abs(x - canyonCenter);
      const canyon = -0.35 * Math.exp(-80 * dist ** 2);
      const walls = 0.5 + 0.25 * Math.pow(dist, 0.6);
      const detail = 0.08 * fbm(x * 5 + 30, z * 5 + 30, 5);
      const peaks = 0.15 * Math.exp(-4 * ((x + 0.6) ** 2 + (z - 0.3) ** 2))
                  + 0.12 * Math.exp(-5 * ((x - 0.7) ** 2 + (z + 0.2) ** 2));
      return Math.max(0.02, walls + canyon + detail + peaks);
    }
  }
];

// Generate height data for a terrain region
export function generateHeightMap(
  region: TerrainRegion,
  segments: number
): Float32Array {
  const size = segments + 1;
  const data = new Float32Array(size * size);
  for (let j = 0; j <= segments; j++) {
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * 2 - 1;
      const z = (j / segments) * 2 - 1;
      data[j * size + i] = region.heightFn(x, z);
    }
  }
  return data;
}

// Get height at a specific normalized position
export function getHeightAt(
  region: TerrainRegion,
  nx: number,
  nz: number
): number {
  return region.heightFn(nx * 2 - 1, nz * 2 - 1);
}

// Get lat/lon at a position
export function getLatLon(
  region: TerrainRegion,
  nx: number,
  nz: number
): { lat: number; lon: number } {
  return {
    lat: region.baseLat + (1 - nz) * 4 - 2,
    lon: region.baseLon + nx * 6 - 3
  };
}

// Data layer generators
export interface DataLayer {
  id: string;
  name: string;
  colorFn: (nx: number, nz: number, height: number) => { r: number; g: number; b: number; a: number } | null;
}

export const dataLayers: DataLayer[] = [
  {
    id: 'contour',
    name: '等高线',
    colorFn: (_nx, _nz, height) => {
      const interval = 0.06;
      const remainder = height % interval;
      const lineWidth = 0.004;
      if (remainder < lineWidth || interval - remainder < lineWidth) {
        return { r: 1, g: 1, b: 1, a: 0.6 };
      }
      return null;
    }
  },
  {
    id: 'vegetation',
    name: '植被覆盖',
    colorFn: (nx, nz, height) => {
      const vegNoise = fbm(nx * 6 + 100, nz * 6 + 100, 4);
      if (height < 0.15) return null; // water area
      if (height > 0.65) return null; // snow line
      const density = Math.max(0, vegNoise * 0.5 + 0.2 - height * 0.4);
      if (density < 0.15) return null;
      return { r: 0.1, g: 0.7 + density * 0.4, b: 0.1, a: Math.min(0.45, density * 0.6) };
    }
  },
  {
    id: 'rainfall',
    name: '降雨分布',
    colorFn: (nx, nz, height) => {
      const rain = fbm(nx * 4 + 200, nz * 4 + 200, 5);
      const elevationFactor = Math.max(0, 1 - height * 0.8);
      const intensity = rain * 0.6 + elevationFactor * 0.3;
      if (intensity < 0.3) return null;
      const blue = 0.4 + intensity * 0.5;
      return { r: 0.1, g: 0.2, b: blue, a: Math.min(0.4, (intensity - 0.3) * 0.8) };
    }
  }
];
