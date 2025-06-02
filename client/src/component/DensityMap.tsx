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
    svg.selectAll("*").remove();
    svg.on(".zoom", null);

    let cancelled = false;

    const safeName = scientificName.replace(/ /g, "_");
    const staticImageUrl = `http://localhost:8000/static/${safeName}_${currentDate}.png`;

    const checkAndRender = async () => {
      try {
        const headRes = await fetch(staticImageUrl, { method: "HEAD" });

        if (cancelled) return;

        if (headRes.ok) {
          renderImage(staticImageUrl);
        } else {
          const apiRes = await fetch(`http://localhost:8000/heatmap?date=${currentDate}&species=${scientificName}`);
          if (!apiRes.ok) return;

          const data = await apiRes.json();
          if (!data?.url) return;

          const fallbackUrl = `http://localhost:8000${data.url}`;
          renderImage(fallbackUrl);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error checking or rendering heatmap:", err);
        }
      }
    };

    const renderImage = (url: string) => {
      const g = svg.append("g");

      g.append("foreignObject")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 800)
        .attr("height", 500)
        .append("xhtml:img")
        .attr("src", url)
        .style("width", "800px")
        .style("height", "400px");

      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 12])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        });

      svg.call(zoom);
    };

    checkAndRender();

    return () => {
      cancelled = true;
      svg.on(".zoom", null);
    };
  }, [currentDate, selectedSpecies, scientificNames]);

  return (
    <svg ref={svgRef} width="100%" height="100%" />
  );
}
