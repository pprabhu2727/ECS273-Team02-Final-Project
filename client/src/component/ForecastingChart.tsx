import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface ForecastPoint {
  year: number;
  month: number;
  count_prediction: number;
  range_north: number;
  range_south: number;
  range_east: number;
  range_west: number;
  confidence_interval?: {
    lower: number;
    upper: number;
  };
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

export default function ForecastingChart({ data, timeRange, currentDate }: ForecastingChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    // Sort data by date
    const sortedData = [...data].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    // Set up chart dimensions
    const container = svgRef.current.parentElement;
    const width = container?.clientWidth || 600;
    const height = container?.clientHeight || 400;
    const margin = { top: 20, right: 80, bottom: 60, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear previous chart
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    // Create chart group
    const chart = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create scales
    const xScale = d3.scaleTime()
      .domain([
        new Date(d3.min(sortedData, d => d.year)!, d3.min(sortedData, d => d.month)! - 1),
        new Date(d3.max(sortedData, d => d.year)!, d3.max(sortedData, d => d.month)! - 1)
      ])
      .range([0, innerWidth]);

    // Calculate Y scale with some padding
    const allValues = sortedData.flatMap(d => [
      d.count_prediction,
      d.confidence_interval?.lower || d.count_prediction * 0.8,
      d.confidence_interval?.upper || d.count_prediction * 1.2
    ]);
    
    const yMin = Math.min(0, d3.min(allValues) || 0);
    const yMax = d3.max(allValues) || 100;
    const yPadding = (yMax - yMin) * 0.1;
    
    const yScale = d3.scaleLinear()
      .domain([yMin - yPadding, yMax + yPadding])
      .range([innerHeight, 0]);

    // Create axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(width > 500 ? 8 : 5)
      .tickFormat(d3.timeFormat("%b %Y") as any);

    const yAxis = d3.axisLeft(yScale)
      .ticks(height > 300 ? 8 : 5)
      .tickFormat(d3.format(".0f"));

    // Add axes to chart
    chart.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    chart.append("g")
      .attr("class", "y-axis")
      .call(yAxis);

    // Add grid lines
    chart.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.1)
      .call(d3.axisLeft(yScale)
        .ticks(height > 300 ? 8 : 5)
        .tickSize(-innerWidth)
        .tickFormat(() => "")
      );

    // Add axis labels
    chart.append("text")
      .attr("class", "axis-label")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + margin.bottom - 5)
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Date");

    chart.append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -margin.left + 20)
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Predicted Sightings");

    // Split data into historical and forecast
    const currentDateObj = new Date(currentDate);
    const historicalData = sortedData.filter(d => 
      new Date(d.year, d.month - 1) <= currentDateObj
    );
    const forecastData = sortedData.filter(d => 
      new Date(d.year, d.month - 1) > currentDateObj
    );

    // Create line generator
    const line = d3.line<ForecastPoint>()
      .x(d => xScale(new Date(d.year, d.month - 1)))
      .y(d => yScale(d.count_prediction))
      .curve(d3.curveMonotoneX);

    // Draw confidence interval for forecast
    if (forecastData.length > 0) {
      const area = d3.area<ForecastPoint>()
        .x(d => xScale(new Date(d.year, d.month - 1)))
        .y0(d => yScale(d.confidence_interval?.lower || d.count_prediction * 0.8))
        .y1(d => yScale(d.confidence_interval?.upper || d.count_prediction * 1.2))
        .curve(d3.curveMonotoneX);

      chart.append("path")
        .datum(forecastData)
        .attr("class", "confidence-area")
        .attr("d", area)
        .attr("fill", "#FF6B6B")
        .attr("fill-opacity", 0.2);
    }

    // Draw historical line
    if (historicalData.length > 0) {
      chart.append("path")
        .datum(historicalData)
        .attr("class", "line historical")
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", "#2563EB")
        .attr("stroke-width", 2.5);

      // Add dots for historical data
      chart.selectAll(".dot-historical")
        .data(historicalData)
        .enter().append("circle")
        .attr("class", "dot-historical")
        .attr("cx", d => xScale(new Date(d.year, d.month - 1)))
        .attr("cy", d => yScale(d.count_prediction))
        .attr("r", 3)
        .attr("fill", "#2563EB");
    }

    // Draw forecast line
    if (forecastData.length > 0) {
      // Connect last historical to first forecast if both exist
      if (historicalData.length > 0) {
        const connector = [historicalData[historicalData.length - 1], forecastData[0]];
        chart.append("path")
          .datum(connector)
          .attr("class", "line connector")
          .attr("d", line)
          .attr("fill", "none")
          .attr("stroke", "#6B7280")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "3,3");
      }

      // Forecast line
      chart.append("path")
        .datum(forecastData)
        .attr("class", "line forecast")
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", "#FF6B6B")
        .attr("stroke-width", 2.5);

      // Add dots for forecast data
      chart.selectAll(".dot-forecast")
        .data(forecastData)
        .enter().append("circle")
        .attr("class", "dot-forecast")
        .attr("cx", d => xScale(new Date(d.year, d.month - 1)))
        .attr("cy", d => yScale(d.count_prediction))
        .attr("r", 3)
        .attr("fill", "#FF6B6B");
    }

    // Add current date marker
    chart.append("line")
      .attr("class", "current-date")
      .attr("x1", xScale(currentDateObj))
      .attr("y1", 0)
      .attr("x2", xScale(currentDateObj))
      .attr("y2", innerHeight)
      .attr("stroke", "#6B7280")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,4");

    // Add text label for current date
    chart.append("text")
      .attr("x", xScale(currentDateObj))
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("fill", "#6B7280")
      .text("Today");

    // Add legend
    const legend = chart.append("g")
      .attr("transform", `translate(${innerWidth - 120}, 10)`);

    const legendData = [];
    if (historicalData.length > 0) {
      legendData.push({ label: "Historical", color: "#2563EB", dash: false });
    }
    if (forecastData.length > 0) {
      legendData.push({ label: "Forecast", color: "#FF6B6B", dash: false });
      legendData.push({ label: "Confidence", color: "#FF6B6B", dash: false, opacity: 0.2 });
    }

    legendData.forEach((item, i) => {
      const y = i * 20;
      
      if (item.opacity) {
        // Confidence area
        legend.append("rect")
          .attr("x", 0)
          .attr("y", y - 5)
          .attr("width", 25)
          .attr("height", 10)
          .attr("fill", item.color)
          .attr("fill-opacity", item.opacity);
      } else {
        // Line
        legend.append("line")
          .attr("x1", 0)
          .attr("y1", y)
          .attr("x2", 25)
          .attr("y2", y)
          .attr("stroke", item.color)
          .attr("stroke-width", 2.5)
          .attr("stroke-dasharray", item.dash ? "5,5" : null);
      }

      legend.append("text")
        .attr("x", 30)
        .attr("y", y)
        .attr("dy", "0.35em")
        .style("font-size", "12px")
        .text(item.label);
    });

    // Add tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("pointer-events", "none");

    // Add hover effects
    const allDots = chart.selectAll("circle");
    allDots
      .on("mouseover", function(event, d: any) {
        tooltip.transition().duration(200).style("opacity", .9);
        const monthName = new Date(d.year, d.month - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
        tooltip.html(`
          <strong>${monthName}</strong><br/>
          Predicted: ${Math.round(d.count_prediction)}<br/>
          ${d.confidence_interval ? 
            `Range: ${Math.round(d.confidence_interval.lower)} - ${Math.round(d.confidence_interval.upper)}` : 
            `Range: ${Math.round(d.count_prediction * 0.8)} - ${Math.round(d.count_prediction * 1.2)}`
          }
        `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        tooltip.transition().duration(500).style("opacity", 0);
      });

    // Cleanup on unmount
    return () => {
      d3.select("body").selectAll(".tooltip").remove();
    };

  }, [data, timeRange, currentDate]);

  return (
    <div className="w-full h-full" style={{ minHeight: '400px' }}>
      <svg 
        ref={svgRef}
        width="100%"
        height="100%"
      />
    </div>
  );
}