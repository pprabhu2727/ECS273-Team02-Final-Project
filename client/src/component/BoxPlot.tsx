import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

/**
 * Data structure for raw monthly bird count data from the backend
 * Contains all daily counts for a specific month and year
 */
interface BoxPlotDataPoint {
  month: number;
  year: number;
  dailyCounts: number[];
}

/**
 * Statistical summary for box plot visualization
 * Contains the five-number summary plus outliers and IQR
 */
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

export default function BoxPlot({ scientificName, currentDate }: { scientificName: string; currentDate: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<BoxPlotDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract year from currentDate for year-specific filtering
  const selectedYear = new Date(currentDate).getFullYear();

  // Filter data by selected year to show seasonal patterns for that specific year
  const yearData = data.filter(d => d.year === selectedYear);

  /**
   * Fetch aggregated monthly count data from the backend
   * 
   * The backend provides daily counts grouped by month and year,
   * which we then use to calculate box plot statistics for visualizing
   * seasonal activity patterns and identifying unusual activity periods.
   */
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`http://localhost:8000/boxplot/${encodeURIComponent(scientificName)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        console.log('BoxPlot data received:', data);
        console.log('Available years:', [...new Set(data.map((d: any) => d.year))].sort());
        setData(data);
      })
      .catch(err => {
        setError('Failed to load data');
        console.error("Fetch error:", err);
      })
      .finally(() => setLoading(false));
  }, [scientificName]);

  /**
   * Calculate five-number summary and outliers for box plot visualization
   * 
   * Uses the standard box plot methodology: Q1, median, Q3, and outliers
   * defined as values beyond 1.5 * IQR from the quartiles. This helps
   * identify both typical seasonal patterns and unusual activity spikes.
   */
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

  /**
   * Main chart rendering function with responsive design and year filtering
   * 
   * Creates a traditional box plot visualization showing seasonal patterns for
   * the selected year. Each month shows the distribution of daily bird counts,
   * helping users identify peak activity periods and unusual observations.
   */
  const drawChart = () => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const containerRect = containerRef.current.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    svg.attr("width", width).attr("height", height);

    /**
     * Graceful handling of missing year data
     * 
     * When users select a year without bird data, we show available years
     * to guide them toward periods with observations. This prevents the
     * frustrating experience of seeing an empty chart with no explanation.
     */
    if (yearData.length === 0) {
      const availableYears = [...new Set(data.map(d => d.year))].sort();

      const noDataGroup = svg.append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

      noDataGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-20")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("fill", "#94a3b8")
        .text(`No Data Available for ${selectedYear}`);

      if (availableYears.length > 0) {
        noDataGroup.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0")
          .style("font-size", "12px")
          .style("fill", "#64748b")
          .text(`Available years: ${availableYears.join(', ')}`);
      }

      noDataGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "20")
        .style("font-size", "12px")
        .style("fill", "#64748b")
        .text("Select a different year to view seasonal patterns");
      return;
    }

    /**
     * Responsive margin calculation for optimal layout
     * 
     * We calculate margins as percentages of container size to ensure the chart
     * looks good across different screen sizes. The left margin is larger to
     * accommodate y-axis labels without overlap issues.
     */
    const margin = {
      top: Math.min(40, height * 0.12),
      right: Math.min(30, width * 0.08),
      bottom: Math.min(60, height * 0.18),
      left: Math.min(60, width * 0.15)
    };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    /**
     * Transform raw data into statistical summaries for each month
     * 
     * For each month with data, we calculate the five-number summary (min, Q1, median, Q3, max)
     * plus outliers. This gives us everything needed to draw traditional box plots.
     */
    const stats: BoxPlotStats[] = yearData.map(d => ({
      month: d.month,
      ...calculateStats(d.dailyCounts)
    }));

    /**
     * Create ordinal scale for month positioning
     * 
     * Using band scale with padding creates evenly spaced boxes with gaps between
     * them, making the chart easier to read and more visually appealing.
     */
    const xScale = d3.scaleBand()
      .domain(months)
      .range([0, chartWidth])
      .padding(0.3);

    /**
     * Y-scale with smart domain calculation
     * 
     * We include all values (quartiles, whiskers, outliers) in the domain calculation
     * to ensure nothing gets cut off. Adding 10% padding at the top and small buffer
     * at bottom provides visual breathing room.
     */
    const allValues = stats.flatMap(d => [d.min, d.max, ...d.outliers]);
    const yExtent = d3.extent(allValues) as [number, number];
    const yScale = d3.scaleLinear()
      .domain([Math.max(0, yExtent[0] - 5), yExtent[1] * 1.1])
      .range([chartHeight, 0])
      .nice();

    const chartGroup = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    /**
     * Subtle grid lines for easier value reading
     * 
     * Light horizontal grid lines help users estimate values without cluttering
     * the visualization. We use the same tick positions as the y-axis for consistency.
     */
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
      .attr("stroke-width", 0.5);    /**
     * X-axis with responsive styling to match other components
     * 
     * Month labels are positioned at the bottom and sized responsively.
     * tickSizeOuter(0) removes the end ticks for a cleaner appearance.
     */
    chartGroup.append("g")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", `${Math.max(10, Math.min(12, height * 0.03))}px`)
      .style("fill", "#94a3b8");

    /**
     * Y-axis with adaptive tick count based on available space
     * 
     * Dynamic tick calculation ensures readability across different screen sizes.
     * Minimum 4 ticks, maximum 8, with spacing based on chart height.
     */
    chartGroup.append("g")
      .call(d3.axisLeft(yScale).ticks(Math.max(4, Math.min(8, Math.floor(chartHeight / 50)))))
      .selectAll("text")
      .style("font-size", `${Math.max(10, Math.min(12, height * 0.03))}px`)
      .style("fill", "#94a3b8");    /**
     * Consistent axis styling across all chart components
     * 
     * Applying uniform color scheme for domain lines and tick marks
     * to maintain visual coherence with other visualizations.
     */
    chartGroup.selectAll(".domain")
      .style("stroke", "#94a3b8");

    chartGroup.selectAll(".tick line")
      .style("stroke", "#94a3b8");    /**
     * Responsive X-axis label that adapts to container size
     * 
     * We only show the label when there's sufficient bottom margin space 
     * to prevent overcrowding. Font sizes scale with container dimensions 
     * to maintain readability across different screen sizes.
     */
    if (margin.bottom > 30) {
      chartGroup.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", chartHeight + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .style("font-size", `${Math.max(11, Math.min(14, height * 0.035))}px`)
        .style("font-weight", "500")
        .style("fill", "#94a3b8")
        .text("Month");
    }

    /**
     * Y-axis label with careful positioning to avoid overlap
     * 
     * Rotated label positioned based on left margin availability.
     * The rotation and positioning ensure it doesn't interfere with tick labels.
     */
    if (margin.left > 40) {
      chartGroup.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -chartHeight / 2)
        .attr("y", -margin.left + 12)
        .attr("text-anchor", "middle")
        .style("font-size", `${Math.max(10, Math.min(12, height * 0.03))}px`)
        .style("font-weight", "500")
        .style("fill", "#94a3b8")
        .text("Daily Count");
    }

    /**
     * Chart title with year context for temporal awareness
     * 
     * Dynamic title showing species name and selected year helps users
     * understand the temporal context of the data they're viewing.
     * Only displayed when there's sufficient top margin space.
     */
    if (margin.top > 25) {
      chartGroup.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", `${Math.max(12, Math.min(16, height * 0.04))}px`)
        .style("font-weight", "bold")
        .style("fill", "#94a3b8")
        .text(`${scientificName || 'Species'} - ${selectedYear} Monthly Distribution`);
    }

    /**
     * Interactive tooltip for detailed statistics
     * 
     * Shows the five-number summary plus outlier count when users hover over boxes.
     * Positioned to follow mouse movement for optimal readability.
     */
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
      .style("z-index", "1000");    /**
     * Render box plots for each month with complete statistical visualization
     * 
     * Each box plot shows the five-number summary: box (Q1 to Q3), median line, 
     * whiskers (min/max within 1.5*IQR), and outliers as red dots. This comprehensive 
     * view helps identify both typical patterns and unusual activity spikes.
     */
    stats.forEach((d) => {
      const monthName = months[d.month - 1];
      const x = xScale(monthName) || 0;
      const boxWidth = xScale.bandwidth();
      const boxHeight = yScale(d.q1) - yScale(d.q3);

      const group = chartGroup.append("g").attr("class", "box-plot-group");

      /**
       * Main box representing the interquartile range (Q1 to Q3)
       * 
       * The blue box contains 50% of the data (middle two quartiles).
       * Box height represents the spread of typical values for each month.
       */
      const box = group.append("rect")
        .attr("x", x)
        .attr("y", yScale(d.q3))
        .attr("width", boxWidth)
        .attr("height", Math.abs(boxHeight))
        .attr("fill", "#4c9ed9")
        .attr("stroke", "#2c5aa0")
        .attr("stroke-width", 1.5)
        .style("cursor", "pointer");

      /**
       * Median line - the thick dark line shows the middle value
       * 
       * This is often more robust than the mean for understanding
       * typical activity levels, especially with skewed distributions.
       */
      group.append("line")
        .attr("x1", x)
        .attr("x2", x + boxWidth)
        .attr("y1", yScale(d.median))
        .attr("y2", yScale(d.median))
        .attr("stroke", "#1a365d")
        .attr("stroke-width", 2);

      /**
       * Whiskers extending to min/max values within 1.5 * IQR
       * 
       * These show the range of "normal" variation. Values beyond
       * the whiskers are considered potential outliers and shown as dots.
       */
      const whiskerWidth = boxWidth * 0.6;
      const whiskerOffset = (boxWidth - whiskerWidth) / 2;

      // Upper whisker (Q3 to max)
      group.append("line")
        .attr("x1", x + boxWidth / 2)
        .attr("x2", x + boxWidth / 2)
        .attr("y1", yScale(d.q3))
        .attr("y2", yScale(d.max))
        .attr("stroke", "#2c5aa0")
        .attr("stroke-width", 1.5);

      // Upper whisker cap
      group.append("line")
        .attr("x1", x + whiskerOffset)
        .attr("x2", x + whiskerOffset + whiskerWidth)
        .attr("y1", yScale(d.max))
        .attr("y2", yScale(d.max))
        .attr("stroke", "#2c5aa0")
        .attr("stroke-width", 1.5);

      // Lower whisker (Q1 to min)
      group.append("line")
        .attr("x1", x + boxWidth / 2)
        .attr("x2", x + boxWidth / 2)
        .attr("y1", yScale(d.q1))
        .attr("y2", yScale(d.min))
        .attr("stroke", "#2c5aa0")
        .attr("stroke-width", 1.5);

      // Lower whisker cap
      group.append("line")
        .attr("x1", x + whiskerOffset)
        .attr("x2", x + whiskerOffset + whiskerWidth)
        .attr("y1", yScale(d.min))
        .attr("y2", yScale(d.min))
        .attr("stroke", "#2c5aa0")
        .attr("stroke-width", 1.5);

      /**
       * Outliers as red dots - values beyond 1.5 * IQR from quartiles
       * 
       * These represent unusual activity spikes or drops that warrant
       * attention. Red color makes them stand out for investigation.
       */
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

      /**
       * Interactive hover behavior for detailed statistics
       * 
       * Box highlighting and tooltip provide the complete five-number summary
       * plus outlier count when users need precise values for analysis.
       */      /**
      * Interactive hover behavior for detailed statistics
      * 
      * Box highlighting and tooltip provide the complete five-number summary
      * plus outlier count when users need precise values for analysis.
      */
      box.on("mouseover", function (event) {
        // Subtle color change to indicate interactivity
        d3.select(this).transition().duration(200).attr("fill", "#6bb6ff");

        // Show comprehensive statistical summary in tooltip
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
          `)
          .style("top", (event.pageY - 10) + "px")
          .style("left", (event.pageX + 10) + "px");
      })
        // Tooltip follows mouse movement for better readability
        .on("mousemove", function (event) {
          tooltip
            .style("top", (event.pageY - 10) + "px")
            .style("left", (event.pageX + 10) + "px");
        })
        // Return to original state when hover ends
        .on("mouseout", function () {
          d3.select(this).transition().duration(200).attr("fill", "#4c9ed9");
          tooltip.style("visibility", "hidden");
        });
    });

    return () => tooltip.remove();
  };
  useEffect(() => {
    if (data.length > 0) drawChart();
  }, [data, selectedYear]); // Add selectedYear as dependency
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) drawChart();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [data, selectedYear]); // Add selectedYear as dependency

  if (loading) {
    return <div className="w-full h-full flex items-center justify-center text-gray-600">Loading box plot data...</div>;
  }

  if (error) {
    return <div className="w-full h-full flex items-center justify-center text-red-600">{error}</div>;
  }
  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}