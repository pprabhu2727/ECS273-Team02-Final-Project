import { useEffect, useState } from 'react';
import { MapPin, TrendingUp, Activity, Globe } from 'lucide-react';
import BoxPlot from './component/BoxPlot';
import DensityMap from './component/DensityMap';
import DataTable from './component/DataTable';
import RegionalActivityHotspots from './component/RegionalActivityHotspots';

/**
 * Global window extension to allow components to trigger date changes
 * This enables interactive date selection from child components
 */
declare global {
  interface Window {
    selectDate?: (dateStr: string) => void;
  }
}

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
  latitude: number;
  longitude: number;
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const AVAILABLE_YEARS = [2021, 2022, 2023, 2024, 2025, 2026];

export default function App() {
  // Core application state
  const [speciesList, setSpeciesList] = useState<string[]>([]);
  const [scientificNames, setScientificNames] = useState<Record<string, string>>({});
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('2023-01-01');

  // Data state for different visualizations
  const [recentData, setRecentData] = useState<OccurrencePoint[]>([]);
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    startYear: 2023,
    startMonth: 1,
    endYear: 2025,
    endMonth: 12,
    currentYear: 2024,
    currentMonth: 1
  });  /**
   * Set up global date selection function for child components
   * This allows any component to trigger a date change in the main app state
   */
  useEffect(() => {
    window.selectDate = (dateStr: string) => {
      setCurrentDate(dateStr);
    };

    return () => {
      delete window.selectDate;
    };
  }, []);

  /**
   * Initialize species data on component mount
   * Fetches available species and creates mapping from common to scientific names
   */
  useEffect(() => {
    const loadSpeciesData = async () => {
      try {
        const response = await fetch('http://localhost:8000/species_list');
        const data = await response.json();

        setSpeciesList(data.species);

        // Create mapping from common names to scientific names for API calls
        const nameMapping: Record<string, string> = {};
        data.species.forEach((common: string, index: number) => {
          nameMapping[common] = data.scientific_names[index];
        });
        setScientificNames(nameMapping);

        // Auto-select first species if available
        if (data.species.length > 0) {
          setSelectedSpecies(data.species[0]);
        }
      } catch (error) {
        console.error("Failed to load species data:", error);
      }
    };

    loadSpeciesData();
  }, []);

  /**
   * Load recent occurrence data when species selection changes
   * Uses scientific name for API calls since that's what the backend expects
   */
  useEffect(() => {
    const loadRecentOccurrences = async () => {
      if (!selectedSpecies || !scientificNames[selectedSpecies]) {
        return;
      }

      try {
        const scientificName = scientificNames[selectedSpecies];
        const response = await fetch(
          `http://localhost:8000/recent_occurrences/${encodeURIComponent(scientificName)}`
        );
        const data = await response.json();
        setRecentData(data);
      } catch (error) {
        console.error("Failed to load recent occurrences:", error);
      }
    };

    loadRecentOccurrences();
  }, [selectedSpecies, scientificNames]);

  /**
   * Load forecast data and update time range when species changes
   * Also calculates the available date range from the forecast data to set proper bounds
   */
  useEffect(() => {
    const loadForecastData = async () => {
      if (!selectedSpecies) return;

      try {
        const scientificName = scientificNames[selectedSpecies];
        if (!scientificName) {
          console.warn(`No scientific name mapping found for: ${selectedSpecies}`);
          setForecastData([]);
          return;
        }

        const response = await fetch(
          `http://localhost:8000/forecasts/${encodeURIComponent(scientificName)}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: SpeciesForecast = await response.json();

        if (!data.forecasts || data.forecasts.length === 0) {
          throw new Error('Received empty forecast data');
        }

        setForecastData(data.forecasts);

        // Calculate time range bounds from forecast data for proper visualization scaling
        const dateRange = calculateDateRange(data.forecasts);
        setTimeRange(prev => ({
          ...prev,
          ...dateRange
        }));
      } catch (error) {
        console.error("Failed to load forecast data:", error);
        setForecastData([]);
      }
    };

    loadForecastData();
  }, [selectedSpecies, scientificNames]);

  /**
   * Helper function to find the min and max dates from forecast data
   * This is used to set proper bounds for the time range visualization
   */
  const calculateDateRange = (forecasts: ForecastPoint[]) => {
    const minDate = forecasts.reduce((min, forecast) =>
      (forecast.year < min.year || (forecast.year === min.year && forecast.month < min.month))
        ? forecast : min
    );

    const maxDate = forecasts.reduce((max, forecast) =>
      (forecast.year > max.year || (forecast.year === max.year && forecast.month > max.month))
        ? forecast : max
    );

    return {
      startYear: minDate.year,
      startMonth: minDate.month,
      endYear: maxDate.year,
      endMonth: maxDate.month,
    };
  };  // Parse current date for date picker controls
  const dateObj = new Date(currentDate);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  const day = dateObj.getDate();

  // Calculate maximum valid days for the current month to prevent invalid dates
  const maxDaysInCurrentMonth = new Date(year, month + 1, 0).getDate();

  /**
   * Updates the current date while ensuring the day is valid for the new month/year
   * This prevents issues like selecting Feb 30th by clamping to valid range
   */
  const handleDateChange = (newYear: number, newMonth: number, newDay: number) => {
    const maxDaysInNewMonth = new Date(newYear, newMonth + 1, 0).getDate();
    const validDay = Math.min(newDay, maxDaysInNewMonth);
    const updatedDate = new Date(newYear, newMonth, validDay);
    setCurrentDate(updatedDate.toISOString().slice(0, 10));
  };
  return (
    <div className="h-screen bg-slate-900 overflow-hidden flex flex-col">
      {/* Top navigation bar with species selector and date controls */}
      <div className="bg-slate-800 px-2 py-1 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-white">Species:</span>
          <select
            value={selectedSpecies}
            onChange={(e) => setSelectedSpecies(e.target.value)}
            className="bg-slate-700 text-white px-2 py-0.5 rounded text-xs"
          >
            {speciesList.map((species) => (
              <option key={species} value={species}>{species}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
          <Globe className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-white text-sm">Birds Across Time</span>
        </div>

        {/* Date selection controls */}
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={e => handleDateChange(parseInt(e.target.value), month, day)}
            className="bg-slate-700 text-white px-2 py-0.5 rounded text-xs"
          >
            {AVAILABLE_YEARS.map(yearOption => (
              <option key={yearOption} value={yearOption}>{yearOption}</option>
            ))}
          </select>
          <select
            value={month}
            onChange={e => handleDateChange(year, parseInt(e.target.value), day)}
            className="bg-slate-700 text-white px-2 py-0.5 rounded text-xs min-w-[80px]"
          >
            {MONTH_NAMES.map((monthName, index) => (
              <option key={index} value={index}>{monthName}</option>
            ))}
          </select>
          <input
            type="range"
            min={1}
            max={maxDaysInCurrentMonth}
            value={day}
            onChange={e => handleDateChange(year, month, parseInt(e.target.value))}
            className="w-20 h-2"
          />
          <span className="text-white min-w-[20px]">{day}</span>
        </div>
      </div>      {/* Main dashboard grid layout */}
      <div className="flex-1 p-1 grid gap-1" style={{
        display: 'grid',
        gridTemplateColumns: '58% 42%',
        gridTemplateRows: '49% 51%',
        height: 'calc(100vh - 28px)'
      }}>
        {/* Geographic occurrence visualization - takes up larger left area */}
        <div className="bg-slate-800 rounded overflow-hidden">
          <div className="bg-slate-700 px-1 py-0.5 text-xs font-semibold text-white flex items-center gap-1">
            <Activity className="w-3 h-3 text-blue-400" />
            Occurrence Map
          </div>
          <div style={{ height: 'calc(100% - 20px)' }}>
            <DensityMap
              key={`${selectedSpecies}-${currentDate}`}
              currentDate={currentDate}
              selectedSpecies={selectedSpecies}
              scientificNames={scientificNames}
            />
          </div>
        </div>

        {/* Seasonal variation analysis - compact visualization */}
        <div className="bg-slate-800 rounded overflow-hidden">
          <div className="bg-slate-700 px-1 py-0.5 text-xs font-semibold text-white flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-green-400" />
            Species Seasonal Variation
          </div>
          <div style={{ height: 'calc(100% - 20px)' }}>
            {selectedSpecies && scientificNames[selectedSpecies] && (
              <BoxPlot
                scientificName={scientificNames[selectedSpecies]}
                currentDate={currentDate}
              />
            )}
          </div>
        </div>

        {/* Forecast predictions - displays temporal trends */}
        <div className="bg-slate-800 rounded overflow-hidden">
          <div className="bg-slate-700 px-1 py-0.5 text-xs font-semibold text-white flex items-center gap-1">
            <Globe className="w-3 h-3 text-purple-400" />
            Predicted Species Occurrences
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

        {/* Recent observations data table - scrollable for detailed records */}
        <div className="bg-slate-800 rounded overflow-hidden">
          <div className="bg-slate-700 px-1 py-0.5 text-xs font-semibold text-white flex items-center gap-1">
            <MapPin className="w-3 h-3 text-orange-400" />
            Recent Sightings ({recentData.length})
          </div>
          <div style={{ height: 'calc(100% - 20px)' }} className="overflow-auto">
            {recentData.length > 0 ? (
              <DataTable
                occurrences={recentData}
                currentDate={currentDate}
                scientificName={scientificNames[selectedSpecies]}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400 text-xs">No data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}