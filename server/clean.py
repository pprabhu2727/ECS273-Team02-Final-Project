import os
import pandas as pd
import re

"""
Data cleaning script for bird observation CSV files.

This script processes bird observation data from eBird or similar sources,
standardizing date formats, removing unnecessary weather columns, and 
filtering observations to the continental United States geographic bounds.
"""

# Data directory structure expects year-based subfolders (2023/, 2024/)
ROOT_FOLDER = "./server/data"

# Continental US bounding box coordinates for geographic filtering
# These bounds exclude Alaska, Hawaii, and most territories to focus on
# contiguous US bird migration patterns where our models are most accurate
LAT_MIN, LAT_MAX = 20.5, 50.4  # Roughly from South Texas to Canadian border
LON_MIN, LON_MAX = -127, -65.9  # Pacific to Atlantic coasts

# Regex to extract clean date format (YYYY-MM-DD) from potentially messy timestamp data
# Many data sources include time components or timezone info we don't need for daily analysis
DATE_REGEX = re.compile(r'^(\d{4}-\d{2}-\d{2})')

# Process each year's data separately to maintain chronological organization
# We hardcode 2023/2024 since those are our analysis years with trained models
for year_folder in ["2023", "2024"]:
    folder_path = os.path.join(ROOT_FOLDER, year_folder)

    # Recursively walk through all subdirectories to catch any nested CSV files
    # Some data downloads create species-specific subfolders we need to process
    for root, _, files in os.walk(folder_path):
        for filename in files:
            if not filename.endswith(".csv"):
                continue

            filepath = os.path.join(root, filename)
            print(f"🔄 Processing: {filepath}")

            try:
                df = pd.read_csv(filepath)

                """
                Date column standardization
                
                Raw data often comes with full timestamps like "2023-01-15 08:30:00-05:00"
                but our analysis only needs the date part. This regex extraction ensures
                consistent YYYY-MM-DD format across all datasets.
                """
                if "date" in df.columns:
                    df["date"] = df["date"].astype(str).apply(
                        lambda x: DATE_REGEX.match(x).group(1) if DATE_REGEX.match(x) else x
                    )
                else:
                    print(f"⚠️ 'date' column not found in {filename}")

                """
                Remove weather columns we don't use in our bird prediction models
                
                Temperature and precipitation data is often included in eBird exports
                but adds unnecessary file size. Our neural networks use separate
                climate data sources with better spatial resolution.
                """
                for col in ["temperature", "precipitation"]:
                    if col in df.columns:
                        df.drop(columns=col, inplace=True)
                        print(f"🧺 Dropped column: {col}")

                """
                Geographic filtering to continental United States
                
                This removes observations from Alaska, Hawaii, territories, and 
                clearly erroneous coordinates. Our prediction models were trained
                on continental US data, so filtering here prevents prediction errors
                and reduces file sizes significantly.
                """
                if {"latitude", "longitude"}.issubset(df.columns):
                    df = df[
                        df["latitude"].between(LAT_MIN, LAT_MAX) &
                        df["longitude"].between(LON_MIN, LON_MAX)
                    ]
                else:
                    print(f"⚠️ Skipping lat/lon filter for {filename}")

                # Overwrite the original file with cleaned data to save disk space
                # We keep the same filename to maintain compatibility with existing scripts
                df.to_csv(filepath, index=False)
                print(f"✅ Saved cleaned file with {len(df)} rows\n")

            except Exception as e:
                print(f"❌ Error processing {filename}: {e}")
