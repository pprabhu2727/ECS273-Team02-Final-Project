import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface DensityMapProps {
  currentDate: string;
  selectedSpecies: string;
  scientificNames: Record<string, string>;
}

export default function DensityMap({ currentDate, selectedSpecies, scientificNames }: DensityMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !selectedSpecies || !scientificNames[selectedSpecies]) return;

    const scientificName = scientificNames[selectedSpecies];
    const svg = d3.select(svgRef.current);
    
    // Clear everything including zoom behavior
    svg.selectAll("*").remove();
    svg.on(".zoom", null); // Remove any existing zoom handlers
    
    let cancelled = false; // Flag to prevent state updates if component unmounts

    fetch(`http://localhost:8000/heatmap?date=${currentDate}&species=${scientificName}`)
      .then(res => {
        if (cancelled) return null;
        return res.json();
      })
      .then(data => {
        if (cancelled || !data) return;
        
        const imageUrl = `http://localhost:8000${data.url}`;
        const g = svg.append("g");

        // Use foreignObject + img for better compatibility
        g.append("foreignObject")
          .attr("x", 0)
          .attr("y", 0)
          .attr("width", 800)
          .attr("height", 500)
          .append("xhtml:img")
          .attr("src", imageUrl)
          .style("width", "800px")
          .style("height", "400px");

        const zoom = d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([1, 12])
          .on("zoom", (event) => {
            g.attr("transform", event.transform);
          });

        svg.call(zoom);
      })
      .catch(err => {
        if (!cancelled) {
          console.error("Failed to load image:", err);
        }
      });

    // Cleanup function
    return () => {
      cancelled = true;
      if (svgRef.current) {
        const svg = d3.select(svgRef.current);
        svg.on(".zoom", null); // Remove zoom handlers
      }
    };
  }, [currentDate, selectedSpecies, scientificNames]);

  return (
    <svg ref={svgRef} width="100%" height="100%" />
  );
}