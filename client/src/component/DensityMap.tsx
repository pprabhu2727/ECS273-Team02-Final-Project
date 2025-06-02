import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import 'heatmap.js';
import 'leaflet-heatmap';

interface Occurrence {
  date: string;
  latitude: number;
  longitude: number;
  count: number;
}

interface ClimateGrid {
  date: string;
  resolution: string;
  origin: [number, number]; // [lon, lat]
  step: [number, number];   // [lonStep, latStep]
  nodata: number;
  grid: (number | null)[][];
}

interface Props {
  occurrences: Occurrence[];
  currentDate: string;
  climate: ClimateGrid;
}

function HeatLayer({ climate }: { climate: ClimateGrid }) {
  const map = useMap();

  useEffect(() => {
    if (!climate || !climate.grid) return;

    const { origin, step, grid, nodata } = climate;
    const heatmapPoints = [];

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const value = grid[r][c];
        if (value === null || value === nodata) continue;

        const lat = origin[1] + r * step[1];
        const lon = origin[0] + c * step[0];

        if (lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66) {
          heatmapPoints.push({ lat, lng: lon, value });
        }
      }
    }

    if (heatmapPoints.length === 0) return;

    console.log("Example heatmap point:", heatmapPoints[0]);

    // Auto-pan to heatmap center for debug
    const centerLat = (Math.min(...heatmapPoints.map(p => p.lat)) + Math.max(...heatmapPoints.map(p => p.lat))) / 2;
    const centerLng = (Math.min(...heatmapPoints.map(p => p.lng)) + Math.max(...heatmapPoints.map(p => p.lng))) / 2;
    map.setView([centerLat, centerLng], 6);

    const cfg = {
      radius: 40,
      maxOpacity: 1.0,
      scaleRadius: false,
      useLocalExtrema: true,
      latField: 'lat',
      lngField: 'lng',
      valueField: 'value',
      gradient: {
        0.0: '#0000ff',  // cold - blue
        0.5: '#00ff00',  // medium - green
        1.0: '#ff0000'   // hot - red
      }
    };

    const heatLayer = (L as any).heatLayer(heatmapPoints, cfg);
    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [climate, map]);

  return null;
}

export default function ClimateBirdMap({ occurrences, currentDate, climate }: Props) {
  const filteredPoints = occurrences.filter(o => o.date === currentDate);

  return (
    <MapContainer
      center={[39.5, -98.35]}
      zoom={5}
      style={{ height: '100vh', width: '100%' }}
    >
      {/* Base tile layer */}
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Climate heatmap layer */}
      <HeatLayer climate={climate} />

      {/* Bird sightings */}
      {filteredPoints.map((pt, idx) => (
        <CircleMarker
          key={idx}
          center={[pt.latitude, pt.longitude]}
          radius={4}
          pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.9 }}
        />
      ))}
    </MapContainer>
  );
}
