import { useState, useEffect } from 'react';
import { TimeRange } from '../types';

interface TimeSliderProps {
  timeRange: TimeRange;
  onDateChange: (dateStr: string) => void;
}

export default function TimeSlider({ timeRange, onDateChange }: TimeSliderProps) {
  // Create date objects from the year/month values, starting from the 1st of each month
  const startDate = new Date(`${timeRange.startYear}-${String(timeRange.startMonth).padStart(2, '0')}-01`);
  const endDate = new Date(`${timeRange.endYear}-${String(timeRange.endMonth).padStart(2, '0')}-01`);

  // Calculate the actual last day of the end month by moving to next month then back one day
  // This handles months with different numbers of days (28, 29, 30, 31)
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setDate(endDate.getDate() - 1);

  // Guard against invalid date inputs that could break the slider calculations
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return <p className="text-red-500">Invalid time range</p>;
  }

  // Calculate total days in the range to set slider bounds
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const [sliderValue, setSliderValue] = useState(0);
  const [currentDate, setCurrentDate] = useState('');

  /**
   * Sync slider position with the current date from props on mount and when timeRange changes.
   * This ensures the slider starts at the correct position when the component loads or
   * when the parent component changes the time range.
   */
  useEffect(() => {
    const current = new Date(`${timeRange.currentYear}-${String(timeRange.currentMonth).padStart(2, '0')}-01`);
    const offsetDays = Math.floor((current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (!isNaN(offsetDays)) {
      setSliderValue(offsetDays);
    }
  }, [timeRange]);

  /**
   * Convert slider position to actual date and notify parent component.
   * This fires whenever the user moves the slider, updating both the display
   * and propagating the change up to parent components.
   */
  useEffect(() => {
    const selectedDate = new Date(startDate);
    selectedDate.setDate(selectedDate.getDate() + sliderValue);
    const isoDate = selectedDate.toISOString().split('T')[0];
    setCurrentDate(isoDate);
    onDateChange(isoDate);
  }, [sliderValue]);
  return (
    <div className="w-full px-4">
      {/* Display start date, current selected date, and end date for user reference */}
      <div className="flex justify-between mb-1">
        <span className="text-xs">{startDate.toISOString().split('T')[0]}</span>
        <span className="text-sm font-bold text-blue-600">{currentDate}</span>
        <span className="text-xs">{endDate.toISOString().split('T')[0]}</span>
      </div>
      {/* Range slider that maps days to slider positions (0 to totalDays-1) */}
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
