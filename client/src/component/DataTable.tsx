import { useState, useEffect } from 'react';
import * as d3 from 'd3';

interface OccurrencePoint {
  date: string;
  latitude: number;
  longitude: number;
}

interface DataTableProps {
  occurrences: OccurrencePoint[];
  limit?: number;
}

export default function DataTable({ occurrences, limit = 20 }: DataTableProps) {
  const [sortField, setSortField] = useState<keyof OccurrencePoint>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filteredData, setFilteredData] = useState<OccurrencePoint[]>([]);
  const [colorScale, setColorScale] = useState<d3.ScaleSequential<string> | null>(null);

  useEffect(() => {
    // Initialize color scale for latitude using D3
    const lats = occurrences.map(o => o.latitude);
    const scale = d3.scaleSequential(d3.interpolateBlues)
      .domain([Math.min(...lats), Math.max(...lats)]);
    setColorScale(() => scale);
  }, [occurrences]);

  useEffect(() => {
    const sorted = [...occurrences].sort((a, b) => {
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
    });

    setFilteredData(sorted.slice(0, limit));
  }, [occurrences, sortField, sortDirection, limit]);

  const handleSort = (field: keyof OccurrencePoint) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'date' ? 'desc' : 'asc');
    }
  };

  const getSortIndicator = (field: keyof OccurrencePoint) => {
    return sortField === field ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : null;
  };

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-full">
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
                  backgroundColor: colorScale ? colorScale(occurrence.latitude) : undefined
                }}
                className="text-gray-900"
              >
                <td className="px-4 py-2 whitespace-nowrap text-sm">{new Date(occurrence.date).toLocaleDateString()}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm">{occurrence.latitude.toFixed(4)}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm">{occurrence.longitude.toFixed(4)}</td>
              </tr>
            ))
          ) : (
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
