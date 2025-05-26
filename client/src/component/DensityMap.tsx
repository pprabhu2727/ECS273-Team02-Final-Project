import { useEffect, useRef, useState } from 'react';
import { OccurrencePoint } from '../types';
import * as d3 from 'd3';
import { hexbin as d3Hexbin } from 'd3-hexbin';
import { debounce } from 'lodash';

interface DensityMapProps {
  occurrences: OccurrencePoint[];
  currentDate: string;
  showClimate: boolean;
}

// Point type with bird counts and climate data
interface CustomPoint extends Array<number> {
  0: number; // x 
  1: number; // y
  count: number;
  temperature: number;
  precipitation: number;
}

export default function DensityMap({ occurrences, currentDate, showClimate }: DensityMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapWidth, setMapWidth] = useState(0);
  const [mapHeight, setMapHeight] = useState(0);
  
  // Filter occurrences for the current month/year
  const filteredOccurrences = occurrences.filter(d => {
    const occDate = new Date(d.date);
    const currDate = new Date(currentDate);
    return occDate.getFullYear() === currDate.getFullYear() && 
           occDate.getMonth() === currDate.getMonth();
  });

  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;
    
    // Make the map responsive to container size changes
    const resizeObserver = new ResizeObserver(
      debounce((entries: ResizeObserverEntry[]) => {
        for (const entry of entries) {
          if (entry.target !== containerRef.current) continue;
          const { width, height } = entry.contentRect;
          if (width && height) {
            setMapWidth(width);
            setMapHeight(height);
          }
        }
      }, 100)
    );

    resizeObserver.observe(containerRef.current);
    
    // Set initial dimensions
    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width && height) {
      setMapWidth(width);
      setMapHeight(height);
    }
    
    return () => resizeObserver.disconnect();
  }, []);
  
  useEffect(() => {
    if (!svgRef.current || mapWidth === 0) {
      console.log('Not ready to render map:', { 
        svgRef: !!svgRef.current, 
        mapWidth 
      });
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous rendering
    svg.append("defs")
      .append("clipPath")
      .attr("id", "map-clip")
      .append("rect")
      .attr("x", -mapWidth * 0.05)
      .attr("y", -mapHeight * 0.05)
      .attr("width", mapWidth * 1.1)
      .attr("height", mapHeight * 1.1);
      
    // Convert TopoJSON to GeoJSON for the US map
    function topojsonFeature(topology: any, object: any): any {
      const arcs = topology.arcs;
      const transform = topology.transform;
      
      // Apply coordinate transformation if available
      function applyTransform(point: number[]): number[] {
        if (!transform) return point;
        const scale = transform.scale;
        const translate = transform.translate;
        return [point[0] * scale[0] + translate[0], point[1] * scale[1] + translate[1]];
      }
      function decodeArc(arcIdx: number): number[][] {
        let arc = arcs[arcIdx < 0 ? ~arcIdx : arcIdx];
        let points: number[][] = [];
        let x = 0, y = 0;
        for (let i = 0; i < arc.length; ++i) {
          x += arc[i][0];
          y += arc[i][1];
          points.push(applyTransform([x, y]));
        }
        if (arcIdx < 0) points.reverse();
        return points;
      }
      function arcsToCoords(arcsArr: any[]): number[][][] {
        return arcsArr.map((ring: any) => ring.flatMap((arcIdx: number) => decodeArc(arcIdx)));
      }
      if (object.type === 'GeometryCollection') {
        return {
          type: 'FeatureCollection',
          features: object.geometries.map((g: any) => topojsonFeature(topology, g))
        };
      } else if (object.type === 'Polygon') {
        return {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: arcsToCoords(object.arcs)
          },
          properties: object.properties || {}
        };
      } else if (object.type === 'MultiPolygon') {
        return {
          type: 'Feature',
          geometry: {
            type: 'MultiPolygon',
            coordinates: object.arcs.map((arcsArr: any) => arcsToCoords(arcsArr))
          },
          properties: object.properties || {}
        };
      }
      return null;
    }

    // Fetch and render the US map background
    fetch('/src/assets/counties-albers-10m.json')
      .then(res => res.json())
      .then(us => {        // Extract nation and state boundaries
        const nation = topojsonFeature(us, us.objects.nation);
        const states = topojsonFeature(us, us.objects.states);
        
        // Calculate appropriate scale to fit the map within the container
        // First create a temporary path generator to get the bounds of the nation
        const tempPath = d3.geoPath();
        const bounds = tempPath.bounds(nation);
        const width = bounds[1][0] - bounds[0][0];
        const height = bounds[1][1] - bounds[0][1];
        
        // Calculate scale and translation to fit the map
        const scale = 0.95 * Math.min(mapWidth / width, mapHeight / height);
        const translateX = (mapWidth - scale * width) / 2 - scale * bounds[0][0];
        const translateY = (mapHeight - scale * height) / 2 - scale * bounds[0][1];
        
        // Create a transform function for the map elements
        const transform = d3.geoTransform({
          point: function(x, y) {
            this.stream.point(scale * x + translateX, scale * y + translateY);
          }
        });
        
        // Use the transform with the path generator
        const fitPath = d3.geoPath().projection(transform);
        
        // For overlays, create a properly scaled Albers projection
        const projection = d3.geoAlbersUsa()
          .scale(scale * 1100) // Base scale factor adjusted by our calculated scale
          .translate([mapWidth / 2, mapHeight / 2]);
          
        // Draw nation background with fitted path
        if (nation && (nation.type === 'FeatureCollection' || nation.type === 'Feature')) {
          svg.append('g')
            .attr('class', 'us-nation')
            .selectAll('path')
            .data(nation.type === 'FeatureCollection' ? nation.features : [nation])
            .join('path')
            .attr('d', (d: any) => fitPath(d) as string)
            .attr('fill', '#f8f8f8')
            .attr('stroke', '#bbb')
            .attr('stroke-width', 1);
        }
        // Draw state boundaries
        if (states && (states.type === 'FeatureCollection' || states.type === 'Feature')) {
          svg.append('g')
            .attr('class', 'us-states')
            .selectAll('path')
            .data(states.type === 'FeatureCollection' ? states.features : [states])
            .join('path')
            .attr('d', (d: any) => fitPath(d) as string)
            .attr('fill', 'none')
            .attr('stroke', '#888')
            .attr('stroke-width', 0.7);
        }
        // Now render overlays as before, but after the map background
        renderOverlays(svg, projection);
      })
      .catch(err => {
        console.error('Error loading US map:', err);
        svg.append("text")
          .attr("x", mapWidth / 2)
          .attr("y", mapHeight / 2)
          .attr("text-anchor", "middle")
          .text("Error loading map background");
      });    // Render bird density hexbin visualization on top of the map
    function renderOverlays(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, projection: d3.GeoProjection) {
      try {
        // Check for data before attempting visualization
        if (!filteredOccurrences.length) {
          svg.append("text")
            .attr("x", mapWidth / 2)
            .attr("y", mapHeight / 2)
            .attr("text-anchor", "middle")
            .text("No occurrence data for this date");
          return;
        }
        
        // Size hexbins proportionally to the map
        const hexRadius = Math.min(mapWidth, mapHeight) * 0.01;
        
        // Set up hexbin layout
        const hexbinGenerator = d3Hexbin<CustomPoint>()
          .x((d: CustomPoint) => d[0])
          .y((d: CustomPoint) => d[1])
          .extent([[0, 0], [mapWidth, mapHeight]])
          .radius(hexRadius);
          
        // Important: Make sure each point is properly projected from lat/long to screen coordinates
        const points: CustomPoint[] = [];
        filteredOccurrences.forEach(d => {
          // Check for valid coordinates first
          if (isNaN(d.longitude) || isNaN(d.latitude)) {
            console.warn('Invalid coordinates:', d);
            return;
          }
          
          // Project coordinates using Albers USA projection
          const coords = projection([d.longitude, d.latitude]);
          
          // Only include points that are within the projection bounds
          if (coords && !isNaN(coords[0]) && !isNaN(coords[1])) {
            const point = [coords[0], coords[1]] as CustomPoint;
            point.count = d.count || 1; // Default to 1 if count is missing
            point.temperature = d.temperature;
            point.precipitation = d.precipitation;
            points.push(point);
          }
        });
        
        // Debug output to verify points
        //console.log(`Projected ${points.length} out of ${filteredOccurrences.length} points`);
        
        // Continue only if we have points
        if (points.length === 0) {
          svg.append("text")
            .attr("x", mapWidth / 2)
            .attr("y", mapHeight / 2)
            .attr("text-anchor", "middle")
            .text("No points could be projected for this date");
          return;
        }
        
        const bins = hexbinGenerator(points);
        
        // Sum bird counts in each hexbin
        const getBinValue = (bin: Array<CustomPoint>) => d3.sum(bin, (d: CustomPoint) => d.count);
        const validBins = bins.filter(bin => getBinValue(bin) > 0);
        if (!validBins.length) {
          svg.append("text")
            .attr("x", mapWidth / 2)
            .attr("y", mapHeight / 2)
            .attr("text-anchor", "middle")
            .text("No occurrence data for this date");
          return;
        }
        const countExtent = d3.extent(validBins, getBinValue) as [number | undefined, number | undefined];
        if (countExtent[1] == null || isNaN(countExtent[1]) || countExtent[1] <= 0) {
          svg.append("text")
            .attr("x", mapWidth / 2)
            .attr("y", mapHeight / 2)
            .attr("text-anchor", "middle")
            .text("No occurrence data for this date");
          return;
        }
        const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
          .domain([0, countExtent[1]]);
        const radiusScale = d3.scaleSqrt()
          .domain([0, countExtent[1]])
          .range([0, hexbinGenerator.radius() * Math.SQRT2]);
        const hexGroup = svg.append("g")
          .attr("clip-path", "url(#map-clip)");
        hexGroup.selectAll("path")
          .data(validBins)
          .join("path")
            .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
            .attr("d", (d: any) => hexbinGenerator.hexagon(radiusScale(getBinValue(d))))
            .attr("fill", (d: any) => colorScale(getBinValue(d)))
            .attr("stroke", (d: any) => d3.lab(colorScale(getBinValue(d))).toString())
            .attr("stroke-width", 0.5)
          .append("title")
            .text((d: any) => {
              const totalCount = getBinValue(d);
              const avgTemp = d3.mean(d as CustomPoint[], (p: CustomPoint) => p.temperature);
              const avgPrecip = d3.mean(d as CustomPoint[], (p: CustomPoint) => p.precipitation);
              return `Total birds: ${totalCount.toFixed(0)}\nAvg temperature: ${avgTemp?.toFixed(1)}°C\nAvg precipitation: ${avgPrecip?.toFixed(1)}mm`;
            });        // Show temperature gradient overlay when enabled
         
        // Add hexbin density legend
          const densityLegend = svg.append("g")
            .attr("transform", `translate(20, 20)`);
          densityLegend.append("text")
            .attr("x", 0)
            .attr("y", -5)
            .attr("font-size", "10px")
            .text("Bird Count");
          // Create legend items
          const legendValues = [1, 10, 50, 100, countExtent[1] ? Math.round(countExtent[1] / 2) : 0, countExtent[1] ? Math.round(countExtent[1]) : 0];
          const uniqueLegendValues = Array.from(new Set(legendValues))
            .filter(v => v > 0 && v <= (countExtent[1] ?? 0))
            .sort((a, b) => a - b);
          uniqueLegendValues.forEach((value, i) => {
            const hexSize = radiusScale(value);
            densityLegend.append("path")
              .attr("transform", `translate(${hexSize}, ${i * 25 + 10})`)
              .attr("d", hexbinGenerator.hexagon(hexSize))
              .attr("fill", colorScale(value))
              .attr("stroke", d3.lab(colorScale(value)).toString())
              .attr("stroke-width", 0.5);
            densityLegend.append("text")
              .attr("x", hexSize * 2 + 5)
              .attr("y", i * 25 + 10 + 5)
              .attr("font-size", "10px")
              .attr("alignment-baseline", "middle")
              .text(value.toString());
          });    

        const legendHeight = 10;
        const legendWidth = 150;
        const legendX = mapWidth - legendWidth - 20;
        const legendY = 20;
        // Show climate data overlay when enabled
        if (showClimate) {
          const tempExtent = d3.extent(filteredOccurrences, d => d.temperature) as [number, number];  
          if (tempExtent[0] != null && tempExtent[1] != null && !isNaN(tempExtent[0]) && !isNaN(tempExtent[1]) && tempExtent[0] !== tempExtent[1]) {
            const tempColorScale = d3.scaleSequential(d3.interpolateRdBu)
              .domain([tempExtent[1], tempExtent[0]]);
            const defs = svg.append("defs");
            const gradient = defs.append("linearGradient")
              .attr("id", "temp-gradient")
              .attr("x1", "0%")
              .attr("x2", "100%")
              .attr("y1", "0%")
              .attr("y2", "0%");
            gradient.append("stop")
              .attr("offset", "0%")
              .attr("stop-color", tempColorScale(tempExtent[0]));
            gradient.append("stop")
              .attr("offset", "100%")
              .attr("stop-color", tempColorScale(tempExtent[1]));
            svg.append("rect")
              .attr("x", legendX)
              .attr("y", legendY)
              .attr("width", legendWidth)
              .attr("height", legendHeight)
              .style("fill", "url(#temp-gradient)");
            svg.append("text")
              .attr("x", legendX)
          } else {
            svg.append("text")
              .attr("x", legendX)
              .attr("y", legendY)
              .attr("text-anchor", "middle")
              .text("No climate data for this date");
          }
        } 
      } catch (err) {
        console.error('Error rendering overlays:', err);
        svg.append("text")
          .attr("x", mapWidth / 2)
          .attr("y", mapHeight / 2)
          .attr("text-anchor", "middle")
          .text("Error rendering overlays");
      }
    }
  }, [mapWidth, mapHeight, filteredOccurrences, showClimate, currentDate]);    return (
    <div className="w-full h-full overflow-hidden" ref={containerRef}>
      <svg 
        ref={svgRef}
        width="100%"
        height="100%"
        className="overflow-hidden"
        viewBox={`0 0 ${mapWidth || 600} ${mapHeight || 400}`}
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
  );
}
