import { useEffect, useState } from 'react';
import BoxPlot from './component/BoxPlot';
import DensityMap from './component/DensityMap';
import DataTable from './component/DataTable';
import ForecastingChart from './component/ForecastingChart';

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
  confidence_interval?: { lower: number; upper: number };
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
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    startYear: 2023, startMonth: 1, endYear: 2025, endMonth: 12, currentYear: 2024, currentMonth: 1
  });

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
      });
  }, []);

  useEffect(() => {
    if (selectedSpecies && scientificNames[selectedSpecies]) {
      fetch(`http://localhost:8000/recent_occurrences/${encodeURIComponent(scientificNames[selectedSpecies])}`)
        .then(res => res.json())
        .then(data => setRecentData(data));
    }
  }, [selectedSpecies, scientificNames]);

  useEffect(() => {
    if (!selectedSpecies) return;
    const sciName = scientificNames[selectedSpecies];
    if (!sciName) return;

    fetch(`http://localhost:8000/forecasts/${encodeURIComponent(sciName)}`)
      .then(res => res.json())
      .then((data: SpeciesForecast) => {
        setForecastData(data.forecasts || []);
        if (data.forecasts.length > 0) {
          const min = data.forecasts.reduce((a, b) =>
            a.year < b.year || (a.year === b.year && a.month < b.month) ? a : b
          );
          const max = data.forecasts.reduce((a, b) =>
            a.year > b.year || (a.year === b.year && a.month > b.month) ? a : b
          );
          setTimeRange({ ...timeRange, startYear: min.year, startMonth: min.month, endYear: max.year, endMonth: max.month });
        }
      });
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
    <div className="h-screen bg-black bg-opacity-60 text-black font-sans">
      {/* Fixed Header (height = 5rem) */}
      <div className="bg-white bg-opacity-90 flex items-center justify-between border-b border-black-300 relative pb-0.25">
        <div className="relative z-10">
          <button onClick={() => setDropdownOpen(prev => !prev)} className="px-3 py-1 bg-blue-200 rounded shadow">
            {selectedSpecies || 'Select Species'}
          </button>
          {dropdownOpen && (
            <div className="absolute mt-2 w-64 bg-white border rounded shadow z-50 max-h-64 overflow-y-auto">
              {speciesList.map(species => (
                <div
                  key={species}
                  onClick={() => {
                    setSelectedSpecies(species);
                    setDropdownOpen(false);
                  }}
                  className={`p-2 cursor-pointer hover:bg-blue-50 ${species === selectedSpecies ? "bg-blue-100 font-semibold" : ""}`}
                >
                  {species}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="absolute left-1/2 transform -translate-x-1/2 text-2xl font-bold text-gray-800 pointer-events-none">
          Birds Across Time
        </div>

        <div className="flex gap-3 items-center z-10">
          <select value={year} onChange={e => updateDate(+e.target.value, month, day)} className="border rounded px-2 py-1">
            {Array.from({ length: 6 }, (_, i) => 2021 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={e => updateDate(year, +e.target.value, day)} className="border rounded px-2 py-1">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <div className="flex flex-col items-center text-sm">
            <input type="range" min={1} max={maxDays} value={day} onChange={e => updateDate(year, month, +e.target.value)} className="w-40" />
            <span>{day}</span>
          </div>
        </div>
      </div>

      {/* 2x2 grid that fills exactly the remaining space (100vh - 5rem = 80px) */}
      <div className="grid grid-cols-2 grid-rows-2 h-[calc(100vh-2.5rem)]">
        <div className="bg-white bg-opacity-90 border-r border-b border-black-300 flex flex-col">
          <h3 className="text-lg font-semibold text-center text-gray-800">Species Heatmap</h3>
          <div className="flex-grow flex items-center justify-center">
            <DensityMap currentDate={currentDate} selectedSpecies={selectedSpecies} scientificNames={scientificNames} />
          </div>
        </div>

        <div className="bg-white bg-opacity-90 border-b border-black-300 flex flex-col">
          <h3 className="text-lg font-semibold text-center text-gray-800">Box Plot</h3>
          <div className="flex-grow">
            {selectedSpecies && scientificNames[selectedSpecies] && (
              <BoxPlot scientificName={scientificNames[selectedSpecies]} />
            )}
          </div>
        </div>

        <div className="bg-white bg-opacity-90 border-r border-black-300 flex flex-col">
          <h3 className="text-lg font-semibold text-center text-gray-800">Predictive Future Projections</h3>
          <div className="flex-grow overflow-hidden p-4">
            {forecastData.length > 0 ? (
              <ForecastingChart data={forecastData} timeRange={timeRange} currentDate={currentDate} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-600">Loading forecast data...</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white bg-opacity-90 flex flex-col overflow-hidden">
          <h3 className="text-lg font-semibold text-center text-gray-800 ">Recent Sightings</h3>
          <div className="flex-grow overflow-y-auto px-2 pb-2">
            {recentData.length > 0 ? (
              <DataTable occurrences={recentData} />
            ) : (
              <p className="text-gray-600 text-sm text-center">No data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
