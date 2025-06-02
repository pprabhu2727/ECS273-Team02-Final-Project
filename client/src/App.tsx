// import { useEffect, useState } from 'react';
import BoxPlot from './component/BoxPlot';
import DensityMap from './component/DensityMap';
import DataTable from './component/DataTable';
import { useEffect, useState, useRef } from 'react';
import ForecastingChart from './component/ForecastingChart';

interface OccurrencePoint {
  date: string;
  latitude: number;
  longitude: number;
}

// Types
interface ForecastPoint {
  year: number;
  month: number;
  count_prediction: number;  // Updated field name
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


    // Forecasting data
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    startYear: 2023,
    startMonth: 1,
    endYear: 2025,
    endMonth: 12,
    currentYear: 2024,
    currentMonth: 1
  });

  const zoomRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  
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

  useEffect(() => {
    if (selectedSpecies && scientificNames[selectedSpecies]) {
      fetch(`http://localhost:8000/recent_occurrences/${encodeURIComponent(scientificNames[selectedSpecies])}`)
        .then(res => res.json())
        .then(data => setRecentData(data))
        .catch(err => console.error("Error fetching recent occurrences:", err));
    }
  }, [selectedSpecies, scientificNames]);


// Load forecast data when species changes
useEffect(() => {
  if (!selectedSpecies) return;
  
  console.log(`Fetching forecasts for: ${selectedSpecies}`);
  
  fetch(`http://localhost:8000/forecasts/${encodeURIComponent(selectedSpecies)}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then((data: SpeciesForecast) => {
      console.log(`Received ${data.forecasts.length} forecast points for ${data.species}`);
      setForecastData(data.forecasts);
      
      // Update timeline to include all data points
      if (data.forecasts.length > 0) {
        const minDate = data.forecasts.reduce((min, f) => {
          if (f.year < min.year || (f.year === min.year && f.month < min.month)) {
            return f;
          }
          return min;
        });
        
        const maxDate = data.forecasts.reduce((max, f) => {
          if (f.year > max.year || (f.year === max.year && f.month > max.month)) {
            return f;
          }
          return max;
        });
        
        setTimeRange(prev => ({
          ...prev,
          startYear: minDate.year,
          startMonth: minDate.month,
          endYear: maxDate.year,
          endMonth: maxDate.month,
        }));
      }
    })
    .catch(error => {
      console.error("Error fetching forecast data:", error);
      setForecastData([]); // Clear data on error
    });
}, [selectedSpecies]);

useEffect(() => {
  if (!selectedSpecies || !currentDate) return;

  const sciName = scientificNames[selectedSpecies];
  if (!sciName) {
    console.warn(`No scientific name mapping for selected species: ${selectedSpecies}`);
    return;
  }

  const encoded = encodeURIComponent(sciName);
  setLoading(true);

  fetch(`http://localhost:8000/heatmap?date=${currentDate}&species=${encoded}`)
    .then(res => res.json())
    .then(data => {
      if (data?.url) {
        setHeatmapUrl(`http://localhost:8000${data.url}`);
      }
    })
    .catch(err => console.error("Error generating heatmap:", err))
    .finally(() => {
      setLoading(false);
      setScale(1);
      setOffset({ x: 0, y: 0 });
    });
}, [selectedSpecies, currentDate]);



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
    <div className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat text-white">
      <div className="min-h-screen bg-black bg-opacity-60">
        <div className="bg-white bg-opacity-90 rounded-none shadow p-0.5 flex flex-wrap justify-between items-center text-black gap-4">
          <div className="relative">
            <button onClick={() => setDropdownOpen(prev => !prev)} className="px-4 py-2 bg-blue-200 rounded shadow">
              {selectedSpecies || 'Select Species'}
            </button>
            {dropdownOpen && (
              <div className="absolute mt-2 w-64 bg-white border rounded shadow z-10 max-h-64 overflow-y-auto">
                {speciesList.map(species => (
                  <div key={species} onClick={() => {
                    setSelectedSpecies(species);
                    setDropdownOpen(false);
                  }} className={`p-2 cursor-pointer hover:bg-blue-50 ${species === selectedSpecies ? "bg-blue-100" : ""}`}>
                    {species}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <select
              value={year}
              onChange={e => updateDate(parseInt(e.target.value), month, day)}
              className="border rounded px-2 py-1"
            >
              {Array.from({ length: 6 }, (_, i) => 2021 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <select
              value={month}
              onChange={e => updateDate(year, parseInt(e.target.value), day)}
              className="border rounded px-2 py-1"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>

            <div className="flex flex-col items-center text-sm">
              <input
                type="range"
                min={1}
                max={maxDays}
                value={day}
                onChange={e => updateDate(year, month, parseInt(e.target.value))}
                className="w-40"
              />
              <span>{day}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 grid-rows-2 gap-0 h-[calc(100vh-80px)]">
          <div className="bg-white bg-opacity-90 border-r border-b border-gray-300 flex flex-col h-full">
            <h3 className="text-lg font-semibold text-gray-800">Species Heatmap</h3>
            <div className="flex-grow flex items-center justify-center overflow-hidden">
              <DensityMap
                currentDate={currentDate}
                selectedSpecies={selectedSpecies}
                scientificNames={scientificNames}
              />
            </div>
          </div>

          <div className="bg-white bg-opacity-90 border-b border-gray-300 flex flex-col h-full">
            <h3 className="text-lg font-semibold text-gray-800">Box Plot</h3>
            <div className="flex-grow">
              {selectedSpecies && scientificNames[selectedSpecies] && (
                <BoxPlot scientificName={scientificNames[selectedSpecies]} />
              )}
            </div>
          </div>

          {/* <div className="bg-white bg-opacity-90 border-r border-gray-300 flex flex-col h-full">
            <h3 className="text-lg font-semibold text-gray-800">Species Information</h3>
            <div className="flex-grow flex flex-col justify-start px-4 pb-4">
              {selectedSpecies && (
                <div className="space-y-2">
                  <p className="text-gray-800"><strong>Common Name:</strong> {selectedSpecies}</p>
                  <p className="text-gray-800"><strong>Scientific Name:</strong> {scientificNames[selectedSpecies] || 'N/A'}</p>
                  <p className="text-gray-800"><strong>Selected Date:</strong> {currentDate}</p>
                </div>
              )}
            </div>
          </div>
 */}

        <div className="bg-white bg-opacity-90 border-r border-gray-300 flex flex-col h-full">
            <h3 className="text-lg font-semibold text-gray-800 p-4">Predictive Future Projections</h3>
            <div className="flex-grow overflow-hidden p-4">
              {forecastData.length > 0 ? (
                <ForecastingChart 
                  data={forecastData}
                  timeRange={timeRange}
                  currentDate={currentDate}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-600">Loading forecast data...</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white bg-opacity-90 flex flex-col h-full overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-800 px-4 pt-2">Recent Sightings</h3>
            <div className="flex-grow overflow-y-auto px-2 pb-2">
              {recentData.length > 0 ? (
                <DataTable occurrences={recentData} />
              ) : (
                <p className="text-gray-600 text-sm">No data available</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
