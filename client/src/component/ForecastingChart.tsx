import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ForecastPoint, TimeRange } from '../types';

interface ForecastingChartProps {
  data: ForecastPoint[];
  timeRange: TimeRange;
  currentDate: string;
}

export default function ForecastingChart({ data, timeRange, currentDate }: ForecastingChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  useEffect(() => {
    if (!svgRef.current || !data.length) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    // Get dimensions
    const width = svgRef.current.parentElement?.clientWidth || 600;
    const height = svgRef.current.parentElement?.clientHeight || 300;
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;    // Order data chronologically
    const sortedData = [...data].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    
    // Create x-scale using time
    const xExtent: [Date, Date] = [
      new Date(timeRange.startYear, timeRange.startMonth - 1),
      new Date(timeRange.endYear, timeRange.endMonth - 1)
    ];
    
    const xScale = d3.scaleTime()
      .domain(xExtent)
      .range([0, chartWidth]);
    
    // Create y-scale for count predictions
    const yMax = d3.max(sortedData, d => d.count_prediction) || 0;
    const yScale = d3.scaleLinear()
      .domain([0, yMax * 1.1]) // Add some padding
      .range([chartHeight, 0]);
    
    // Create group for chart
    const chartGroup = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // Add axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(width > 500 ? 10 : 5)
      .tickFormat(d => d3.timeFormat("%Y-%m")(d as Date));
    
    const yAxis = d3.axisLeft(yScale)
      .ticks(height > 300 ? 10 : 5);
    
    // Append axes
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
    
    // Add labels
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
    
    // Split data into historical and forecast
    const currentDateObj = new Date(currentDate);
    const historicalData = sortedData.filter(d => {
      const dataDate = new Date(d.year, d.month - 1);
      return dataDate <= currentDateObj;
    });
    
    const forecastData = sortedData.filter(d => {
      const dataDate = new Date(d.year, d.month - 1);
      return dataDate > currentDateObj;
    });
    
    // Create a line generator
    const line = d3.line<ForecastPoint>()
      .x(d => xScale(new Date(d.year, d.month - 1)))
      .y(d => yScale(d.count_prediction))
      .curve(d3.curveMonotoneX);
    
    // Draw historical line
    if (historicalData.length) {
      chartGroup.append("path")
        .datum(historicalData)
        .attr("class", "historical-line")
        .attr("fill", "none")
        .attr("stroke", "#4285F4")
        .attr("stroke-width", 3)
        .attr("d", line);
    }
    
    // Draw forecast line (if there is forecast data)
    if (forecastData.length) {
      // Connect last historical point with first forecast point
      const connectorData = [
        historicalData[historicalData.length - 1],
        forecastData[0]
      ];
      
      // Add dashed line for forecast
      chartGroup.append("path")
        .datum(connectorData)
        .attr("class", "connector-line")
        .attr("fill", "none")
        .attr("stroke", "#4285F4")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5")
        .attr("d", line);
      
      chartGroup.append("path")
        .datum(forecastData)
        .attr("class", "forecast-line")
        .attr("fill", "none")
        .attr("stroke", "#DB4437")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "5,5")
        .attr("d", line);
        
      // Add forecast confidence interval (simple +/- 10% for demo)
      const areaGenerator = d3.area<ForecastPoint>()
        .x(d => xScale(new Date(d.year, d.month - 1)))
        .y0(d => yScale(d.count_prediction * 0.9))
        .y1(d => yScale(d.count_prediction * 1.1))
        .curve(d3.curveMonotoneX);
        
      chartGroup.append("path")
        .datum(forecastData)
        .attr("class", "forecast-area")
        .attr("fill", "#DB4437")
        .attr("fill-opacity", 0.2)
        .attr("d", areaGenerator);
    }
    
    // Add a vertical line for current date
    chartGroup.append("line")
      .attr("class", "current-date-line")
      .attr("x1", xScale(currentDateObj))
      .attr("y1", 0)
      .attr("x2", xScale(currentDateObj))
      .attr("y2", chartHeight)
      .attr("stroke", "#000")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5");
      
    // Add a label for current date
    chartGroup.append("text")
      .attr("class", "current-date-label")
      .attr("x", xScale(currentDateObj))
      .attr("y", 0)
      .attr("dy", -5)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .text("Current Date");
      
    // Add dots for each data point
    chartGroup.selectAll(".historical-dot")
      .data(historicalData)
      .enter()
      .append("circle")
      .attr("class", "historical-dot")
      .attr("cx", d => xScale(new Date(d.year, d.month - 1)))
      .attr("cy", d => yScale(d.count_prediction))
      .attr("r", 4)
      .attr("fill", "#4285F4")
      .append("title")
      .text(d => `${d.year}-${d.month}: ${d.count_prediction}`);
      
    // Add legend
    const legend = chartGroup.append("g")
      .attr("transform", `translate(${chartWidth - 150}, 10)`);
      
    // Historical data
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
      
    // Forecast data
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
      
    // Range shift indicators
    if (forecastData.length > 0) {
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
        
      // Get the latest forecast point
      const latest = forecastData[forecastData.length - 1];
      
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
    
  }, [data, timeRange, currentDate]);
  
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
