import os
import threading

import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend

import matplotlib.pyplot as plt
import numpy as np
import rasterio
from pymongo import MongoClient
from datetime import datetime, timedelta
from matplotlib.colors import ListedColormap, BoundaryNorm
import matplotlib.patches as mpatches

def generate_and_save_heatmap(date_str: str, species: str) -> str:
    # Step 1: generate the requested image first
    output_path = _generate_if_missing(date_str, species)

    # Step 2: in background, pre-generate rest of the month
    threading.Thread(target=_pre_generate_month_images, args=(date_str, species), daemon=True).start()

    return output_path

def _generate_if_missing(date_str: str, species: str) -> str:
    DATE = datetime.strptime(date_str, "%Y-%m-%d")
    NEXT_DATE = DATE + timedelta(days=1)

    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    BIL_FOLDER = os.path.join(SCRIPT_DIR, "data/PRISM")
    BIL_FILENAME = f"{date_str}.bil"
    BIL_FILE = os.path.join(BIL_FOLDER, BIL_FILENAME)

    static_dir = os.path.join(SCRIPT_DIR, "static")
    os.makedirs(static_dir, exist_ok=True)
    safe_species_name = species.replace(" ", "_")
    output_file = os.path.join(static_dir, f"{safe_species_name}_{date_str}.png")

    # ✅ Skip if already generated
    if os.path.exists(output_file):
        return output_file

    # MongoDB connection
    client = MongoClient("mongodb://localhost:27017")
    db = client.bird_tracking
    collection = db.species_occurrences

    query = {
        "scientific_name": species,
        "date": {
            "$gte": DATE,
            "$lt": NEXT_DATE
        }
    }

    print("🔍 Querying MongoDB with:", query)
    count = collection.count_documents(query)
    print(f"✅ Found {count} occurrences for '{species}' on {date_str}")

    if count == 0:
        print("⚠️ No data found for given species/date.")
        return ""

    results = list(collection.find(query, {"latitude": 1, "longitude": 1}))
    lats = [doc["latitude"] for doc in results]
    lons = [doc["longitude"] for doc in results]

    # Load PRISM raster data
    with rasterio.open(BIL_FILE) as src:
        temp_data = src.read(1)
        nodata = src.nodata
        bounds = src.bounds

    masked_temp = np.ma.masked_equal(temp_data, nodata) if nodata is not None else temp_data
    temp_f = (masked_temp * 9 / 5) + 32

    temp_bounds = [
        0, 3, 7, 10, 14, 18, 21, 25, 28, 32, 36, 39, 43,
        46, 50, 54, 57, 61, 64, 68, 72, 75, 79, 82, 86, 90, 150
    ]

    temp_colors = [
        "#f0f8ff", "#dceeff", "#c6e0ff", "#add3ff", "#94c6ff", "#7bb9ff", "#62acff",
        "#499fff", "#308fff", "#2271d1", "#175ab1", "#0e4491", "#073072", "#021d52",
        "#47106b", "#6a1b9a", "#8e24aa", "#ab47bc", "#ba68c8", "#ce93d8", "#e1bee7",
        "#f48fb1", "#f06292", "#ec407a", "#e91e63", "#c2185b", "#880e4f"
    ]

    temp_labels = [
        "< 0", "0 - 3", "3 - 7", "7 - 10", "10 - 14", "14 - 18", "18 - 21",
        "21 - 25", "25 - 28", "28 - 32", "32 - 36", "36 - 39", "39 - 43", "43 - 46",
        "46 - 50", "50 - 54", "54 - 57", "57 - 61", "61 - 64", "64 - 68", "68 - 72",
        "72 - 75", "75 - 79", "79 - 82", "82 - 86", "86 - 90", "> 90"
    ]

    cmap = ListedColormap(temp_colors)
    norm = BoundaryNorm(temp_bounds, len(temp_colors))

    # Plotting
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.imshow(temp_f, cmap=cmap, norm=norm,
              extent=[bounds.left, bounds.right, bounds.bottom, bounds.top])
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")

    if lats and lons:
        ax.scatter(lons, lats, s=6, c="#ffff00", edgecolors="black", linewidths=0.2, alpha=0.95)

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

    fig.subplots_adjust(left=0.04, right=0.98, top=0.97, bottom=0.06)

    plt.savefig(output_file, dpi=300, bbox_inches='tight', pad_inches=0.05)
    plt.close()

    print(f"🖼️ Heatmap saved to {output_file}")
    return output_file

def _pre_generate_month_images(date_str: str, species: str):
    try:
        base_date = datetime.strptime(date_str, "%Y-%m-%d")
        year, month = base_date.year, base_date.month
        first_day = datetime(year, month, 1)
        # Find last day of the month
        if month == 12:
            next_month = datetime(year + 1, 1, 1)
        else:
            next_month = datetime(year, month + 1, 1)
        num_days = (next_month - first_day).days

        for day in range(1, num_days + 1):
            d = datetime(year, month, day).strftime("%Y-%m-%d")
            _generate_if_missing(d, species)

    except Exception as e:
        print(f"⚠️ Error during month pre-generation: {e}")
