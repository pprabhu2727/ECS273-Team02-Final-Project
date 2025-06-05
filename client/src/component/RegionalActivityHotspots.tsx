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
  data
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Transform raw forecast data into monthly regional aggregates
   * We divide the US into three latitude bands to show regional migration patterns:
   * - Southern US (25-35°N): warmer regions where birds winter
   * - Central US (35-45°N): transitional zone for spring/fall migration
   * - Northern US (45-55°N): breeding grounds in northern states
   */
  const processedData = React.useMemo(() => {
    if (!data || data.length === 0) return [];

    const monthlyData = new Map();
    data.forEach(point => {
      const monthKey = `${point.year}-${String(point.month).padStart(2, '0')}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          date: new Date(point.year, point.month - 1, 1),
          monthKey,
          'Southern US': 0,
          'Central US': 0,
          'Northern US': 0
        });
      }

      const monthData = monthlyData.get(monthKey);
      const lat = point.latitude;

      // Categorize sightings by latitude bands to show regional patterns
      if (lat !== undefined) {
        if (lat >= 25 && lat < 35) {
          monthData['Southern US'] += point.count_prediction;
        } else if (lat >= 35 && lat < 45) {
          monthData['Central US'] += point.count_prediction;
        } else if (lat >= 45 && lat < 55) {
          monthData['Northern US'] += point.count_prediction;
        }
      }
    });

    // Convert to array format suitable for D3 charting
    return Array.from(monthlyData.values())
      .map(month => ({
        date: month.date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short'
        }),
        timestamp: month.date.getTime(),
        'Southern US': month['Southern US'],
        'Central US': month['Central US'],
        'Northern US': month['Northern US'],
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

  /**
   * Find the month with highest bird activity for each region
   * This helps users identify peak migration times across different latitude bands
   */
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
  const drawChart = () => {
    if (!svgRef.current || !containerRef.current || processedData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Responsive chart dimensions - ensures chart looks good at different screen sizes
    const containerRect = containerRef.current.getBoundingClientRect();
    const width = Math.max(300, containerRect.width);
    const height = Math.max(200, containerRect.height);

    svg.attr("width", width).attr("height", height);

    // Set up chart margins - extra space on bottom for year labels and axis title
    const margin = { top: 5, right: 10, left: 45, bottom: 45 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom; const chartGroup = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Create time-based x-scale for temporal data visualization
    const xScale = d3.scaleTime()
      .domain(d3.extent(processedData, d => new Date(d.timestamp)) as [Date, Date])
      .range([0, chartWidth]);

    const maxValue = d3.max(processedData, d =>
      Math.max(d['Southern US'], d['Central US'], d['Northern US'])
    ) as number;

    // Linear y-scale with nice() to create clean tick values
    const yScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([chartHeight, 0])
      .nice();

    // Add subtle grid lines to help users read values across the chart
    const yGrid = d3.axisLeft(yScale)
      .tickSize(-chartWidth)
      .tickFormat(() => "");

    chartGroup.append("g")
      .attr("class", "grid")
      .call(yGrid)
      .style("stroke-dasharray", "3,3").style("opacity", 0.2)
      .style("stroke", "#475569");

    // Create line charts for each region with distinct colors
    // Colors chosen to match the region cards below: red=south, blue=central, green=north
    const regions = ['Southern US', 'Central US', 'Northern US'];
    const colors = ['#ef4444', '#3b82f6', '#10b981'];

    regions.forEach((region, index) => {
      const line = d3.line<typeof processedData[0]>()
        .x(d => xScale(new Date(d.timestamp)))
        .y(d => yScale(d[region as keyof typeof d] as number))
        .curve(d3.curveMonotoneX);

      chartGroup.append("path")
        .datum(processedData)
        .attr("fill", "none")
        .attr("stroke", colors[index])
        .attr("stroke-width", 1.5)
        .attr("d", line);

      // Create invisible hover points that will be shown on mouseover
      chartGroup.selectAll(`.dot-${index}`)
        .data(processedData)
        .enter().append("circle")
        .attr("class", `dot-${index}`)
        .attr("cx", d => xScale(new Date(d.timestamp)))
        .attr("cy", d => yScale(d[region as keyof typeof d] as number))
        .attr("r", 0)
        .attr("fill", colors[index])
        .style("cursor", "pointer");
    });

    // X-axis shows years instead of individual months for cleaner display
    chartGroup.append("g")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale)
        .tickFormat((d) => d3.timeFormat("%Y")(d as Date)))
      .selectAll("text")
      .style("text-anchor", "middle")
      .attr("dx", "0")
      .attr("dy", "1em")
      .attr("transform", "rotate(0)")
      .style("font-size", "10px")
      .style("fill", "#94a3b8"); chartGroup.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", chartHeight + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "#94a3b8")
        .text("Year");

    // Format y-axis labels to show "1.2k" instead of "1200" for readability
    const yTickFormat = (domainValue: d3.NumberValue) => {
      const value = Number(domainValue);
      return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();
    };

    chartGroup.append("g")
      .call(d3.axisLeft(yScale)
        .tickFormat(yTickFormat))
      .selectAll("text")
      .style("font-size", "10px")
      .style("fill", "#94a3b8");

    // Y Axis label
    chartGroup.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (chartHeight / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "10px").style("fill", "#94a3b8")
      .text("Average Sightings");

    // Create tooltip for detailed hover information
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", "rgb(30 41 59)")
      .style("border", "1px solid rgb(71 85 105)")
      .style("border-radius", "4px")
      .style("padding", "6px")
      .style("box-shadow", "0 4px 6px rgba(0, 0, 0, 0.1)")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000")
      .style("color", "white");

    // Invisible overlay to capture mouse events across the entire chart area
    chartGroup.append("rect")
      .attr("width", chartWidth)
      .attr("height", chartHeight)
      .style("fill", "none")
      .style("pointer-events", "all")
      .on("mousemove", function (event) {
        const [mouseX] = d3.pointer(event);
        const x0 = xScale.invert(mouseX);

        // Find the data point closest to mouse position using bisector
        const bisect = d3.bisector((d: typeof processedData[0]) => new Date(d.timestamp)).left;
        const i = bisect(processedData, x0, 1);
        const d0 = processedData[i - 1];
        const d1 = processedData[i];
        const d = d1 && (x0.getTime() - new Date(d0.timestamp).getTime() > new Date(d1.timestamp).getTime() - x0.getTime()) ? d1 : d0;

        if (d) {
          tooltip.style("visibility", "visible")
            .html(`
              <p style="font-weight: bold; font-size: 12px; color: white; margin-bottom: 4px;">${d.date}</p>
              <p style="font-size: 12px; color: #ef4444;">Southern US: ${Math.round(d['Southern US'])} birds</p>
              <p style="font-size: 12px; color: #3b82f6;">Central US: ${Math.round(d['Central US'])} birds</p>
              <p style="font-size: 12px; color: #10b981;">Northern US: ${Math.round(d['Northern US'])} birds</p>
            `)
            .style("top", (event.pageY - 10) + "px")
            .style("left", (event.pageX + 10) + "px");

          // Show dots at the current data point for visual feedback
          regions.forEach((_, index) => {
            chartGroup.selectAll(`.dot-${index}`)
              .attr("r", (datum) => datum === d ? 3 : 0);
          });
        }
      })
      .on("mouseout", function () {
        tooltip.style("visibility", "hidden");
        // Hide all dots when not hovering
        regions.forEach((_, index) => {
          chartGroup.selectAll(`.dot-${index}`)
            .attr("r", 0);
        });
      });

    // Add legend to identify which line represents which region
    const legend = chartGroup.append("g")
      .attr("transform", `translate(10, 10)`);

    regions.forEach((regionName, index) => {
      const legendRow = legend.append("g")
        .attr("transform", `translate(0, ${index * 15})`);

      legendRow.append("line")
        .attr("x1", 0)
        .attr("x2", 12)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", colors[index])
        .attr("stroke-width", 1.5);

      legendRow.append("text")
        .attr("x", 15)
        .attr("y", 0)
        .attr("dy", "0.35em")
        .style("font-size", "11px")
        .style("fill", "#94a3b8")
        .text(regionName);
    }); return () => tooltip.remove();
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
        <p className="text-gray-400 text-xs">No regional data available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <div ref={containerRef} className="w-full h-full">
          <svg ref={svgRef} className="w-full h-full" />
        </div>      
      </div>

      <div className="mt-1 p-2 bg-slate-700/50 rounded border border-slate-600">
        <h4 className="text-xs font-medium text-white mb-1">Peak Migration Times</h4>

        <div className="grid grid-cols-3 gap-1 text-xs">
          <div className="bg-red-900/20 p-1.5 rounded border border-red-800/30">
            <p className="font-semibold text-red-400">Southern US</p>
            <p className="text-gray-300">{peakMonths['Southern US'].month}</p>
            <p className="text-gray-400">~{peakMonths['Southern US'].value.toFixed(0)} birds</p>
          </div>
          <div className="bg-blue-900/20 p-1.5 rounded border border-blue-800/30">
            <p className="font-semibold text-blue-400">Central US</p>
            <p className="text-gray-300">{peakMonths['Central US'].month}</p>
            <p className="text-gray-400">~{peakMonths['Central US'].value.toFixed(0)} birds</p>
          </div>
          <div className="bg-green-900/20 p-1.5 rounded border border-green-800/30">
            <p className="font-semibold text-green-400">Northern US</p>
            <p className="text-gray-300">{peakMonths['Northern US'].month}</p>
            <p className="text-gray-400">~{peakMonths['Northern US'].value.toFixed(0)} birds</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionalActivityHotspots;