import { useState, useEffect } from 'react';
import { TimeRange } from '../types';

interface TimeSliderProps {
  timeRange: TimeRange;
  onTimeChange: (year: number, month: number) => void;
}

export default function TimeSlider({ timeRange, onTimeChange }: TimeSliderProps) {
  const [sliderValue, setSliderValue] = useState<number>(0);
  const [displayDate, setDisplayDate] = useState<string>('');
    // Calculate slider length in months
  const totalMonths = 
    (timeRange.endYear - timeRange.startYear) * 12 + 
    (timeRange.endMonth - timeRange.startMonth + 1);
  
  // Set slider position based on current date
  useEffect(() => {
    const monthsFromStart = 
      (timeRange.currentYear - timeRange.startYear) * 12 + 
      (timeRange.currentMonth - timeRange.startMonth);
    
    setSliderValue(monthsFromStart);
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    setDisplayDate(`${monthNames[timeRange.currentMonth - 1]} ${timeRange.currentYear}`);
  }, [timeRange]);
    // Update date when user moves the slider
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value);
    setSliderValue(newValue);
    
    // Calculate year and month from slider position
    const monthsToAdd = newValue;
    const newYear = timeRange.startYear + Math.floor((timeRange.startMonth - 1 + monthsToAdd) / 12);
    const newMonth = ((timeRange.startMonth - 1 + monthsToAdd) % 12) + 1;
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    setDisplayDate(`${monthNames[newMonth - 1]} ${newYear}`);
    onTimeChange(newYear, newMonth);
  };

  return (
    <div className="w-full px-4">
      <div className="flex justify-between mb-1">
        <span className="text-xs font-medium text-gray-700">
          {`${timeRange.startYear}/${timeRange.startMonth.toString().padStart(2, '0')}`}
        </span>
        <span className="text-sm font-bold text-center text-blue-600">{displayDate}</span>
        <span className="text-xs font-medium text-gray-700">
          {`${timeRange.endYear}/${timeRange.endMonth.toString().padStart(2, '0')}`}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max={totalMonths - 1}
        value={sliderValue}
        onChange={handleChange}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
      />
    </div>
  );
}
