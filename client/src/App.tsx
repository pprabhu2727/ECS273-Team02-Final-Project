import { useEffect, useState, useRef } from 'react';
import { Calendar, ChevronDown, Loader2, MapPin, TrendingUp, Activity, Globe } from 'lucide-react';
import BoxPlot from './component/BoxPlot';
import DensityMap from './component/DensityMap';
import DataTable from './component/DataTable';
import RegionalActivityHotspots from './component/RegionalActivityHotspots';

interface OccurrencePoint {
  date: string;
  latitude: number;
  longitude: number;
}

interface ForecastPoint {
  year: number;
  month: number;
  count_prediction: number;
  range_north: number;
  range_south: number;
  range_east: number;
  range_west: number;
  confidence_interval?: {
    lower: number;
    upper: number;
  };
}

interface SpeciesForecast {
  species: string;
  scientific_name: string;
  forecasts: ForecastPoint[];
}

interface TimeRange {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  currentYear: number;
  currentMonth: number;
}

export default function App() {
  const [speciesList, setSpeciesList] = useState<string[]>([]);
  const [scientificNames, setScientificNames] = useState<Record<string, string>>({});
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('2023-01-01');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [recentData, setRecentData] = useState<OccurrencePoint[]>([]);
  const [heatmapUrl, setHeatmapUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    startYear: 2023,
    startMonth: 1,
    endYear: 2025,
    endMonth: 12,
    currentYear: 2024,
    currentMonth: 1
  });

  // Fetch species list
  useEffect(() => {
    fetch('http://localhost:8000/species_list')
      .then(res => res.json())
      .then(data => {
        setSpeciesList(data.species);
        const map: Record<string, string> = {};
        data.species.forEach((common: string, i: number) => {
          map[common] = data.scientific_names[i];
        });
        setScientificNames(map);
        if (data.species.length > 0) setSelectedSpecies(data.species[0]);
      })
      .catch(err => console.error("Error fetching species list:", err));
  }, []);

  // Fetch recent occurrences
  useEffect(() => {
    if (selectedSpecies && scientificNames[selectedSpecies]) {
      fetch(`http://localhost:8000/recent_occurrences/${encodeURIComponent(scientificNames[selectedSpecies])}`)
        .then(res => res.json())
        .then(data => setRecentData(data))
        .catch(err => console.error("Error fetching recent occurrences:", err));
    }
  }, [selectedSpecies, scientificNames]);

  // Fetch forecast data
  useEffect(() => {
    if (!selectedSpecies) return;

    const fetchForecastData = async () => {
      try {
        const sciName = scientificNames[selectedSpecies];
        if (!sciName) {
          console.warn(`No scientific name mapping for: ${selectedSpecies}`);
          setForecastData([]);
          return;
        }

        const response = await fetch(
          `http://localhost:8000/forecasts/${encodeURIComponent(sciName)}`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data: SpeciesForecast = await response.json();

        if (!data.forecasts || data.forecasts.length === 0) {
          throw new Error('Received empty forecast data');
        }

        setForecastData(data.forecasts);
        
        if (data.forecasts.length > 0) {
          const minDate = data.forecasts.reduce((min, f) => 
            (f.year < min.year || (f.year === min.year && f.month < min.month)) ? f : min
          );
          
          const maxDate = data.forecasts.reduce((max, f) => 
            (f.year > max.year || (f.year === max.year && f.month > max.month)) ? f : max
          );
          
          setTimeRange(prev => ({
            ...prev,
            startYear: minDate.year,
            startMonth: minDate.month,
            endYear: maxDate.year,
            endMonth: maxDate.month,
          }));
        }
      } catch (error) {
        console.error("Error fetching forecast data:", error);
        setForecastData([]);
      }
    };

    fetchForecastData();
  }, [selectedSpecies, scientificNames]);

  const dateObj = new Date(currentDate);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  const day = dateObj.getDate();
  const maxDays = new Date(year, month + 1, 0).getDate();

  const updateDate = (newYear: number, newMonth: number, newDay: number) => {
    const safeDay = Math.min(newDay, new Date(newYear, newMonth + 1, 0).getDate());
    const updated = new Date(newYear, newMonth, safeDay);
    setCurrentDate(updated.toISOString().slice(0, 10));
  };

  return (
    <div className="h-screen bg-slate-900 overflow-hidden flex flex-col">
      {/* Minimal inline header */}
      <div className="bg-slate-800 px-2 py-1 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Globe className="w-3 h-3 text-blue-400" />
          <span className="font-semibold text-white">Bird Migration Tracker</span>
          <select
            value={selectedSpecies}
            onChange={(e) => setSelectedSpecies(e.target.value)}
            className="bg-slate-700 text-white px-1 py-0.5 rounded text-xs"
          >
            {speciesList.map((species) => (
              <option key={species} value={species}>{species}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <select
            value={year}
            onChange={e => updateDate(parseInt(e.target.value), month, day)}
            className="bg-slate-700 text-white px-1 rounded text-xs"
          >
            {[2021,2022,2023,2024,2025,2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={month}
            onChange={e => updateDate(year, parseInt(e.target.value), day)}
            className="bg-slate-700 text-white px-1 rounded text-xs"
          >
            {['J','F','M','A','M','J','J','A','S','O','N','D'].map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <input
            type="range"
            min={1}
            max={maxDays}
            value={day}
            onChange={e => updateDate(year, month, parseInt(e.target.value))}
            className="w-10 h-1"
          />
          <span className="text-white">{day}</span>
        </div>
      </div>

      {/* Main content - custom grid */}
      <div className="flex-1 p-1 grid gap-1" style={{ 
        display: 'grid',
        gridTemplateColumns: '55% 42%',
        gridTemplateRows: '49% 53%',
        height: 'calc(100vh - 28px)'
      }}>
        {/* Heatmap - wider for USA map */}
        <div className="bg-slate-800 rounded overflow-hidden">
          <div className="bg-slate-700 px-1 py-0.5 text-xs font-semibold text-white flex items-center gap-1">
            <Activity className="w-3 h-3 text-blue-400" />
            Heatmap
          </div>
          <div style={{ height: 'calc(100% - 20px)' }}>
            <DensityMap
              currentDate={currentDate}
              selectedSpecies={selectedSpecies}
              scientificNames={scientificNames}
            />
          </div>
        </div>

        {/* Box Plot - narrower */}
        <div className="bg-slate-800 rounded overflow-hidden">
          <div className="bg-slate-700 px-1 py-0.5 text-xs font-semibold text-white flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-green-400" />
            Monthly
          </div>
          <div style={{ height: 'calc(100% - 20px)' }}>
            {selectedSpecies && scientificNames[selectedSpecies] && (
              <BoxPlot scientificName={scientificNames[selectedSpecies]} />
            )}
          </div>
        </div>

        {/* Regional Activity - taller for line chart */}
        <div className="bg-slate-800 rounded overflow-hidden">
          <div className="bg-slate-700 px-1 py-0.5 text-xs font-semibold text-white flex items-center gap-1">
            <Globe className="w-3 h-3 text-purple-400" />
            Regional
          </div>
          <div style={{ height: 'calc(100% - 20px)' }}>
            {forecastData.length > 0 ? (
              <RegionalActivityHotspots 
                data={forecastData}
                timeRange={timeRange}
                currentDate={currentDate}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400 text-xs">Loading...</p>
              </div>
            )}
          </div>
        </div>

        {/* Table - can scroll */}
        <div className="bg-slate-800 rounded overflow-hidden">
          <div className="bg-slate-700 px-1 py-0.5 text-xs font-semibold text-white flex items-center gap-1">
            <MapPin className="w-3 h-3 text-orange-400" />
            Sightings ({recentData.length})
          </div>
          <div style={{ height: 'calc(100% - 20px)' }} className="overflow-auto">
            {recentData.length > 0 ? (
              <DataTable occurrences={recentData} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400 text-xs">No data</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}