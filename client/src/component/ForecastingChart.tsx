
import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

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
  currentDate
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Transform raw forecast data into chart-ready format
   * We maintain monthly granularity because bird migration patterns show
   * significant month-to-month variation that would be lost with annual aggregation
   */
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
  const drawChart = () => {
    if (!svgRef.current || !containerRef.current || processedData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Responsive sizing with reasonable minimums for chart readability
    const containerRect = containerRef.current.getBoundingClientRect();
    const width = Math.max(400, containerRect.width);
    const height = Math.max(300, containerRect.height);

    svg.attr("width", width).attr("height", height);

    // Extra margins needed for rotated x-axis labels and axis titles
    const margin = { top: 20, right: 30, left: 60, bottom: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const chartGroup = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Time-based x-scale for chronological data display
    const xScale = d3.scaleTime()
      .domain(d3.extent(processedData, d => new Date(d.timestamp)) as [Date, Date])
      .range([0, chartWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(processedData, d => d.prediction) as number])
      .range([chartHeight, 0])
      .nice();

    // Add subtle grid lines to help users read values across the chart
    const xGrid = d3.axisBottom(xScale)
      .tickSize(-chartHeight)
      .tickFormat(() => "");

    const yGrid = d3.axisLeft(yScale)
      .tickSize(-chartWidth)
      .tickFormat(() => "");

    chartGroup.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(xGrid)
      .style("stroke-dasharray", "3,3")
      .style("opacity", 0.3);

    chartGroup.append("g")
      .attr("class", "grid")
      .call(yGrid).style("stroke-dasharray", "3,3")
      .style("opacity", 0.3);

    // Create smooth line connecting forecast predictions over time
    const line = d3.line<typeof processedData[0]>()
      .x(d => xScale(new Date(d.timestamp)))
      .y(d => yScale(d.prediction))
      .curve(d3.curveMonotoneX);

    // Draw the main forecast trend line
    chartGroup.append("path")
      .datum(processedData)
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2)
      .attr("d", line);

    // Add interactive data points for detailed information on hover
    chartGroup.selectAll(".dot")
      .data(processedData)
      .enter().append("circle")
      .attr("class", "dot")
      .attr("cx", d => xScale(new Date(d.timestamp)))
      .attr("cy", d => yScale(d.prediction))
      .attr("r", 3)
      .attr("fill", "#3b82f6")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);

    // Highlight the current date with a distinct red marker
    // This helps users understand where they are in the forecast timeline
    const currentPoint = processedData.find(d =>
      d.year === currentDateObj.getFullYear() &&
      d.month === currentDateObj.getMonth() + 1
    );

    if (currentPoint) {
      chartGroup.append("circle")
        .attr("cx", xScale(new Date(currentPoint.timestamp)))
        .attr("cy", yScale(currentPoint.prediction))
        .attr("r", 5)
        .attr("fill", "#ef4444")
        .attr("stroke", "#ef4444")
        .attr("stroke-width", 2);
    }

    // X-axis with month-year labels rotated for readability
    chartGroup.append("g")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale)
        .tickFormat((d) => d3.timeFormat("%b %Y")(d as Date)))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)")
      .style("font-size", "12px"); chartGroup.append("g")
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .style("font-size", "12px");

    chartGroup.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (chartHeight / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "500")
      .text("Predicted Sightings");

    // Tooltip for detailed information on hover
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", "white")
      .style("border", "1px solid #ccc")
      .style("border-radius", "4px")
      .style("padding", "12px")
      .style("box-shadow", "0 4px 6px rgba(0, 0, 0, 0.1)")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000");

    // Interactive hover behavior for data points
    // Shows detailed prediction and range shift information
    chartGroup.selectAll(".dot")
      .on("mouseover", function (_event, d) {
        const dataPoint = d as typeof processedData[0];

        d3.select(this)
          .attr("r", 5)
          .attr("stroke", "#3b82f6")
          .attr("stroke-width", 2)
          .attr("fill", "#fff");

        tooltip.style("visibility", "visible")
          .html(`
            <div style="font-weight: bold; margin-bottom: 4px;">${dataPoint.date}</div>
            <div style="color: #3b82f6; margin-bottom: 8px;">Predicted Count: ${dataPoint.prediction.toFixed(2)}</div>
            <div style="font-size: 10px;">
              <div>North Range Shift: ${dataPoint.rangeNorth.toFixed(3)}°</div>
              <div>South Range Shift: ${dataPoint.rangeSouth.toFixed(3)}°</div>
              <div>East Range Shift: ${dataPoint.rangeEast.toFixed(3)}°</div>
              <div>West Range Shift: ${dataPoint.rangeWest.toFixed(3)}°</div>
            </div>
          `);
      })
      .on("mousemove", function (event) {
        tooltip
          .style("top", (event.pageY - 10) + "px")
          .style("left", (event.pageX + 10) + "px");
      })
      .on("mouseout", function () {
        d3.select(this)
          .attr("r", 3)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1)
          .attr("fill", "#3b82f6"); tooltip.style("visibility", "hidden");
      });

    // Add legend to explain chart elements
    const legend = chartGroup.append("g")
      .attr("transform", `translate(${chartWidth - 150}, 20)`);

    legend.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", 3)
      .attr("fill", "#3b82f6");

    legend.append("text")
      .attr("x", 10)
      .attr("y", 0)
      .attr("dy", "0.35em")
      .style("font-size", "12px")
      .text("Monthly Forecast");

    if (currentPoint) {
      legend.append("circle")
        .attr("cx", 0)
        .attr("cy", 20)
        .attr("r", 5)
        .attr("fill", "#ef4444");

      legend.append("text")
        .attr("x", 10)
        .attr("y", 20)
        .attr("dy", "0.35em")
        .style("font-size", "12px")
        .text("Current Date");
    }

    return () => tooltip.remove();
  };

  // Redraw chart when data changes
  useEffect(() => {
    if (processedData.length > 0) {
      const cleanup = drawChart();
      return () => {
        if (cleanup) cleanup();
      };
    }
  }, [processedData]);

  // Redraw chart when window is resized to maintain responsiveness
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && processedData.length > 0) drawChart();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [processedData]);

  if (processedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No forecast data available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">      <div ref={containerRef} className="w-full" style={{ height: 'calc(100% - 120px)' }}>
      <svg ref={svgRef} className="w-full h-full" />
    </div>

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