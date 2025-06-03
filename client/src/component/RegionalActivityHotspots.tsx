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
      'Southern US (25-35°N)': { min: 25, max: 35, color: '#ef4444' }, // red
      'Central US (35-45°N)': { min: 35, max: 45, color: '#3b82f6' },  // blue
      'Northern US (45-55°N)': { min: 45, max: 55, color: '#10b981' }  // green
    };
    
    // Group data by month and calculate regional averages
    const monthlyData = new Map();
    
    data.forEach(point => {
      const monthKey = `${point.year}-${String(point.month).padStart(2, '0')}`;
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          date: new Date(point.year, point.month - 1, 1),
          monthKey,
          'Southern US': 0,
          'Central US': 0,
          'Northern US': 0,
          'Southern Count': 0,
          'Central Count': 0,
          'Northern Count': 0
        });
      }
      
      const monthData = monthlyData.get(monthKey);
      
      // Use actual latitude if available, otherwise skip this point
      const lat = point.latitude;
      
      if (lat !== undefined) {
        if (lat >= 25 && lat < 35) {
          monthData['Southern US'] += point.count_prediction;
          monthData['Southern Count'] += 1;
        } else if (lat >= 35 && lat < 45) {
          monthData['Central US'] += point.count_prediction;
          monthData['Central Count'] += 1;
        } else if (lat >= 45 && lat < 55) {
          monthData['Northern US'] += point.count_prediction;
          monthData['Northern Count'] += 1;
        }
      }
    });
    
    // Format for chart - using SUMS instead of averages
    return Array.from(monthlyData.values())
      .map(month => ({
        date: month.date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short' 
        }),
        timestamp: month.date.getTime(),
        'Southern US': month['Southern US'],  // Total birds (sum)
        'Central US': month['Central US'],    // Total birds (sum)
        'Northern US': month['Northern US'],  // Total birds (sum)
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

  const currentDateObj = new Date(currentDate);
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toFixed(1)} birds`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

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
        <p className="text-gray-500">No regional data available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={processedData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 60,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
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
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              label={{ 
                value: 'Average Sightings', 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle' }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {/* Southern US line */}
            <Line
              type="monotone"
              dataKey="Southern US"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />
            
            {/* Central US line */}
            <Line
              type="monotone"
              dataKey="Central US"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />
            
            {/* Northern US line */}
            <Line
              type="monotone"
              dataKey="Northern US"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Peak activity summary */}
      <div className="mt-4 p-4 bg-gray-50 rounded">
        <h4 className="font-medium mb-2">Peak Migration Times</h4>
        
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-red-100 p-3 rounded">
            <p className="font-semibold text-red-900">Southern US</p>
            <p className="text-sm text-gray-800">{peakMonths['Southern US'].month}</p>
            <p className="text-sm text-gray-800">~{peakMonths['Southern US'].value.toFixed(0)} birds</p>
          </div>
          <div className="bg-blue-100 p-3 rounded">
            <p className="font-semibold text-blue-900">Central US</p>
            <p className="text-sm text-gray-800">{peakMonths['Central US'].month}</p>
            <p className="text-sm text-gray-800">~{peakMonths['Central US'].value.toFixed(0)} birds</p>
          </div>
          <div className="bg-green-100 p-3 rounded">
            <p className="font-semibold text-green-900">Northern US</p>
            <p className="text-sm text-gray-800">{peakMonths['Northern US'].month}</p>
            <p className="text-sm text-gray-800">~{peakMonths['Northern US'].value.toFixed(0)} birds</p>
          </div>
        </div>


        <p className="text-xs text-gray-600 mt-2">
          Migration typically progresses northward, with peak activity shifting from south to north through spring.
        </p>
      </div>
    </div>
  );
};

export default RegionalActivityHotspots;