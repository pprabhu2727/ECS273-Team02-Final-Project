import { useEffect, useRef, useState } from 'react';
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
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    startYear: 2020,
    startMonth: 2,
    endYear: 2030,
    endMonth: 12,
    currentYear: 2023,
    currentMonth: 5
  });
  const [currentDate, setCurrentDate] = useState<string>("2023-06-01");
  const mainContentRef = useRef<HTMLDivElement>(null);

  const scrollToMain = () => {
    mainContentRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:8000/species_list')
      .then(res => res.json())
      .then(data => {
        setSpeciesList(data.species);
        const nameMap: Record<string, string> = {};
        data.species.forEach((name: string, index: number) => {
          nameMap[name] = data.scientific_names[index];
        });
        setScientificNames(nameMap);
        if (data.species.length > 0 && !selectedSpecies) {
          setSelectedSpecies(data.species[0]);
        }
      })
      .catch(error => console.error("Error fetching species list:", error))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSpecies) return;
    setLoading(true);

    fetch(`http://localhost:8000/occurrences/${selectedSpecies}`)
      .then(res => res.json())
      .then((data: SpeciesOccurrence) => {
        setOccurrenceData(data.occurrences);
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
      });

    fetch(`http://localhost:8000/forecasts/${selectedSpecies}`)
      .then(res => res.json())
      .then((data: SpeciesForecast) => {
        setForecastData(data.forecasts);
        if (data.forecasts.length > 0) {
          const maxForecast = data.forecasts.reduce((max, f) => {
            if (f.year > max.year || (f.year === max.year && f.month > max.month)) return f;
            return max;
          });
          setTimeRange(prev => ({
            ...prev,
            endYear: maxForecast.year,
            endMonth: maxForecast.month,
          }));
        }
      });

    fetch(`http://localhost:8000/seasonal/${selectedSpecies}`)
      .then(res => res.json())
      .then((data: SpeciesSeasonalData) => {
        setSeasonalData(data.seasonal_data);
      })
      .finally(() => setLoading(false));
  }, [selectedSpecies]);

  const handleTimeChange = (year: number, month: number) => {
    setTimeRange(prev => ({ ...prev, currentYear: year, currentMonth: month }));
    setCurrentDate(`${year}-${month.toString().padStart(2, '0')}-01`);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-gray-50">
      <header
        className="h-screen w-full bg-cover bg-center bg-no-repeat text-white flex flex-col justify-center items-center px-6"
        style={{ backgroundImage: "url('/bg_image_main.png')" }}
      >
        <div className="text-center max-w-3xl">
          <h2 className="text-5xl font-extrabold mb-4 text-yellow-200">Birds Across Time</h2>
          <p className="text-xl mb-8 text-blue-100">Tracking Species Distribution Shifts under Climate Change</p>
          <button
            onClick={scrollToMain}
            className="mt-6 px-6 py-3 bg-white text-blue-700 font-bold rounded-full shadow-lg transition transform hover:scale-105 active:scale-95"
          >
            Learn More
          </button>
        </div>
      </header>

      <div ref={mainContentRef}>
        {selectedSpecies && (
<div className="px-4 py-8 bg-blue-100 w-full">
  <div className="mx-auto grid grid-cols-3 items-center">
    
   <div className="relative w-fit">
  {/* Trigger box */}
  <div
    className="bg-white text-black px-4 py-2 rounded shadow cursor-pointer"
    onClick={() => setDropdownOpen((prev) => !prev)}
  >
    <span className="text-sm font-semibold">Select Species</span>
  </div>

  {/* Dropdown */}
  {dropdownOpen && (
    <div className="absolute left-0 top-full mt-1 bg-white rounded shadow-lg p-4 w-72 z-10">
      <div className="flex flex-col gap-3 max-h-72 overflow-y-auto">
        {speciesList.map((species) => (
          <div
            key={species}
            onClick={() => {
              setSelectedSpecies(species);
              setDropdownOpen(false); // close after selection
            }}
            className={`flex justify-between items-center gap-2 p-2 border rounded hover:bg-blue-50 cursor-pointer ${
              selectedSpecies === species ? 'bg-blue-100' : ''
            }`}
          >
            <span className="text-sm">{species}</span>
            <img
              src={`https://example.com/images/${species.replace(/ /g, '_').toLowerCase()}.jpg`}
              alt={species}
              className="w-12 h-12 object-cover rounded border"
            />
          </div>
        ))}
      </div>
    </div>
  )}
</div>



    {/* Center: Species Name */}
    <div className="flex flex-col items-center justify-center text-center">
      <h3 className="text-xl font-semibold">{selectedSpecies}</h3>
      <p className="text-sm text-gray-700 italic">{scientificNames[selectedSpecies]}</p>
    </div>

    {/* Right: Slider */}
    <div className="flex justify-end">
      <TimeSlider timeRange={timeRange} onTimeChange={handleTimeChange} />
    </div>



    
  </div>
</div>


        )}

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <p className="text-lg font-medium">Loading data...</p>
          </div>
        ) : (
          <div className="flex flex-col w-full max-w-6xl mx-auto p-4 space-y-8">
            <section>
              <h3 className="text-2xl font-semibold mb-2">U.S. Occurrence Density Map</h3>
              <div className="border rounded-xl h-[400px] bg-white shadow">
                {occurrenceData.length > 0 ? (
                  <DensityMap occurrences={occurrenceData} currentDate={currentDate} showClimate={showClimate} />
                ) : (
                  <p className="text-center text-gray-500 mt-20">No occurrence data available</p>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-2xl font-semibold mb-2">Predictive Future Projections</h3>
              <div className="border rounded-xl h-[400px] bg-white shadow">
                {forecastData.length > 0 ? (
                  <ForecastingChart data={forecastData} timeRange={timeRange} currentDate={currentDate} />
                ) : (
                  <p className="text-center text-gray-500 mt-20">No forecast data available</p>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-2xl font-semibold mb-2">Species Seasonal Variation</h3>
              <div className="border rounded-xl h-[400px] bg-white shadow">
                {seasonalData.length > 0 ? (
                  <BoxPlot data={seasonalData} currentYear={timeRange.currentYear} />
                ) : (
                  <p className="text-center text-gray-500 mt-20">No seasonal data available</p>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-2xl font-semibold mb-2">Most Recent Occurrences</h3>
              <div className="border rounded-xl h-[400px] bg-white shadow overflow-hidden">
                {occurrenceData.length > 0 ? (
                  <DataTable occurrences={occurrenceData} limit={12} />
                ) : (
                  <p className="text-center text-gray-500 mt-20">No occurrence data available</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
