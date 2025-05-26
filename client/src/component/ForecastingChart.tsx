import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ForecastPoint, TimeRange } from '../types';

interface ForecastingChartProps {
  data: ForecastPoint[];
  timeRange: TimeRange;
  currentDate: string;
  lastHistoricalDate: string; // Cutoff point between real data and predictions (format: "YYYY-MM")
}

export default function ForecastingChart({ 
  data, 
  timeRange, 
  currentDate,
  lastHistoricalDate = "2025-4" // Default cutoff date in YYYY-MM format
}: ForecastingChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  useEffect(() => {
    if (!svgRef.current || !data.length) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    // Setup chart dimensions
    const width = svgRef.current.parentElement?.clientWidth || 600;
    const height = svgRef.current.parentElement?.clientHeight || 300;
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Sort data by date
    const sortedData = [...data].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    
    // Set up time scale for x-axis
    const xExtent: [Date, Date] = [
      new Date(timeRange.startYear, timeRange.startMonth - 1),
      new Date(timeRange.endYear, timeRange.endMonth - 1)
    ];
    
    const xScale = d3.scaleTime()
      .domain(xExtent)
      .range([0, chartWidth]);
    
    // Set up linear scale for y-axis
    const yMax = d3.max(sortedData, d => d.count_prediction) || 0;
    const yScale = d3.scaleLinear()
      .domain([0, yMax * 1.1]) // Add padding
      .range([chartHeight, 0]);
    
    // Create chart container
    const chartGroup = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // Create axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(width > 500 ? 10 : 5)
      .tickFormat(d => d3.timeFormat("%Y-%m")(d as Date));
    
    const yAxis = d3.axisLeft(yScale)
      .ticks(height > 300 ? 10 : 5);
    
    // Add axes to chart
    chartGroup.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");
    
    chartGroup.append("g")
      .attr("class", "y-axis")
      .call(yAxis);
    
    // Add axis labels
    chartGroup.append("text")
      .attr("class", "x-axis-label")
      .attr("text-anchor", "middle")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight + margin.bottom - 5)
      .text("Date");
    
    chartGroup.append("text")
      .attr("class", "y-axis-label")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .attr("x", -chartHeight / 2)
      .attr("y", -margin.left + 15)
      .text("Bird Count");
    
    // Parse year and month from the cutoff date string
    const [lastHistYear, lastHistMonth] = lastHistoricalDate.split('-').map(Number);
    
    // Reference dates for filtering data
    const currentDateObj = new Date(currentDate);
    
    // Split data based on the cutoff between real observations and forecast
    const actualHistoricalData = sortedData.filter(d => {
      return d.year < lastHistYear || 
             (d.year === lastHistYear && d.month <= lastHistMonth);
    });
    
    // Everything after the cutoff date is forecast data
    const actualForecastData = sortedData.filter(d => {
      return d.year > lastHistYear || 
             (d.year === lastHistYear && d.month > lastHistMonth);
    });
    
    // Historical data before current slider date
    const displayHistoricalData = actualHistoricalData.filter(d => {
      const dataDate = new Date(d.year, d.month - 1);
      return dataDate <= currentDateObj;
    });
    
    // Forecast data after current slider date
    const displayForecastData = actualForecastData.filter(d => {
      const dataDate = new Date(d.year, d.month - 1);
      return dataDate > currentDateObj;
    });
    
    // Historical data that's in the "future" (when slider is moved to the past)
    const futurePastData = actualHistoricalData.filter(d => {
      const dataDate = new Date(d.year, d.month - 1);
      return dataDate > currentDateObj;
    });
    
    // Forecast data that's in the "past" (when slider is moved to the future)
    const pastFutureData = actualForecastData.filter(d => {
      const dataDate = new Date(d.year, d.month - 1);
      return dataDate <= currentDateObj;
    });
    
    // Create line generator
    const line = d3.line<ForecastPoint>()
      .x(d => xScale(new Date(d.year, d.month - 1)))
      .y(d => yScale(d.count_prediction))
      .curve(d3.curveMonotoneX);
    
    // Draw blue solid line for historical data up to current date
    if (displayHistoricalData.length > 0) {
      chartGroup.append("path")
        .datum(displayHistoricalData)
        .attr("class", "historical-line")
        .attr("fill", "none")
        .attr("stroke", "#4285F4")
        .attr("stroke-width", 3)
        .attr("d", line);
    }
    
    // Draw blue dashed line for known data after the current date
    if (futurePastData.length > 0) {
      // Connect to last historical point
      if (displayHistoricalData.length > 0) {
        const connectorData = [
          displayHistoricalData[displayHistoricalData.length - 1],
          futurePastData[0]
        ].filter(d => d !== undefined);
        
        if (connectorData.length === 2) {
          chartGroup.append("path")
            .datum(connectorData)
            .attr("class", "connector-line-blue")
            .attr("fill", "none")
            .attr("stroke", "#4285F4")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5")
            .attr("d", line);
        }
      }
      
      chartGroup.append("path")
        .datum(futurePastData)
        .attr("class", "future-historical-line")
        .attr("fill", "none")
        .attr("stroke", "#4285F4")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "5,5")
        .attr("d", line);
    }
    
    // Draw red solid line for forecast data that's before current date
    if (pastFutureData.length > 0) {
      chartGroup.append("path")
        .datum(pastFutureData)
        .attr("class", "past-forecast-line")
        .attr("fill", "none")
        .attr("stroke", "#DB4437")
        .attr("stroke-width", 3)
        .attr("d", line);
    }
    
    // Draw red dashed line for forecast data after current date
    if (displayForecastData.length > 0) {
      // Handle connection to past forecast data
      if (pastFutureData.length > 0) {
        const lastPastFuture = pastFutureData[pastFutureData.length - 1];
        const firstDisplayForecast = displayForecastData[0];
        
        // Only connect points that are close in time
        const lastPastDate = new Date(lastPastFuture.year, lastPastFuture.month - 1);
        const firstForecastDate = new Date(firstDisplayForecast.year, firstDisplayForecast.month - 1);
        
        const monthDiff = (firstForecastDate.getFullYear() - lastPastDate.getFullYear()) * 12 + 
                         (firstForecastDate.getMonth() - lastPastDate.getMonth());
                          
        if (monthDiff <= 2) {
          const connectorData = [lastPastFuture, firstDisplayForecast];
          
          chartGroup.append("path")
            .datum(connectorData)
            .attr("class", "connector-line-red")
            .attr("fill", "none")
            .attr("stroke", "#DB4437")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5")
            .attr("d", line);
        }
      }
      // Connect to historical data if needed and appropriate
      else if (displayHistoricalData.length > 0) {
        const lastHistoricalPoint = displayHistoricalData[displayHistoricalData.length - 1];
        const firstForecastPoint = displayForecastData[0];
        
        const lastHistDate = new Date(lastHistoricalPoint.year, lastHistoricalPoint.month - 1);
        const firstForecastDate = new Date(firstForecastPoint.year, firstForecastPoint.month - 1);
        
        const monthDiff = (firstForecastDate.getFullYear() - lastHistDate.getFullYear()) * 12 + 
                         (firstForecastDate.getMonth() - lastHistDate.getMonth());
        
        // Only connect if points are close in time and current date is near transition
        if (monthDiff <= 2 && Math.abs(lastHistDate.getTime() - currentDateObj.getTime()) < 45 * 24 * 60 * 60 * 1000) {
          const connectorData = [lastHistoricalPoint, firstForecastPoint];
          
          chartGroup.append("path")
            .datum(connectorData)
            .attr("class", "connector-line-mixed")
            .attr("fill", "none")
            .attr("stroke", "#9E42F5") // Purple for historical-to-forecast transition
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5")
            .attr("d", line);
        }
      }
      
      // Draw the forecast projection line
      chartGroup.append("path")
        .datum(displayForecastData)
        .attr("class", "forecast-line")
        .attr("fill", "none")
        .attr("stroke", "#DB4437")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "5,5")
        .attr("d", line);
        
      // Add confidence interval for forecast
      const areaGenerator = d3.area<ForecastPoint>()
        .x(d => xScale(new Date(d.year, d.month - 1)))
        .y0(d => yScale(d.count_prediction * 0.9))
        .y1(d => yScale(d.count_prediction * 1.1))
        .curve(d3.curveMonotoneX);
        
      chartGroup.append("path")
        .datum(displayForecastData)
        .attr("class", "forecast-area")
        .attr("fill", "#DB4437")
        .attr("fill-opacity", 0.2)
        .attr("d", areaGenerator);
    }
    
    // Improve connector lines for historical data
    if (futurePastData.length > 0) {
      if (displayHistoricalData.length > 0) {
        const lastHistPoint = displayHistoricalData[displayHistoricalData.length - 1];
        const firstFuturePastPoint = futurePastData[0];
        
        const lastHistDate = new Date(lastHistPoint.year, lastHistPoint.month - 1);
        const firstFutureDate = new Date(firstFuturePastPoint.year, firstFuturePastPoint.month - 1);
        
        const monthDiff = (firstFutureDate.getFullYear() - lastHistDate.getFullYear()) * 12 + 
                         (firstFutureDate.getMonth() - lastHistDate.getMonth());
        
        // Only connect if points are close in time and current date is near transition
        if (monthDiff <= 2 && Math.abs(lastHistDate.getTime() - currentDateObj.getTime()) < 45 * 24 * 60 * 60 * 1000) {
          const connectorData = [lastHistPoint, firstFuturePastPoint];
          
          chartGroup.append("path")
            .datum(connectorData)
            .attr("class", "connector-line-blue")
            .attr("fill", "none")
            .attr("stroke", "#4285F4")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5")
            .attr("d", line);
        }
      }
      
      // Draw blue dashed line for future historical data
      if (futurePastData.length > 0) {
        chartGroup.append("path")
          .datum(futurePastData)
          .attr("class", "future-historical-line")
          .attr("fill", "none")
          .attr("stroke", "#4285F4")
          .attr("stroke-width", 3)
          .attr("stroke-dasharray", "5,5")
          .attr("d", line);
      }
    }
    
    // Add current date marker
    chartGroup.append("line")
      .attr("class", "current-date-line")
      .attr("x1", xScale(currentDateObj))
      .attr("y1", 0)
      .attr("x2", xScale(currentDateObj))
      .attr("y2", chartHeight)
      .attr("stroke", "#000")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5");
      
    // Label current date
    chartGroup.append("text")
      .attr("class", "current-date-label")
      .attr("x", xScale(currentDateObj))
      .attr("y", 0)
      .attr("dy", -5)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .text("Current Date");
      
    // Add blue dots for historical data points
    chartGroup.selectAll(".historical-dot")
      .data(actualHistoricalData)
      .enter()
      .append("circle")
      .attr("class", "historical-dot")
      .attr("cx", d => xScale(new Date(d.year, d.month - 1)))
      .attr("cy", d => yScale(d.count_prediction))
      .attr("r", 4)
      .attr("fill", "#4285F4")
      .append("title")
      .text(d => `${d.year}-${d.month}: ${d.count_prediction} (historical)`);
      
    // Add chart legend
    const legend = chartGroup.append("g")
      .attr("transform", `translate(${chartWidth - 150}, 10)`);
      
    // Historical data legend entry
    legend.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 20)
      .attr("y2", 0)
      .attr("stroke", "#4285F4")
      .attr("stroke-width", 3);
      
    legend.append("text")
      .attr("x", 25)
      .attr("y", 5)
      .text("Historical Data");
      
    // Forecast data legend entry  
    legend.append("line")
      .attr("x1", 0)
      .attr("y1", 20)
      .attr("x2", 20)
      .attr("y2", 20)
      .attr("stroke", "#DB4437")
      .attr("stroke-width", 3)
      .attr("stroke-dasharray", "5,5");
      
    legend.append("text")
      .attr("x", 25)
      .attr("y", 25)
      .text("Forecast Data");
      
    // Show range shift information
    if (displayForecastData.length > 0) {
      const rangeIndicator = chartGroup.append("g")
        .attr("class", "range-shift-indicator")
        .attr("transform", `translate(10, ${chartHeight - 100})`);
        
      rangeIndicator.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 140)
        .attr("height", 90)
        .attr("fill", "#f8f8f8")
        .attr("stroke", "#ccc")
        .attr("rx", 5);
        
      rangeIndicator.append("text")
        .attr("x", 5)
        .attr("y", 15)
        .attr("font-weight", "bold")
        .text("Projected Range Shifts");
        
      // Show latest forecast metrics
      const latest = displayForecastData[displayForecastData.length - 1];
      
      if (latest) {
        rangeIndicator.append("text")
          .attr("x", 10)
          .attr("y", 35)
          .text(`North: ${latest.range_north > 0 ? "+" : ""}${latest.range_north.toFixed(2)}°`);
          
        rangeIndicator.append("text")
          .attr("x", 10)
          .attr("y", 50)
          .text(`South: ${latest.range_south > 0 ? "+" : ""}${latest.range_south.toFixed(2)}°`);
          
        rangeIndicator.append("text")
          .attr("x", 10)
          .attr("y", 65)
          .text(`East: ${latest.range_east > 0 ? "+" : ""}${latest.range_east.toFixed(2)}°`);
          
        rangeIndicator.append("text")
          .attr("x", 10)
          .attr("y", 80)
          .text(`West: ${latest.range_west > 0 ? "+" : ""}${latest.range_west.toFixed(2)}°`);
      }
    }
    
  }, [data, timeRange, currentDate, lastHistoricalDate]);
  
  return (
    <div className="w-full h-full">
      <svg 
        ref={svgRef}
        width="100%"
        height="100%"
      />
    </div>
  );
}