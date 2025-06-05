import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface DensityMapProps {
  currentDate: string;
  selectedSpecies: string;
  scientificNames: Record<string, string>;
}

export default function DensityMap({ currentDate, selectedSpecies, scientificNames }: DensityMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log(`DensityMap useEffect triggered: date=${currentDate}, species=${selectedSpecies}`);

    if (!svgRef.current || !selectedSpecies || !scientificNames[selectedSpecies]) {
      console.log("Early return: missing required props or refs");
      return;
    }

    const scientificName = scientificNames[selectedSpecies];
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.on(".zoom", null);

    // Clean slate approach - remove any existing UI elements when props change
    // This prevents old error messages from lingering during transitions
    if (containerRef.current) {
      const container = d3.select(containerRef.current);
      container.selectAll("div").remove();
    }

    let cancelled = false;
    let loadingTimeout: number | null = null;

    // Convert scientific name to filename format (spaces become underscores)
    const safeName = scientificName.replace(/ /g, "_");
    const staticImageUrl = `http://localhost:8000/static/${safeName}_${currentDate}.png`;    /**
     * Smart date fallback system for when requested date has no data
     * 
     * This function helps users find nearby dates with available heatmap data.
     * We use a two-phase approach: quick nearby search first (30 days), then
     * broader year-wide search if needed. This balances responsiveness with coverage.
     */
    const findNearbyValidDates = async (currentDateStr: string, speciesName: string): Promise<{ before: string | null, after: string | null }> => {
      const current = new Date(currentDateStr);
      const result = { before: null as string | null, after: null as string | null };

      // Phase 1: Quick check within 30 days for immediate user feedback
      const quickCheck = async (maxDays: number) => {
        for (let i = 1; i <= maxDays; i++) {
          if (!result.before) {
            const beforeDate = new Date(current);
            beforeDate.setDate(current.getDate() - i);
            const beforeStr = beforeDate.toISOString().slice(0, 10);

            try {
              const safeName = speciesName.replace(/ /g, "_");
              const beforeUrl = `http://localhost:8000/static/${safeName}_${beforeStr}.png`;
              const headRes = await fetch(beforeUrl, { method: "HEAD" });
              if (headRes.ok) {
                result.before = beforeStr;
              }
            } catch (err) {
              // Continue checking other dates
            }
          }

          if (!result.after) {
            const afterDate = new Date(current);
            afterDate.setDate(current.getDate() + i);
            const afterStr = afterDate.toISOString().slice(0, 10);

            try {
              const safeName = speciesName.replace(/ /g, "_");
              const afterUrl = `http://localhost:8000/static/${safeName}_${afterStr}.png`;
              const headRes = await fetch(afterUrl, { method: "HEAD" });
              if (headRes.ok) {
                result.after = afterStr;
              }
            } catch (err) {
              // Continue checking other dates
            }
          }

          // Early exit once we have both dates
          if (result.before && result.after) return;
        }
      };

      await quickCheck(30);
      // Phase 2: Broader search if quick check didn't find enough dates
      if (!result.before || !result.after) {
        // Priority order: current year first, then nearby years
        const years = [2023, 2022, 2024, 2021, 2025, 2026];

        for (const year of years) {
          if (result.before && result.after) break;

          // Search all months for comprehensive coverage
          const monthsToCheck = Array.from({ length: 12 }, (_, i) => i);

          for (const month of monthsToCheck) {
            if (result.before && result.after) break;

            // Sample key days in each month to balance thoroughness with performance
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const daysToCheck = [1, 15, daysInMonth];

            for (const day of daysToCheck) {
              const testDate = new Date(year, month, day);
              const testStr = testDate.toISOString().slice(0, 10);

              if (testStr === currentDateStr) continue;

              try {
                const safeName = speciesName.replace(/ /g, "_");
                const testUrl = `http://localhost:8000/static/${safeName}_${testStr}.png`;
                const headRes = await fetch(testUrl, { method: "HEAD" });

                if (headRes.ok) {
                  if (testDate < current && !result.before) {
                    result.before = testStr;
                  } else if (testDate > current && !result.after) {
                    result.after = testStr;
                  }
                }
              } catch (err) {
                // Continue searching
              }

              if (result.before && result.after) break;
            }
          }
        }
      }

      return result;
    };    /**
     * Display user-friendly error message with actionable suggestions
     * 
     * When data isn't available for the selected date, we don't just show an error -
     * we proactively find nearby dates with data and offer clickable suggestions.
     * This dramatically improves the user experience for exploring sparse datasets.
     */
    const showErrorMessage = async (message: string) => {
      if (containerRef.current) {
        const container = d3.select(containerRef.current);
        container.selectAll("*").remove();

        const nearbyDates = await findNearbyValidDates(currentDate, scientificName);

        let suggestionHtml = '';
        if (nearbyDates.before || nearbyDates.after) {
          suggestionHtml = '<div class="mt-3 pt-2 border-t border-slate-600">';
          suggestionHtml += '<p class="text-slate-500 text-xs mb-2">Try these alternate dates:</p>';

          if (nearbyDates.before) {
            const beforeDate = new Date(nearbyDates.before);
            const beforeFormatted = beforeDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            suggestionHtml += `<button class="text-blue-400 hover:text-blue-300 text-xs underline mr-3 cursor-pointer" onclick="window.selectDate('${nearbyDates.before}')">← ${beforeFormatted}</button>`;
          }

          if (nearbyDates.after) {
            const afterDate = new Date(nearbyDates.after);
            const afterFormatted = afterDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            suggestionHtml += `<button class="text-blue-400 hover:text-blue-300 text-xs underline cursor-pointer" onclick="window.selectDate('${nearbyDates.after}')">${afterFormatted} →</button>`;
          }

          suggestionHtml += '</div>';
        }

        container.append("div")
          .attr("class", "flex items-center justify-center h-full")
          .append("div")
          .attr("class", "text-center p-4")
          .html(`
            <div class="text-slate-400 text-sm mb-2">
              <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <p class="text-slate-400 text-xs">${message}</p>
            ${suggestionHtml}
          `);
      }
    };

    const showLoadingMessage = () => {
      if (containerRef.current) {
        const container = d3.select(containerRef.current);
        container.selectAll("*").remove();

        container.append("div")
          .attr("class", "flex items-center justify-center h-full")
          .append("div")
          .attr("class", "text-center p-4")
          .html(`
            <div class="text-slate-400 text-sm mb-2">
              <svg class="w-6 h-6 mx-auto mb-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p class="text-slate-400 text-xs">Loading heatmap...</p>
          `);
      }
    };    /**
     * Two-tier loading strategy: cached images first, then generate on demand
     * 
     * We prioritize speed by checking for pre-generated static images first.
     * If none exists, we fall back to the API to generate a new heatmap.
     * This hybrid approach balances performance with data completeness.
     */
    const checkAndRender = async () => {
      console.log(`Loading heatmap for ${currentDate} - ${scientificName}`);

      // Delayed loading indicator prevents flicker on fast cached responses
      loadingTimeout = setTimeout(() => {
        if (!cancelled) {
          showLoadingMessage();
        }
      }, 100);

      try {
        const headRes = await fetch(staticImageUrl, { method: "HEAD" });

        if (cancelled) {
          if (loadingTimeout) clearTimeout(loadingTimeout);
          return;
        }

        if (loadingTimeout) clearTimeout(loadingTimeout);

        if (headRes.ok) {
          console.log("Using cached static image");
          renderImage(staticImageUrl);
        } else {
          console.log("Static image not found, generating new heatmap");
          const apiRes = await fetch(`http://localhost:8000/heatmap?date=${currentDate}&species=${scientificName}`);

          console.log(`API response status: ${apiRes.status}`);

          // Provide specific error messages based on API response codes
          if (!apiRes.ok) {
            if (apiRes.status === 404) {
              showErrorMessage("No occurrence data for selected date");
            } else if (apiRes.status === 500) {
              showErrorMessage("No PRISM climate data for selected date");
            } else {
              showErrorMessage("Unable to load heatmap data");
            }
            return;
          }

          const data = await apiRes.json();
          console.log("API response data:", data);

          if (!data?.url) {
            showErrorMessage("No occurrence data for selected date");
            return;
          }

          const fallbackUrl = `http://localhost:8000${data.url}`;
          console.log("Testing generated image at:", fallbackUrl);

          // Verify the generated image actually exists before trying to display it
          const imageTest = await fetch(fallbackUrl, { method: "HEAD" });
          if (!imageTest.ok) {
            console.log("Generated image test failed");
            showErrorMessage("No occurrence data for selected date");
            return;
          }

          console.log("Rendering generated image");
          renderImage(fallbackUrl);
        }
      } catch (err) {
        if (loadingTimeout) clearTimeout(loadingTimeout);
        if (!cancelled) {
          console.error("Error checking or rendering heatmap:", err);
          showErrorMessage("Missing data for selected date");
        }
      }
    };    /**
     * Render heatmap image with responsive scaling and zoom functionality
     * 
     * This function handles the complex task of displaying heatmap images within
     * a responsive container while maintaining aspect ratio and enabling smooth
     * pan/zoom interactions. The 800x400 aspect ratio matches our server-generated
     * heatmaps covering the continental US region.
     */
    const renderImage = (url: string) => {
      // Clear any error messages from previous failed attempts
      if (containerRef.current) {
        const container = d3.select(containerRef.current);
        container.selectAll("div").remove();
      }

      const svgElement = svgRef.current;
      if (!svgElement) return;

      // Clean slate approach - remove old content and zoom handlers
      svg.selectAll("*").remove();
      svg.on(".zoom", null);

      // Get current container dimensions for responsive sizing
      const rect = svgElement.getBoundingClientRect();
      const containerWidth = rect.width;
      const containerHeight = rect.height;

      // Set up SVG coordinate system to match container
      svg.attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const g = svg.append("g");

      const imageAspectRatio = 800 / 400;
      const containerAspectRatio = containerWidth / containerHeight;

      let scaledWidth, scaledHeight, offsetX, offsetY;

      // Letterbox or pillarbox the image depending on container shape
      if (containerAspectRatio > imageAspectRatio) {
        // Container is wider than image - add side padding
        scaledHeight = containerHeight;
        scaledWidth = scaledHeight * imageAspectRatio;
        offsetX = (containerWidth - scaledWidth) / 2;
        offsetY = 0;
      } else {
        // Container is taller than image - add top/bottom padding
        scaledWidth = containerWidth;
        scaledHeight = scaledWidth / imageAspectRatio;
        offsetX = 0;
        offsetY = (containerHeight - scaledHeight) / 2;
      }

      /**
       * Use foreignObject to embed HTML img element in SVG
       * 
       * This approach gives us better image rendering and error handling
       * compared to SVG's native image element, while still allowing
       * the image to participate in SVG transforms for zooming.
       */
      g.append("foreignObject")
        .attr("x", offsetX)
        .attr("y", offsetY)
        .attr("width", scaledWidth)
        .attr("height", scaledHeight)
        .append("xhtml:img")
        .attr("src", url)
        .style("width", "100%")
        .style("height", "100%")
        .style("object-fit", "contain")
        .on("error", () => {
          showErrorMessage("Failed to load heatmap image");
        });

      /**
       * Zoom and pan interaction setup
       * 
       * We limit zoom to 12x to prevent pixelation while still allowing
       * detailed inspection of hotspot regions. All zoom transforms are
       * applied to the group containing the image, keeping the math simple.
       */
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 12])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        });

      svg.call(zoom);
    };    // Start the loading and rendering process
    checkAndRender();

    /**
     * Cleanup function to prevent memory leaks and race conditions
     * 
     * When the component unmounts or dependencies change, we need to
     * cancel any pending operations to avoid updating a stale component.
     * This prevents common React warnings about setting state on unmounted components.
     */
    return () => {
      cancelled = true;
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      // Remove zoom handlers to prevent memory leaks
      svg.on(".zoom", null);
    };
  }, [currentDate, selectedSpecies, scientificNames]);

  /**
   * Simple container structure with responsive sizing
   * 
   * We use a relative container to enable absolute positioning of loading/error
   * messages, while the SVG fills the entire available space for the heatmap.
   */
  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  );
}
