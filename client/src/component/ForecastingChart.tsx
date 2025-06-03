
// npm install recharts
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface ForecastPoint {
  year: number;
  month: number;
  count_prediction: number;
  range_north: number;
  range_south: number;
  range_east: number;
  range_west: number;
}

interface TimeRange {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  currentYear: number;
  currentMonth: number;
}

interface ForecastingChartProps {
  data: ForecastPoint[];
  timeRange: TimeRange;
  currentDate: string;
}

const ForecastingChart: React.FC<ForecastingChartProps> = ({ 
  data, 
  timeRange, 
  currentDate 
}) => {
  // Process data to keep monthly granularity
  const processedData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map(point => ({
      date: new Date(point.year, point.month - 1, 1).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
      }),
      timestamp: new Date(point.year, point.month - 1, 1).getTime(),
      year: point.year,
      month: point.month,
      prediction: point.count_prediction,
      rangeNorth: point.range_north,
      rangeSouth: point.range_south,
      rangeEast: point.range_east,
      rangeWest: point.range_west,
    })).sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

  const currentDateObj = new Date(currentDate);
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold">{`${data.date}`}</p>
          <p className="text-blue-600">{`Predicted Count: ${data.prediction.toFixed(2)}`}</p>
          <div className="mt-2 text-xs">
            <p>{`North Range Shift: ${data.rangeNorth.toFixed(3)}°`}</p>
            <p>{`South Range Shift: ${data.rangeSouth.toFixed(3)}°`}</p>
            <p>{`East Range Shift: ${data.rangeEast.toFixed(3)}°`}</p>
            <p>{`West Range Shift: ${data.rangeWest.toFixed(3)}°`}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (processedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No forecast data available</p>
      </div>
    );
  }

  // Calculate domain for XAxis
  const minDate = Math.min(...processedData.map(d => d.timestamp));
  const maxDate = Math.max(...processedData.map(d => d.timestamp));

  return (
    <div className="w-full h-full">
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
            domain={[minDate, maxDate]}
            tickFormatter={(timestamp) => 
              new Date(timestamp).toLocaleDateString('en-US', { 
                year: 'numeric', 
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
              value: 'Predicted Sightings', 
              angle: -90, 
              position: 'insideLeft',
              style: { textAnchor: 'middle' }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Main forecast line */}
          <Line
            type="monotone"
            dataKey="prediction"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 1, r: 3 }}
            activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }}
            name="Monthly Forecast"
          />

          {/* Current date marker */}
          {processedData.some(d => 
            d.year === currentDateObj.getFullYear() && 
            d.month === currentDateObj.getMonth() + 1
          ) && (
            <Line
              type="monotone"
              dataKey={(entry) => 
                entry.year === currentDateObj.getFullYear() && 
                entry.month === currentDateObj.getMonth() + 1 ? entry.prediction : null
              }
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ fill: '#ef4444', strokeWidth: 2, r: 5 }}
              name="Current Date"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      
      {/* Range shift visualization */}
      <div className="mt-4 p-4 bg-gray-50 rounded">
        <h4 className="font-medium mb-2">Average Range Shifts</h4>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="bg-blue-100 p-2 rounded text-center">
            <p>North</p>
            <p className="font-medium">
              {(
                processedData.reduce((sum, d) => sum + d.rangeNorth, 0) / 
                processedData.length
              ).toFixed(3)}°
            </p>
          </div>
          <div className="bg-green-100 p-2 rounded text-center">
            <p>South</p>
            <p className="font-medium">
              {(
                processedData.reduce((sum, d) => sum + d.rangeSouth, 0) / 
                processedData.length
              ).toFixed(3)}°
            </p>
          </div>
          <div className="bg-yellow-100 p-2 rounded text-center">
            <p>East</p>
            <p className="font-medium">
              {(
                processedData.reduce((sum, d) => sum + d.rangeEast, 0) / 
                processedData.length
              ).toFixed(3)}°
            </p>
          </div>
          <div className="bg-red-100 p-2 rounded text-center">
            <p>West</p>
            <p className="font-medium">
              {(
                processedData.reduce((sum, d) => sum + d.rangeWest, 0) / 
                processedData.length
              ).toFixed(3)}°
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastingChart;