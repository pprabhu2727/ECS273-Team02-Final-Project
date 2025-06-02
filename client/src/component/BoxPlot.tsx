import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface BoxPlotDataPoint {
  month: number;
  dailyCounts: number[];
}

interface BoxPlotStats {
  month: number;
  q1: number;
  median: number;
  q3: number;
  min: number;
  max: number;
  outliers: number[];
  iqr: number;
}

export default function BoxPlot({ scientificName }: { scientificName: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<BoxPlotDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch real backend data
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`http://localhost:8000/boxplot/${encodeURIComponent(scientificName)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(setData)
      .catch(err => {
        setError('Failed to load data');
        console.error("Fetch error:", err);
      })
      .finally(() => setLoading(false));
  }, [scientificName]);

  const calculateStats = (values: number[]): Omit<BoxPlotStats, 'month'> => {
    const sorted = [...values].sort(d3.ascending);
    const q1 = d3.quantileSorted(sorted, 0.25) ?? 0;
    const median = d3.quantileSorted(sorted, 0.5) ?? 0;
    const q3 = d3.quantileSorted(sorted, 0.75) ?? 0;
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;
    const min = sorted.find(d => d >= lowerFence) ?? sorted[0];
    const max = [...sorted].reverse().find(d => d <= upperFence) ?? sorted[0];
    const outliers = sorted.filter(d => d < lowerFence || d > upperFence);
    return { q1, median, q3, min, max, outliers, iqr };
  };

  const drawChart = () => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const containerRect = containerRef.current.getBoundingClientRect();
    const width = Math.max(400, containerRect.width);
    const height = Math.max(300, containerRect.height);

    svg.attr("width", width).attr("height", height);

    const margin = { top: 60, right: 40, bottom: 80, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const stats: BoxPlotStats[] = data.map(d => ({
      month: d.month,
      ...calculateStats(d.dailyCounts)
    }));

    const xScale = d3.scaleBand()
      .domain(months)
      .range([0, chartWidth])
      .padding(0.3);

    const allValues = stats.flatMap(d => [d.min, d.max, ...d.outliers]);
    const yExtent = d3.extent(allValues) as [number, number];
    const yScale = d3.scaleLinear()
      .domain([Math.max(0, yExtent[0] - 5), yExtent[1] * 1.1])
      .range([chartHeight, 0])
      .nice();

    const chartGroup = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const yTicks = yScale.ticks(8);
    chartGroup.selectAll(".grid-line")
      .data(yTicks)
      .enter()
      .append("line")
      .attr("class", "grid-line")
      .attr("x1", 0)
      .attr("x2", chartWidth)
      .attr("y1", d => yScale(d))
      .attr("y2", d => yScale(d))
      .attr("stroke", "#e0e0e0")
      .attr("stroke-width", 0.5);

    // X-axis with proper text color
    chartGroup.append("g")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#374151"); // Dark gray color

    // Y-axis with proper text color
    chartGroup.append("g")
      .call(d3.axisLeft(yScale).ticks(8))
      .selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#374151"); // Dark gray color

    // Style axis lines
    chartGroup.selectAll(".domain")
      .style("stroke", "#6b7280");

    chartGroup.selectAll(".tick line")
      .style("stroke", "#6b7280");

    chartGroup.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight + 50)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "500")
      .style("fill", "#374151")
      .text("Month");

    chartGroup.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -chartHeight / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "500")
      .style("fill", "#374151")
      .text("Daily Count");

    chartGroup.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", -30)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .style("fill", "#1f2937")
      .text(`${scientificName || 'Species'} - Monthly Distribution`);

    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000");

    stats.forEach((d, i) => {
      const monthName = months[d.month - 1];
      const x = xScale(monthName) || 0;
      const boxWidth = xScale.bandwidth();
      const boxHeight = yScale(d.q1) - yScale(d.q3);

      const group = chartGroup.append("g").attr("class", "box-plot-group");

      const box = group.append("rect")
        .attr("x", x)
        .attr("y", yScale(d.q3))
        .attr("width", boxWidth)
        .attr("height", Math.abs(boxHeight))
        .attr("fill", "#4c9ed9")
        .attr("stroke", "#2c5aa0")
        .attr("stroke-width", 1.5)
        .style("cursor", "pointer");

      group.append("line")
        .attr("x1", x)
        .attr("x2", x + boxWidth)
        .attr("y1", yScale(d.median))
        .attr("y2", yScale(d.median))
        .attr("stroke", "#1a365d")
        .attr("stroke-width", 2);

      const whiskerWidth = boxWidth * 0.6;
      const whiskerOffset = (boxWidth - whiskerWidth) / 2;

      group.append("line")
        .attr("x1", x + boxWidth / 2)
        .attr("x2", x + boxWidth / 2)
        .attr("y1", yScale(d.q3))
        .attr("y2", yScale(d.max))
        .attr("stroke", "#2c5aa0")
        .attr("stroke-width", 1.5);

      group.append("line")
        .attr("x1", x + whiskerOffset)
        .attr("x2", x + whiskerOffset + whiskerWidth)
        .attr("y1", yScale(d.max))
        .attr("y2", yScale(d.max))
        .attr("stroke", "#2c5aa0")
        .attr("stroke-width", 1.5);

      group.append("line")
        .attr("x1", x + boxWidth / 2)
        .attr("x2", x + boxWidth / 2)
        .attr("y1", yScale(d.q1))
        .attr("y2", yScale(d.min))
        .attr("stroke", "#2c5aa0")
        .attr("stroke-width", 1.5);

      group.append("line")
        .attr("x1", x + whiskerOffset)
        .attr("x2", x + whiskerOffset + whiskerWidth)
        .attr("y1", yScale(d.min))
        .attr("y2", yScale(d.min))
        .attr("stroke", "#2c5aa0")
        .attr("stroke-width", 1.5);

      group.selectAll(".outlier")
        .data(d.outliers)
        .enter()
        .append("circle")
        .attr("class", "outlier")
        .attr("cx", x + boxWidth / 2)
        .attr("cy", v => yScale(v))
        .attr("r", 3)
        .attr("fill", "#e53e3e")
        .attr("stroke", "#c53030")
        .attr("stroke-width", 1);

      box.on("mouseover", function (event) {
        d3.select(this).transition().duration(200).attr("fill", "#6bb6ff");

        tooltip
          .style("visibility", "visible")
          .html(`
            <strong>${monthName}</strong><br/>
            Max: ${d.max.toFixed(1)}<br/>
            Q3: ${d.q3.toFixed(1)}<br/>
            Median: ${d.median.toFixed(1)}<br/>
            Q1: ${d.q1.toFixed(1)}<br/>
            Min: ${d.min.toFixed(1)}<br/>
            Outliers: ${d.outliers.length}
          `);
      })
        .on("mousemove", function (event) {
          tooltip
            .style("top", (event.pageY - 10) + "px")
            .style("left", (event.pageX + 10) + "px");
        })
        .on("mouseout", function () {
          d3.select(this).transition().duration(200).attr("fill", "#4c9ed9");
          tooltip.style("visibility", "hidden");
        });
    });

    return () => tooltip.remove();
  };

  useEffect(() => {
    if (data.length > 0) drawChart();
  }, [data]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && data.length > 0) drawChart();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [data]);

  if (loading) {
    return <div className="w-full h-full flex items-center justify-center text-gray-600">Loading box plot data...</div>;
  }

  if (error) {
    return <div className="w-full h-full flex items-center justify-center text-red-600">{error}</div>;
  }

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px]">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}