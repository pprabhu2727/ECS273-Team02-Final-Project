import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SeasonalDataPoint } from '../types';

interface BoxPlotProps {
  data: SeasonalDataPoint[];
  currentYear: number;
}

export default function BoxPlot({ data, currentYear }: BoxPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  useEffect(() => {
    if (!svgRef.current || !data.length) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    // Get dimensions
    const width = svgRef.current.parentElement?.clientWidth || 600;
    const height = svgRef.current.parentElement?.clientHeight || 300;
    const margin = { top: 20, right: 30, bottom: 60, left: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
      // Get seasonal patterns for the selected year
    const yearData = data.filter(d => d.year === currentYear);
    
    if (!yearData.length) {
      // Display message when year has no data
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .text(`No seasonal data available for ${currentYear}`);
      return;
    }
    
    // Create scales
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const xScale = d3.scaleBand()
      .domain(months)
      .range([0, chartWidth])
      .padding(0.2);
      const yMax = d3.max(yearData, d => d.max_count) || 0;
    const yScale = d3.scaleLinear()
      .domain([0, yMax * 1.1]) // Add space at the top
      .range([chartHeight, 0]);
    
    // Create chart group
    const chartGroup = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // Add axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);
    
    chartGroup.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(xAxis);
    
    chartGroup.append("g")
      .attr("class", "y-axis")
      .call(yAxis);
    
    // Add labels
    chartGroup.append("text")
      .attr("class", "x-axis-label")
      .attr("text-anchor", "middle")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight + margin.bottom - 10)
      .text("Month");
    
    chartGroup.append("text")
      .attr("class", "y-axis-label")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .attr("x", -chartHeight / 2)
      .attr("y", -margin.left + 15)
      .text("Bird Count");
    
    // Add title
    chartGroup.append("text")
      .attr("class", "chart-title")
      .attr("text-anchor", "middle")
      .attr("x", chartWidth / 2)
      .attr("y", -5)
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text(`Seasonal Variation for ${currentYear}`);
    
    // Draw box plots for each month
    yearData.forEach(d => {
      const month = months[d.month - 1];
      const x = xScale(month) || 0;
      const width = xScale.bandwidth();
      
      // Box
      chartGroup.append("rect")
        .attr("x", x)
        .attr("y", yScale(d.q3_count))
        .attr("width", width)
        .attr("height", yScale(d.q1_count) - yScale(d.q3_count))
        .attr("fill", "#4285F4")
        .attr("opacity", 0.7)
        .attr("stroke", "#000");
      
      // Median line
      chartGroup.append("line")
        .attr("x1", x)
        .attr("x2", x + width)
        .attr("y1", yScale(d.median_count))
        .attr("y2", yScale(d.median_count))
        .attr("stroke", "#000")
        .attr("stroke-width", 2);
      
      // Min line
      chartGroup.append("line")
        .attr("x1", x + width/2)
        .attr("x2", x + width/2)
        .attr("y1", yScale(d.q1_count))
        .attr("y2", yScale(d.min_count))
        .attr("stroke", "#000")
        .attr("stroke-width", 1);
      
      // Max line
      chartGroup.append("line")
        .attr("x1", x + width/2)
        .attr("x2", x + width/2)
        .attr("y1", yScale(d.q3_count))
        .attr("y2", yScale(d.max_count))
        .attr("stroke", "#000")
        .attr("stroke-width", 1);
      
      // Min cap
      chartGroup.append("line")
        .attr("x1", x + width/4)
        .attr("x2", x + 3*width/4)
        .attr("y1", yScale(d.min_count))
        .attr("y2", yScale(d.min_count))
        .attr("stroke", "#000")
        .attr("stroke-width", 1);
      
      // Max cap
      chartGroup.append("line")
        .attr("x1", x + width/4)
        .attr("x2", x + 3*width/4)
        .attr("y1", yScale(d.max_count))
        .attr("y2", yScale(d.max_count))
        .attr("stroke", "#000")
        .attr("stroke-width", 1);
      
      // Average point
      chartGroup.append("circle")
        .attr("cx", x + width/2)
        .attr("cy", yScale(d.average_count))
        .attr("r", 4)
        .attr("fill", "red")
        .append("title")
        .text(`Average: ${d.average_count}`);
    });
      // Add legend (fixed to top right corner)
    const legend = chartGroup.append("g")
      .attr("transform", `translate(${chartWidth - 50}, 10)`);
    
    // Box
    legend.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 15)
      .attr("height", 30)
      .attr("fill", "#4285F4")
      .attr("opacity", 0.7)
      .attr("stroke", "#000");
    
    // Median line
    legend.append("line")
      .attr("x1", 0)
      .attr("x2", 15)
      .attr("y1", 15)
      .attr("y2", 15)
      .attr("stroke", "#000")
      .attr("stroke-width", 2);
    
    // Whiskers
    legend.append("line")
      .attr("x1", 7.5)
      .attr("x2", 7.5)
      .attr("y1", 0)
      .attr("y2", -10)
      .attr("stroke", "#000");
    
    legend.append("line")
      .attr("x1", 7.5)
      .attr("x2", 7.5)
      .attr("y1", 30)
      .attr("y2", 40)
      .attr("stroke", "#000");
    
    // Caps
    legend.append("line")
      .attr("x1", 3)
      .attr("x2", 12)
      .attr("y1", -10)
      .attr("y2", -10)
      .attr("stroke", "#000");
    
    legend.append("line")
      .attr("x1", 3)
      .attr("x2", 12)
      .attr("y1", 40)
      .attr("y2", 40)
      .attr("stroke", "#000");
    
    // Average point
    legend.append("circle")
      .attr("cx", 7.5)
      .attr("cy", 50)
      .attr("r", 4)
      .attr("fill", "red");
    
    // Labels
    legend.append("text")
      .attr("x", 20)
      .attr("y", -5)
      .attr("font-size", "10px")
      .text("Maximum");
      
    legend.append("text")
      .attr("x", 20)
      .attr("y", 5)
      .attr("font-size", "10px")
      .text("Q3");
      
    legend.append("text")
      .attr("x", 20)
      .attr("y", 17)
      .attr("font-size", "10px")
      .text("Median");
      
    legend.append("text")
      .attr("x", 20)
      .attr("y", 29)
      .attr("font-size", "10px")
      .text("Q1");
      
    legend.append("text")
      .attr("x", 20)
      .attr("y", 42)
      .attr("font-size", "10px")
      .text("Minimum");
      
    legend.append("text")
      .attr("x", 20)
      .attr("y", 54)
      .attr("font-size", "10px")
      .text("Average");
    
  }, [data, currentYear]);
  
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
