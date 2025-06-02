import { useEffect, useState, useRef } from 'react';

export default function App() {
  const [speciesList, setSpeciesList] = useState<string[]>([]);
  const [scientificNames, setScientificNames] = useState<Record<string, string>>({});
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('2023-01-01');
  const [heatmapUrl, setHeatmapUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scale, setScale] = useState(1);

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

  const handleWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.5, Math.min(5, prev + delta)));
  };

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y
    };
  };

  const doDrag = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    setOffset({ x: newX, y: newY });
  };

  const endDrag = () => {
    setIsDragging(false);
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
              {loading ? (
                <p className="text-lg text-blue-700">Loading heatmap...</p>
              ) : heatmapUrl ? (
                <div
                  ref={zoomRef}
                  onWheel={handleWheelZoom}
                  onMouseDown={startDrag}
                  onMouseMove={doDrag}
                  onMouseUp={endDrag}
                  onMouseLeave={endDrag}
                  className="overflow-hidden border rounded max-w-full max-h-full relative cursor-grab"
                >
                  <img
                    ref={imgRef}
                    src={heatmapUrl}
                    alt="Heatmap"
                    style={{
                      transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                      transformOrigin: 'top left'
                    }}
                    className="transition-transform duration-75 ease-in-out select-none"
                    draggable={false}
                  />
                </div>
              ) : (
                <p className="text-gray-600">Select species and date to see the heatmap.</p>
              )}
            </div>
          </div>

          <div className="bg-white bg-opacity-90 border-b border-gray-300 flex flex-col h-full">
            <h3 className="text-lg font-semibold text-gray-800">Analysis Panel</h3>
            <div className="flex-grow flex items-center justify-center">
              <p className="text-gray-600">Analysis content will go here</p>
            </div>
          </div>

          <div className="bg-white bg-opacity-90 border-r border-gray-300 flex flex-col h-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 p-4">Species Information</h3>
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

          <div className="bg-white bg-opacity-90 flex flex-col h-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 p-4">Statistics</h3>
            <div className="flex-grow flex items-center justify-center">
              <p className="text-gray-600">Statistics and metrics will go here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}