import { useState, useRef, useCallback } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import Terrain, { TERRAIN_SIZE } from './Terrain';
import DataLayers from './DataLayers';
import ProfileTool from './ProfileTool';
import { terrainRegions, dataLayers, TerrainRegion } from './terrainData';

type ProfilePoint = { x: number; z: number };
type Profile3D = THREE.Vector3[];

export default function App() {
  const [activeRegion, setActiveRegion] = useState<string>('plateau');
  const [activeLayers, setActiveLayers] = useState<string[]>([]);
  const [hoverInfo, setHoverInfo] = useState<{
    lat: number; lon: number; elev: number; screenX: number; screenY: number;
  } | null>(null);
  const [profileMode, setProfileMode] = useState(false);
  const [profilePoints2D, setProfilePoints2D] = useState<ProfilePoint[]>([]);
  const [profilePoints3D, setProfilePoints3D] = useState<Profile3D>(null);
  const [showProfile, setShowProfile] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const region = terrainRegions.find((r) => r.id === activeRegion)!;

  const toggleLayer = (id: string) => {
    setActiveLayers((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  };

  const handlePointerMove = useCallback(
    (point: THREE.Vector3, nx: number, nz: number, height: number, event?: PointerEvent) => {
      if (!region) return;
      const lat = region.baseLat + (1 - nz) * 4 - 2;
      const lon = region.baseLon + nx * 6 - 3;
      const elev = Math.round(height * 8000);

      // Get screen position from the pointer event
      let screenX = 0;
      let screenY = 0;
      if (event) {
        const rect = canvasWrapRef.current?.getBoundingClientRect();
        if (rect) {
          screenX = event.clientX - rect.left;
          screenY = event.clientY - rect.top;
        }
      }

      setHoverInfo({ lat, lon, elev, screenX, screenY });
    },
    [region]
  );

  const handleTerrainClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!profileMode) return;
      e.stopPropagation();
      const point = e.point;
      const halfSize = TERRAIN_SIZE / 2;
      const nx = (point.x + halfSize) / TERRAIN_SIZE;
      const nz = (point.z + halfSize) / TERRAIN_SIZE;

      const newPoint = { x: nx, z: nz };
      const newPoints = [...profilePoints2D, newPoint];

      if (newPoints.length === 1) {
        setProfilePoints2D(newPoints);
        setProfilePoints3D([point.clone()]);
      } else if (newPoints.length === 2) {
        setProfilePoints2D(newPoints);
        setProfilePoints3D([profilePoints3D![0], point.clone()]);
        setShowProfile(true);
        setProfileMode(false);
      }
    },
    [profileMode, profilePoints2D, profilePoints3D]
  );

  const handleTerrainPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const nativeEvent = e.nativeEvent as PointerEvent;
      handlePointerMove(e.point, 0, 0, 0, nativeEvent);

      // Recalculate for info bar
      const point = e.point;
      const halfSize = TERRAIN_SIZE / 2;
      const nx = (point.x + halfSize) / TERRAIN_SIZE;
      const nz = (point.z + halfSize) / TERRAIN_SIZE;
      if (region) {
        const lat = region.baseLat + (1 - nz) * 4 - 2;
        const lon = region.baseLon + nx * 6 - 3;
        const heights = (e.object as THREE.Mesh).geometry.attributes.position;
        const elev = Math.round(point.y * 8000 / (TERRAIN_SIZE * 0.45));
        const rect = canvasWrapRef.current?.getBoundingClientRect();
        const screenX = rect ? nativeEvent.clientX - rect.left : 0;
        const screenY = rect ? nativeEvent.clientY - rect.top : 0;
        setHoverInfo({ lat, lon, elev: Math.max(0, elev), screenX, screenY });
      }
    },
    [region, handlePointerMove]
  );

  const closeProfile = () => {
    setShowProfile(false);
    setProfilePoints2D([]);
    setProfilePoints3D(null);
  };

  const switchRegion = (id: string) => {
    setActiveRegion(id);
    closeProfile();
    setProfileMode(false);
  };

  const enterProfileMode = () => {
    setProfileMode(true);
    setProfilePoints2D([]);
    setProfilePoints3D(null);
    setShowProfile(false);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={canvasWrapRef} style={{ width: '100%', height: '100%' }}>
        <Canvas
          camera={{ position: [15, 12, 15], fov: 50, near: 0.1, far: 200 }}
          style={{ background: '#0c1222' }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 15, 10]} intensity={1.2} castShadow />
          <directionalLight position={[-5, 8, -5]} intensity={0.3} color="#a5b4fc" />
          <pointLight position={[0, 20, 0]} intensity={0.3} color="#818cf8" />

          <Sky
            distance={450000}
            sunPosition={[100, 50, 100]}
            inclination={0.52}
            azimuth={0.25}
            rayleigh={0.5}
          />
          <Stars radius={100} depth={50} count={2000} factor={4} fade />

          <Terrain
            region={region}
            profilePoints={profilePoints3D}
            onPointerMove={() => {}}
            onPointerOut={() => setHoverInfo(null)}
          />

          <DataLayers region={region} activeLayers={activeLayers} layers={dataLayers} />

          {/* Invisible click plane for profile tool */}
          {profileMode && (
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, TERRAIN_SIZE * 0.25, 0]}
              onClick={handleTerrainClick}
              visible={false}
            >
              <planeGeometry args={[TERRAIN_SIZE * 2, TERRAIN_SIZE * 2]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
          )}

          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            mouseButtons={{
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN,
            }}
            maxPolarAngle={Math.PI / 2.1}
            minDistance={5}
            maxDistance={50}
          />
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="ui-overlay">
        {/* Layer panel */}
        <div className="layer-panel">
          <h3>数据图层</h3>
          {dataLayers.map((layer) => (
            <div
              key={layer.id}
              className="layer-item"
              onClick={() => toggleLayer(layer.id)}
            >
              <div className={`layer-checkbox ${activeLayers.includes(layer.id) ? 'checked' : ''}`} />
              <span>{layer.name}</span>
            </div>
          ))}
        </div>

        {/* Region panel */}
        <div className="region-panel">
          <h3>地貌区域</h3>
          {terrainRegions.map((r) => (
            <button
              key={r.id}
              className={`region-btn ${activeRegion === r.id ? 'active' : ''}`}
              onClick={() => switchRegion(r.id)}
            >
              {r.name}
            </button>
          ))}
          {region && <div className="region-info">{region.description}</div>}
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <button
            className={`tool-btn ${profileMode ? 'active' : ''}`}
            onClick={profileMode ? () => setProfileMode(false) : enterProfileMode}
          >
            {profileMode ? '取消绘制' : '剖面工具'}
          </button>
          {showProfile && (
            <button className="tool-btn" onClick={closeProfile}>
              清除剖面
            </button>
          )}
        </div>

        {/* Hover info */}
        {hoverInfo && (
          <div className="info-bar">
            <div className="info-item">
              <span className="info-label">纬度</span>
              <span className="info-value">{hoverInfo.lat.toFixed(4)}°</span>
            </div>
            <div className="info-item">
              <span className="info-label">经度</span>
              <span className="info-value">{hoverInfo.lon.toFixed(4)}°</span>
            </div>
            <div className="info-item">
              <span className="info-label">海拔</span>
              <span className="info-value">{hoverInfo.elev}m</span>
            </div>
          </div>
        )}

        {/* Profile panel */}
        {showProfile && profilePoints2D.length === 2 && (
          <ProfileTool
            region={region}
            points={profilePoints2D}
            onClose={closeProfile}
          />
        )}
      </div>

      {/* Tooltip near cursor */}
      {hoverInfo && (
        <div
          ref={tooltipRef}
          className="tooltip-3d"
          style={{
            display: 'block',
            left: hoverInfo.screenX + 16,
            top: hoverInfo.screenY - 8,
          }}
        >
          <div>{hoverInfo.lat.toFixed(4)}°N, {hoverInfo.lon.toFixed(4)}°E</div>
          <div>海拔: {hoverInfo.elev}m</div>
        </div>
      )}
    </div>
  );
}
