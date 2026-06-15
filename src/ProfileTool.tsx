import { useRef, useEffect, useCallback } from 'react';
import { TerrainRegion, getHeightAt } from './terrainData';
import { TERRAIN_SIZE } from './Terrain';

interface ProfileToolProps {
  region: TerrainRegion;
  points: { x: number; z: number }[];
  onClose: () => void;
}

export default function ProfileTool({ region, points, onClose }: ProfileToolProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawProfile = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };

    ctx.clearRect(0, 0, W, H);

    const p0 = points[0];
    const p1 = points[1];
    const numSamples = 150;
    const elevations: number[] = [];
    const distances: number[] = [];

    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const nx = p0.x + (p1.x - p0.x) * t;
      const nz = p0.z + (p1.z - p0.z) * t;
      const h = getHeightAt(region, nx, nz);
      elevations.push(h);
      const dx = (p1.x - p0.x) * TERRAIN_SIZE;
      const dz = (p1.z - p0.z) * TERRAIN_SIZE;
      distances.push(t * Math.sqrt(dx * dx + dz * dz));
    }

    const maxElev = Math.max(...elevations) * 1.1;
    const minElev = Math.min(0, Math.min(...elevations));
    const maxDist = distances[distances.length - 1];

    const plotW = W - padding.left - padding.right;
    const plotH = H - padding.top - padding.bottom;

    // Grid
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(W - padding.right, y);
      ctx.stroke();
    }

    // Axes labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const val = maxElev - ((maxElev - minElev) / 4) * i;
      const y = padding.top + (plotH / 4) * i;
      ctx.fillText(`${(val * 8000).toFixed(0)}m`, padding.left - 5, y + 3);
      ctx.textAlign = 'left';
      if (i === 4) {
        ctx.fillText(`0km`, padding.left, H - padding.bottom + 14);
      }
      if (i === 0) {
        ctx.textAlign = 'right';
        ctx.fillText(`${maxDist.toFixed(1)}km`, W - padding.right, H - padding.bottom + 14);
      }
      ctx.textAlign = 'center';
    }

    // Fill area
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + plotH);
    for (let i = 0; i <= numSamples; i++) {
      const x = padding.left + (i / numSamples) * plotW;
      const ey = padding.top + plotH - ((elevations[i] - minElev) / (maxElev - minElev)) * plotH;
      ctx.lineTo(x, ey);
    }
    ctx.lineTo(padding.left + plotW, padding.top + plotH);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, H - padding.bottom);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.05)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Profile line
    ctx.beginPath();
    for (let i = 0; i <= numSamples; i++) {
      const x = padding.left + (i / numSamples) * plotW;
      const ey = padding.top + plotH - ((elevations[i] - minElev) / (maxElev - minElev)) * plotH;
      if (i === 0) ctx.moveTo(x, ey);
      else ctx.lineTo(x, ey);
    }
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Point labels
    ctx.fillStyle = '#f59e0b';
    const startY = padding.top + plotH - ((elevations[0] - minElev) / (maxElev - minElev)) * plotH;
    const endY = padding.top + plotH - ((elevations[numSamples] - minElev) / (maxElev - minElev)) * plotH;
    ctx.beginPath();
    ctx.arc(padding.left, startY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(padding.left + plotW, endY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('A', padding.left - 2, startY - 8);
    ctx.textAlign = 'right';
    ctx.fillText('B', padding.left + plotW + 2, endY - 8);

    // Axis label
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('距离', W / 2, H - 4);
  }, [region, points]);

  useEffect(() => {
    drawProfile();
  }, [drawProfile]);

  if (points.length < 2) return null;

  return (
    <div className="profile-panel">
      <h3>
        地形剖面图
        <button className="profile-close" onClick={onClose}>×</button>
      </h3>
      <div className="hint">A → B 剖面高程变化</div>
      <div className="profile-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={348}
          height={120}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
