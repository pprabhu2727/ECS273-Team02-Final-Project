import { useState, useEffect } from 'react';
import * as d3 from 'd3';

/**
 * Represents a single bird occurrence record from citizen science data
 */
interface OccurrencePoint {
  date: string;
  latitude: number;
  longitude: number;
}

/**
 * Props for the DataTable component that displays bird occurrence records
 * 
 * @param occurrences - General recent occurrences data used as fallback
 * @param currentDate - Date to filter for, triggers API call for date-specific data
 * @param scientificName - Species name for fetching date-specific occurrences
 * @param limit - Maximum number of records to display (default: 20)
 */
interface DataTableProps {
  occurrences: OccurrencePoint[];
  currentDate?: string;
  scientificName?: string;
  limit?: number;
}

export default function DataTable({ occurrences, currentDate, scientificName, limit = 20 }: DataTableProps) {
  const [sortField, setSortField] = useState<keyof OccurrencePoint>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filteredData, setFilteredData] = useState<OccurrencePoint[]>([]);
  const [colorScale, setColorScale] = useState<d3.ScaleSequential<string> | null>(null);
  const [isDateFiltered, setIsDateFiltered] = useState(false);
  const [dateSpecificData, setDateSpecificData] = useState<OccurrencePoint[]>([]);
  const [loadingDateData, setLoadingDateData] = useState(false);

  /**
   * Initialize latitude-based color coding for visual patterns
   * 
   * We use D3's blues color scale to help users quickly spot migration patterns.
   * Darker blues represent northern latitudes, lighter blues southern latitudes.
   * This visual encoding makes it easier to identify seasonal north-south movements.
   */
  useEffect(() => {
    const lats = occurrences.map(o => o.latitude);
    const scale = d3.scaleSequential(d3.interpolateBlues)
      .domain([Math.min(...lats), Math.max(...lats)]);
    setColorScale(() => scale);
  }, [occurrences]);

  /**
   * Fetch date-specific occurrence data when the selected date changes
   * 
   * This effect handles the dynamic loading of bird sightings for a specific date.
   * We prioritize date-specific data over general recent occurrences because it
   * provides more relevant context for users exploring temporal patterns.
   */
  useEffect(() => {
    if (!currentDate || !scientificName) {
      setDateSpecificData([]);
      setIsDateFiltered(false);
      return;
    }

    const fetchDateSpecificData = async () => {
      setLoadingDateData(true);
      try {
        /**
         * Date adjustment for timezone compatibility
         * 
         * We subtract one day to handle timezone discrepancies between the frontend
         * and backend. This ensures that when a user selects a date, they get data
         * for the correct 24-hour period in their local context.
         */
        const date = new Date(currentDate);
        date.setDate(date.getDate() - 1);
        const adjustedDate = date.toISOString().split('T')[0];

        console.log('Original currentDate:', currentDate);
        console.log('Adjusted date being sent (minus 1 day):', adjustedDate);

        const response = await fetch(
          `http://localhost:8000/occurrences_by_date/${encodeURIComponent(scientificName)}?target_date=${adjustedDate}&limit=${limit}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const dateData = await response.json();
        console.log('Received date-specific data:', dateData);
        setDateSpecificData(dateData);
        setIsDateFiltered(dateData.length > 0);
      } catch (error) {
        console.error('Error fetching date-specific data:', error);
        setDateSpecificData([]);
        setIsDateFiltered(false);
      } finally {
        setLoadingDateData(false);
      }
    }; fetchDateSpecificData();
  }, [currentDate, scientificName, limit]);

  /**
   * Dynamic data sorting with fallback strategy
   * 
   * This effect manages the intelligent switching between date-specific data and
   * general recent occurrences. When users select a specific date, we prioritize
   * showing sightings from that exact day. If no data exists for that date,
   * we gracefully fall back to recent data so users always see something useful.
   */
  useEffect(() => {
    let dataToSort: OccurrencePoint[];

    // Prefer date-specific data when available for better temporal context
    if (isDateFiltered && dateSpecificData.length > 0) {
      dataToSort = [...dateSpecificData];
    } else {
      // Fallback to general recent data maintains usefulness even with sparse datasets
      dataToSort = [...occurrences];
    }

    /**
     * Multi-field sorting with intelligent defaults
     * 
     * Date sorting uses chronological order (newest first by default) since users
     * typically want to see recent activity. Coordinate sorting uses numerical order
     * to help identify geographic clustering patterns.
     */
    const sorted = dataToSort.sort((a, b) => {
      if (sortField === 'date') {
        return sortDirection === 'asc'
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    }); setFilteredData(sorted.slice(0, limit));
  }, [occurrences, dateSpecificData, isDateFiltered, sortField, sortDirection, limit]);

  /**
   * Interactive sorting with smart direction toggles
   * 
   * When users click the same column header twice, we reverse the sort direction.
   * When switching to a new column, we use sensible defaults: dates show newest first,
   * coordinates show ascending order for easier geographic interpretation.
   */
  const handleSort = (field: keyof OccurrencePoint) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'date' ? 'desc' : 'asc');
    }
  };

  /**
   * Visual sort indicators for user feedback
   * 
   * Simple triangular arrows (▲▼) provide immediate visual feedback about current
   * sort state without cluttering the header design.
   */
  const getSortIndicator = (field: keyof OccurrencePoint) => {
    return sortField === field ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : null;
  };

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-full">
      {/* Context-aware status banner for user guidance */}
      {currentDate && (
        <div className="px-4 py-2 bg-slate-700 text-xs text-slate-300 border-b border-slate-600">
          {loadingDateData ? (
            "Loading date-specific data..."
          ) : isDateFiltered ? (
            `Showing sightings for ${new Date(currentDate).toLocaleDateString()}`
          ) : (
            `No sightings on ${new Date(currentDate).toLocaleDateString()} - showing recent data`
          )}
        </div>)}

      {/* Responsive table with sticky header for data exploration */}
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            {['date', 'latitude', 'longitude'].map((field) => (
              <th
                key={field}
                className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort(field as keyof OccurrencePoint)}
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}
                {getSortIndicator(field as keyof OccurrencePoint)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredData.length > 0 ? (
            filteredData.map((occurrence, index) => (
              <tr
                key={index}
                style={{
                  // Apply latitude-based color coding for geographic pattern recognition
                  backgroundColor: colorScale ? colorScale(occurrence.latitude) : undefined
                }}
                className="text-gray-900"
              >                <td className="px-4 py-2 whitespace-nowrap text-sm">{new Date(occurrence.date).toLocaleDateString()}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm">{occurrence.latitude.toFixed(4)}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm">{occurrence.longitude.toFixed(4)}</td>
              </tr>
            ))
          ) : (
            // Graceful empty state messaging
            <tr>
              <td colSpan={3} className="px-4 py-2 text-center text-sm text-gray-500">
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
