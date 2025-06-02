import { useState, useEffect } from 'react';
import { TimeRange } from '../types';

interface TimeSliderProps {
  timeRange: TimeRange;
  onDateChange: (dateStr: string) => void;
}

export default function TimeSlider({ timeRange, onDateChange }: TimeSliderProps) {
  const startDate = new Date(`${timeRange.startYear}-${String(timeRange.startMonth).padStart(2, '0')}-01`);
  const endDate = new Date(`${timeRange.endYear}-${String(timeRange.endMonth).padStart(2, '0')}-01`);
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setDate(endDate.getDate() - 1);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return <p className="text-red-500">Invalid time range</p>;
  }

  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const [sliderValue, setSliderValue] = useState(0);
  const [currentDate, setCurrentDate] = useState('');

  // Initialize slider position based on currentDate from timeRange
  useEffect(() => {
    const current = new Date(`${timeRange.currentYear}-${String(timeRange.currentMonth).padStart(2, '0')}-01`);
    const offsetDays = Math.floor((current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (!isNaN(offsetDays)) {
      setSliderValue(offsetDays);
    }
  }, [timeRange]);

  // Update date when slider changes
  useEffect(() => {
    const selectedDate = new Date(startDate);
    selectedDate.setDate(selectedDate.getDate() + sliderValue);
    const isoDate = selectedDate.toISOString().split('T')[0];
    setCurrentDate(isoDate);
    onDateChange(isoDate);
  }, [sliderValue]);

  return (
    <div className="w-full px-4">
      <div className="flex justify-between mb-1">
        <span className="text-xs">{startDate.toISOString().split('T')[0]}</span>
        <span className="text-sm font-bold text-blue-600">{currentDate}</span>
        <span className="text-xs">{endDate.toISOString().split('T')[0]}</span>
      </div>
      <input
        type="range"
        min={0}
        max={totalDays - 1}
        value={sliderValue}
        onChange={(e) => setSliderValue(parseInt(e.target.value))}
        className="w-full accent-blue-600"
      />
    </div>
  );
}
