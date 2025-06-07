"""
Heatmap Generation Module for Bird Migration Visualization

This module creates temperature-overlay heatmaps showing bird observations on specific dates.
It combines PRISM climate data (temperature rasters) with bird occurrence coordinates to
produce visualizations that help users understand the relationship between bird sightings
and environmental conditions.

The module uses an optimization strategy where it generates the requested image immediately,
then spawns a background thread to pre-generate the rest of the month's images. This
approach provides fast response times for the initial request while building a cache
for subsequent requests within the same month.
"""

import os
import threading

import matplotlib
# Force matplotlib to use non-interactive backend to prevent GUI issues on servers
matplotlib.use('Agg')

import matplotlib.pyplot as plt
import numpy as np
import rasterio
from pymongo import MongoClient
from datetime import datetime, timedelta
from matplotlib.colors import ListedColormap, BoundaryNorm
import matplotlib.patches as mpatches

def generate_and_save_heatmap(date_str: str, species: str) -> str:
    """
    Main entry point for heatmap generation with intelligent caching strategy.
    
    This function implements a two-stage approach: generate the requested image
    immediately for fast user response, then kick off background generation of
    the entire month's worth of images. This way users get instant feedback
    while we build up a cache for smooth browsing within the same month.
    
    Args:
        date_str: Date in YYYY-MM-DD format
        species: Scientific name of the bird species
        
    Returns:
        Path to the generated heatmap image file
    """
    # Generate the specific requested image first for immediate response
    output_path = _generate_if_missing(date_str, species)

    # Start background task to pre-generate remaining month images for smooth browsing
    threading.Thread(target=_pre_generate_month_images, args=(date_str, species), daemon=True).start()

    return output_path

def _generate_if_missing(date_str: str, species: str) -> str:
    """
    Core heatmap generation function that creates temperature-overlay visualization.
    
    This function combines PRISM temperature raster data with bird observation coordinates
    to create a heatmap. It only generates new images if they don't already exist,
    implementing a simple file-based caching mechanism.
    
    The visualization shows temperature as a color-coded background with bird observations
    as yellow scatter points overlaid on top. This helps reveal correlations between
    bird presence and environmental temperature conditions.
    """
    # Parse date and create date range for MongoDB query (full day range)
    DATE = datetime.strptime(date_str, "%Y-%m-%d")
    NEXT_DATE = DATE + timedelta(days=1)

    # Set up file paths for PRISM climate data and output image
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    BIL_FOLDER = os.path.join(SCRIPT_DIR, "data/PRISM")
    BIL_FILENAME = f"{date_str}.bil"
    BIL_FILE = os.path.join(BIL_FOLDER, BIL_FILENAME)

    static_dir = os.path.join(SCRIPT_DIR, "static")
    os.makedirs(static_dir, exist_ok=True)
    safe_species_name = species.replace(" ", "_")
    output_file = os.path.join(static_dir, f"{safe_species_name}_{date_str}.png")

    # Check if image already exists to avoid redundant computation
    if os.path.exists(output_file):
        return output_file

    # Connect to MongoDB to fetch bird observation coordinates
    client = MongoClient("mongodb://localhost:27017")
    db = client.bird_tracking
    collection = db.species_occurrences

    # Query for observations within the target date range
    query = {
        "scientific_name": species,
        "date": {
            "$gte": DATE,
            "$lt": NEXT_DATE
        }
    }

    print(f"Querying MongoDB for {species} observations on {date_str}")
    count = collection.count_documents(query)
    print(f"Found {count} occurrences for '{species}' on {date_str}")

    # Return empty string if no data exists rather than creating empty visualization
    if count == 0:
        print("No observation data found for the given species/date combination.")
        return ""

    # Extract latitude and longitude coordinates for scatter plot overlay
    results = list(collection.find(query, {"latitude": 1, "longitude": 1}))
    lats = [doc["latitude"] for doc in results]
    lons = [doc["longitude"] for doc in results]    # Load PRISM temperature raster data for the specified date
    with rasterio.open(BIL_FILE) as src:
        temp_data = src.read(1)
        nodata = src.nodata
        bounds = src.bounds

    # Handle missing data values and convert from Celsius to Fahrenheit
    # PRISM data comes in Celsius, but Fahrenheit is more intuitive for US-based visualization
    masked_temp = np.ma.masked_equal(temp_data, nodata) if nodata is not None else temp_data
    temp_f = (masked_temp * 9 / 5) + 32

    # Define temperature ranges and corresponding colors for the heatmap
    # These ranges are designed to highlight meaningful temperature differences for bird ecology
    temp_bounds = [
        0, 3, 7, 10, 14, 18, 21, 25, 28, 32, 36, 39, 43,
        46, 50, 54, 57, 61, 64, 68, 72, 75, 79, 82, 86, 90, 150
    ]

    # Color scheme transitions from cool blues (cold) through purples to warm reds (hot)
    temp_colors = [
        "#f0f8ff", "#dceeff", "#c6e0ff", "#add3ff", "#94c6ff", "#7bb9ff", "#62acff",
        "#499fff", "#308fff", "#2271d1", "#175ab1", "#0e4491", "#073072", "#021d52",
        "#47106b", "#6a1b9a", "#8e24aa", "#ab47bc", "#ba68c8", "#ce93d8", "#e1bee7",
        "#f48fb1", "#f06292", "#ec407a", "#e91e63", "#c2185b", "#880e4f"
    ]

    # Temperature range labels for the legend
    temp_labels = [
        "< 0", "0 - 3", "3 - 7", "7 - 10", "10 - 14", "14 - 18", "18 - 21",
        "21 - 25", "25 - 28", "28 - 32", "32 - 36", "36 - 39", "39 - 43", "43 - 46",
        "46 - 50", "50 - 54", "54 - 57", "57 - 61", "61 - 64", "64 - 68", "68 - 72",
        "72 - 75", "75 - 79", "79 - 82", "82 - 86", "86 - 90", "> 90"
    ]

    # Create matplotlib colormap with discrete temperature boundaries
    cmap = ListedColormap(temp_colors)
    norm = BoundaryNorm(temp_bounds, len(temp_colors))    # Create the visualization with temperature background and bird observation overlay
    fig, ax = plt.subplots(figsize=(10, 8))
    
    # Display temperature raster as background using the geographic bounds from PRISM data
    ax.imshow(temp_f, cmap=cmap, norm=norm,
              extent=[bounds.left, bounds.right, bounds.bottom, bounds.top])
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")

    # Overlay bird observations as bright yellow points with black edges for visibility
    # Small point size (s=6) prevents overcrowding while maintaining visibility
    if lats and lons:
        ax.scatter(lons, lats, s=6, c="#ffff00", edgecolors="black", linewidths=0.2, alpha=0.95)

    # Create comprehensive legend showing temperature ranges
    # Multi-column layout (ncol=4) keeps legend compact while remaining readable
    legend_patches = [mpatches.Patch(color=c, label=l) for c, l in zip(temp_colors, temp_labels)]
    ax.legend(
        handles=legend_patches,
        title="Temperature (°F)",
        loc="lower left",
        ncol=4,
        fontsize=6,
        title_fontsize=9,
        frameon=True,
        fancybox=True,
        borderpad=0.5,
        handlelength=1.2
    )

    # Adjust layout to maximize data area while keeping legend visible
    fig.subplots_adjust(left=0.04, right=0.98, top=0.97, bottom=0.06)

    # Save high-resolution image for detailed analysis
    plt.savefig(output_file, dpi=300, bbox_inches='tight', pad_inches=0.05)
    plt.close()

    print(f"Heatmap visualization saved to {output_file}")
    return output_file

def _pre_generate_month_images(date_str: str, species: str):
    """
    Background task that pre-generates heatmaps for an entire month.
    
    This function runs in a separate thread to build up a cache of images
    for the month containing the requested date. Users often browse through
    consecutive days, so having these images pre-generated significantly
    improves the browsing experience.
    
    The function calculates the number of days in the month dynamically
    to handle varying month lengths and leap years correctly.
    """
    try:
        base_date = datetime.strptime(date_str, "%Y-%m-%d")
        year, month = base_date.year, base_date.month
        first_day = datetime(year, month, 1)
        
        # Calculate last day of month by finding first day of next month
        if month == 12:
            next_month = datetime(year + 1, 1, 1)
        else:
            next_month = datetime(year, month + 1, 1)
        num_days = (next_month - first_day).days

        # Generate heatmap for each day in the month
        for day in range(1, num_days + 1):
            d = datetime(year, month, day).strftime("%Y-%m-%d")
            _generate_if_missing(d, species)

    except Exception as e:
        print(f"Error during background month image generation: {e}")