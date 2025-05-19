import { useEffect, useState } from 'react';
import RenderSpeciesOptions from "./component/options";
import TimeSlider from "./component/TimeSlider";
import DensityMap from "./component/DensityMap";
import ForecastingChart from "./component/ForecastingChart";
import DataTable from "./component/DataTable";
import BoxPlot from "./component/BoxPlot";
import { 
  OccurrencePoint, SpeciesOccurrence, SpeciesForecast,
  ForecastPoint, SeasonalDataPoint, TimeRange,
  SpeciesSeasonalData
} from './types';

export default function App() {
  const [speciesList, setSpeciesList] = useState<string[]>([]);
  const [scientificNames, setScientificNames] = useState<Record<string, string>>({});
  const [selectedSpecies, setSelectedSpecies] = useState<string>("");
  const [occurrenceData, setOccurrenceData] = useState<OccurrencePoint[]>([]);
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);
  const [seasonalData, setSeasonalData] = useState<SeasonalDataPoint[]>([]);
  const [showClimate, setShowClimate] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
    // Timeline slider configuration
  const [timeRange, setTimeRange] = useState<TimeRange>({
    startYear: 2020,
    startMonth: 2,
    endYear: 2030,
    endMonth: 12,
    currentYear: 2023,
    currentMonth: 5
  });
  
  const [currentDate, setCurrentDate] = useState<string>("2023-06-01");
    // Load available bird species when app starts
  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:8000/species_list')
      .then(res => res.json())
      .then(data => {
        setSpeciesList(data.species);
        // Map common names to scientific names
        const nameMap: Record<string, string> = {};
        data.species.forEach((name: string, index: number) => {
          nameMap[name] = data.scientific_names[index];
        });
        setScientificNames(nameMap);
        
        // Set the first species as selected by default
        if (data.species.length > 0 && !selectedSpecies) {
          setSelectedSpecies(data.species[0]);
        }
      })
      .catch(error => {
        console.error("Error fetching species list:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);
    // Load all data when user selects a different bird species
  useEffect(() => {
    if (!selectedSpecies) return;
    
    setLoading(true);
    
    // Get bird sighting data
    fetch(`http://localhost:8000/occurrences/${selectedSpecies}`)
      .then(res => res.json())
      .then((data: SpeciesOccurrence) => {
        setOccurrenceData(data.occurrences);
          // Set timeline to match available data
        if (data.occurrences.length > 0) {
          const dates = data.occurrences.map(d => new Date(d.date));
          const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
          const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
          setTimeRange(prev => ({
            ...prev,
            startYear: minDate.getFullYear(),
            startMonth: minDate.getMonth() + 2,
            currentYear: maxDate.getFullYear(),
            currentMonth: maxDate.getMonth(),
          }));
          
          setCurrentDate(maxDate.toISOString().split('T')[0]);
        }
      })
      .catch(error => console.error("Error fetching occurrence data:", error));
      // Get future predictions
    fetch(`http://localhost:8000/forecasts/${selectedSpecies}`)
      .then(res => res.json())
      .then((data: SpeciesForecast) => {
        setForecastData(data.forecasts);
        
        // Extend timeline to include forecast years
        if (data.forecasts.length > 0) {
          const maxForecast = data.forecasts.reduce((max, f) => {
            if (f.year > max.year || (f.year === max.year && f.month > max.month)) {
              return f;
            }
            return max;
          });
          
          setTimeRange(prev => ({
            ...prev,
            endYear: maxForecast.year,
            endMonth: maxForecast.month,
          }));
        }
      })
      .catch(error => console.error("Error fetching forecast data:", error));
    
    // Fetch seasonal data
    fetch(`http://localhost:8000/seasonal/${selectedSpecies}`)
      .then(res => res.json())
      .then((data: SpeciesSeasonalData) => {
        setSeasonalData(data.seasonal_data);
      })
      .catch(error => console.error("Error fetching seasonal data:", error))
      .finally(() => {
        setLoading(false);
      });
  }, [selectedSpecies]);
    // Update visualizations when user changes the date
  const handleTimeChange = (year: number, month: number) => {
    setTimeRange(prev => ({
      ...prev,
      currentYear: year,
      currentMonth: month
    }));
    
    // Create ISO date string for data filtering
    const formattedDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    setCurrentDate(formattedDate);
  };
  
  return (
    <div className="flex flex-col h-screen w-full bg-gray-50">
      <header className="bg-blue-700 text-white p-4 flex flex-row items-center justify-between">
        <div className="flex items-center">
          <h2 className="text-2xl font-bold mr-4">Birds Across Time</h2>
          <p className="text-sm hidden md:block">Tracking Species Distribution Shifts under Climate Change</p>
        </div>
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <span className="mr-2 text-sm whitespace-nowrap">Select Species:</span>
            <RenderSpeciesOptions 
              speciesList={speciesList}
              selectedSpecies={selectedSpecies}
              onSelectSpecies={setSelectedSpecies}
            />
          </label>
          <label className="flex items-center">
            <input 
              type="checkbox" 
              checked={showClimate} 
              onChange={() => setShowClimate(!showClimate)}
              className="mr-1"
            />
            <span className="text-sm">Show Climate Overlay</span>
          </label>
        </div>
      </header>
      
      {selectedSpecies && (
        <div className="px-4 py-2 bg-blue-100">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">{selectedSpecies}</h3>
              <p className="text-sm text-gray-600 italic">{scientificNames[selectedSpecies]}</p>
            </div>
            <div className="w-full md:w-1/2 mt-2 md:mt-0">
              <TimeSlider 
                timeRange={timeRange}
                onTimeChange={handleTimeChange}
              />
            </div>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-lg font-medium">Loading data...</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] w-full p-2">
          <div className="flex flex-col w-full md:w-2/3 h-full">
            <div className="h-1/2 p-2">
              <h3 className="text-left text-xl font-medium">U.S. Occurrence Density Map</h3>
              <div className="border-2 border-gray-300 rounded-xl h-[calc(100%_-_2rem)] bg-white">
                {occurrenceData.length > 0 ? (
                  <DensityMap 
                    occurrences={occurrenceData}
                    currentDate={currentDate}
                    showClimate={showClimate}
                  />
                ) : (
                  <p className="text-center text-gray-500 mt-20">No occurrence data available</p>
                )}
              </div>
            </div>
            <div className="h-1/2 p-2">
              <h3 className="text-left text-xl font-medium h-[2rem]">Predictive Future Projections</h3>
              <div className="border-2 border-gray-300 rounded-xl h-[calc(100%_-_2rem)] bg-white">
                {forecastData.length > 0 ? (
                  <ForecastingChart 
                    data={forecastData}
                    timeRange={timeRange}
                    currentDate={currentDate}
                  />
                ) : (
                  <p className="text-center text-gray-500 mt-20">No forecast data available</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col w-full md:w-1/3 h-full">
            <div className="h-1/2 p-2">
              <h3 className="text-left text-xl font-medium h-[2rem]">Species Seasonal Variation</h3>
              <div className="border-2 border-gray-300 rounded-xl h-[calc(100%_-_2rem)] bg-white">
                {seasonalData.length > 0 ? (
                  <BoxPlot 
                    data={seasonalData}
                    currentYear={timeRange.currentYear}
                  />
                ) : (
                  <p className="text-center text-gray-500 mt-20">No seasonal data available</p>
                )}
              </div>
            </div>
            <div className="h-1/2 p-2">
              <h3 className="text-left text-xl font-medium h-[2rem]">Most Recent Occurrences</h3>
              <div className="border-2 border-gray-300 rounded-xl h-[calc(100%_-_2rem)] overflow-hidden bg-white">
                {occurrenceData.length > 0 ? (
                  <DataTable occurrences={occurrenceData} limit={12} />
                ) : (
                  <p className="text-center text-gray-500 mt-20">No occurrence data available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
