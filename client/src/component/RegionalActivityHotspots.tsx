import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
}

interface TimeRange {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  currentYear: number;
  currentMonth: number;
}

interface RegionalActivityHotspotsProps {
  data: ForecastPoint[];
  timeRange: TimeRange;
  currentDate: string;
}

const RegionalActivityHotspots: React.FC<RegionalActivityHotspotsProps> = ({ 
  data, 
  timeRange, 
  currentDate 
}) => {
  // Process data by regions
  const processedData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Define latitude bands for US regions
    const regions = {
      'Southern US': { min: 25, max: 35, color: '#ef4444' },
      'Central US': { min: 35, max: 45, color: '#3b82f6' },
      'Northern US': { min: 45, max: 55, color: '#10b981' }
    };
    
    // Group data by month and calculate regional sums
    const monthlyData = new Map();
    
    data.forEach(point => {
      const monthKey = `${point.year}-${String(point.month).padStart(2, '0')}`;
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          date: new Date(point.year, point.month - 1, 1),
          monthKey,
          'Southern US': 0,
          'Central US': 0,
          'Northern US': 0
        });
      }
      
      const monthData = monthlyData.get(monthKey);
      const lat = point.latitude;
      
      if (lat !== undefined) {
        if (lat >= 25 && lat < 35) {
          monthData['Southern US'] += point.count_prediction;
        } else if (lat >= 35 && lat < 45) {
          monthData['Central US'] += point.count_prediction;
        } else if (lat >= 45 && lat < 55) {
          monthData['Northern US'] += point.count_prediction;
        }
      }
    });
    
    // Format for chart
    return Array.from(monthlyData.values())
      .map(month => ({
        date: month.date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short' 
        }),
        timestamp: month.date.getTime(),
        'Southern US': month['Southern US'],
        'Central US': month['Central US'],
        'Northern US': month['Northern US'],
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

  // Find peak months for each region
  const peakMonths = React.useMemo(() => {
    const peaks: Record<string, { month: string; value: number }> = {
      'Southern US': { month: '', value: 0 },
      'Central US': { month: '', value: 0 },
      'Northern US': { month: '', value: 0 }
    };
    
    processedData.forEach(data => {
      Object.keys(peaks).forEach(region => {
        if (data[region as keyof typeof data] > peaks[region].value) {
          peaks[region] = {
            month: data.date,
            value: data[region as keyof typeof data] as number
          };
        }
      });
    });
    
    return peaks;
  }, [processedData]);

  if (processedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 text-xs">No regional data available</p>
      </div>
    );
  }

  // Custom compact tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 p-1.5 border border-slate-600 rounded shadow-lg">
          <p className="text-xs text-white font-semibold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {`${entry.name}: ${Math.round(entry.value)} birds`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={processedData}
            margin={{
              top: 5,
              right: 10,
              left: 5,
              bottom: 25,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} stroke="#475569" />
            <XAxis 
              dataKey="timestamp"
              scale="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(timestamp) => 
                new Date(timestamp).toLocaleDateString('en-US', { 
                  month: 'short' 
                })
              }
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              angle={-45}
              textAnchor="end"
              height={25}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              width={45}
              tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
              label={{ 
                value: 'Average Sightings', 
                angle: -90, 
                position: 'insideLeft',
                style: { fontSize: 10, fill: '#94a3b8' }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '5px', fontSize: '11px' }}
              iconSize={12}
            />
            
            <Line
              type="monotone"
              dataKey="Southern US"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
            
            <Line
              type="monotone"
              dataKey="Central US"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
            
            <Line
              type="monotone"
              dataKey="Northern US"
              stroke="#10b981"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Compact Peak activity summary */}
      <div className="mt-1 p-2 bg-slate-700/50 rounded border border-slate-600">
        <h4 className="text-xs font-medium text-white mb-1">Peak Migration Times</h4>
        
        <div className="grid grid-cols-3 gap-1 text-xs">
          <div className="bg-red-900/20 p-1.5 rounded border border-red-800/30">
            <p className="font-semibold text-red-400">Southern US</p>
            <p className="text-gray-300">{peakMonths['Southern US'].month}</p>
            <p className="text-gray-400">~{peakMonths['Southern US'].value.toFixed(0)} birds</p>
          </div>
          <div className="bg-blue-900/20 p-1.5 rounded border border-blue-800/30">
            <p className="font-semibold text-blue-400">Central US</p>
            <p className="text-gray-300">{peakMonths['Central US'].month}</p>
            <p className="text-gray-400">~{peakMonths['Central US'].value.toFixed(0)} birds</p>
          </div>
          <div className="bg-green-900/20 p-1.5 rounded border border-green-800/30">
            <p className="font-semibold text-green-400">Northern US</p>
            <p className="text-gray-300">{peakMonths['Northern US'].month}</p>
            <p className="text-gray-400">~{peakMonths['Northern US'].value.toFixed(0)} birds</p>
          </div>
        </div>

      </div>
        <p className="text-xs text-gray-400 mt-1.5 leading-tight">
          
        </p>
    </div>
  );
};

export default RegionalActivityHotspots;