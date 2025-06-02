import { OccurrencePoint } from '../types';
import { useState, useEffect } from 'react';

interface DataTableProps {
  occurrences: OccurrencePoint[];
  limit?: number;
}

export default function DataTable({ occurrences, limit = 20 }: DataTableProps) {
  const [sortField, setSortField] = useState<keyof OccurrencePoint>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filteredData, setFilteredData] = useState<OccurrencePoint[]>([]);
    useEffect(() => {
    // Order records by the selected column
    const sorted = [...occurrences].sort((a, b) => {
      if (sortField === 'date') {
        return sortDirection === 'asc' 
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // Fallback for string comparison
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
      // Show only the requested number of records
    setFilteredData(sorted.slice(0, limit));
  }, [occurrences, sortField, sortDirection, limit]);
  
  const handleSort = (field: keyof OccurrencePoint) => {
    if (field === sortField) {
      // Flip sort direction when clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending for date, ascending for others
      setSortField(field);
      setSortDirection(field === 'date' ? 'desc' : 'asc');
    }
  };
  
  const getSortIndicator = (field: keyof OccurrencePoint) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };
  
  return (
    <div className="overflow-x-auto overflow-y-auto max-h-full">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            <th 
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('date')}
            >
              Date{getSortIndicator('date')}
            </th>
            <th 
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('latitude')}
            >
              Latitude{getSortIndicator('latitude')}
            </th>
            <th 
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('longitude')}
            >
              Longitude{getSortIndicator('longitude')}
            </th>
            <th 
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('count')}
            >
              Count{getSortIndicator('count')}
            </th>
            <th 
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('temperature')}
            >
              Temp (°C){getSortIndicator('temperature')}
            </th>
            <th 
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('precipitation')}
            >
              Precip (mm){getSortIndicator('precipitation')}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredData.length > 0 ? (
            filteredData.map((occurrence, index) => (
              <tr key={index} className={index % 2 === 0 ? '' : 'bg-gray-50'}>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{occurrence.date}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{occurrence.latitude.toFixed(4)}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{occurrence.longitude.toFixed(4)}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{occurrence.count}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{occurrence.temperature.toFixed(1)}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{occurrence.precipitation.toFixed(1)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="px-4 py-2 text-center text-sm text-gray-500">No data available</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
