import os
import pandas as pd
import re

# === Root data folder containing year subfolders ===
ROOT_FOLDER = "./server/data"

# === Constants ===
LAT_MIN, LAT_MAX = 20.5, 50.4
LON_MIN, LON_MAX = -127, -65.9
DATE_REGEX = re.compile(r'^(\d{4}-\d{2}-\d{2})')

# === Walk through all CSV files in both subfolders ===
for year_folder in ["2023", "2024"]:
    folder_path = os.path.join(ROOT_FOLDER, year_folder)

    for root, _, files in os.walk(folder_path):
        for filename in files:
            if not filename.endswith(".csv"):
                continue

            filepath = os.path.join(root, filename)
            print(f"🔄 Processing: {filepath}")

            try:
                df = pd.read_csv(filepath)

                # Clean the 'date' column
                if "date" in df.columns:
                    df["date"] = df["date"].astype(str).apply(
                        lambda x: DATE_REGEX.match(x).group(1) if DATE_REGEX.match(x) else x
                    )
                else:
                    print(f"⚠️ 'date' column not found in {filename}")

                # Drop temperature and precipitation if present
                for col in ["temperature", "precipitation"]:
                    if col in df.columns:
                        df.drop(columns=col, inplace=True)
                        print(f"🧺 Dropped column: {col}")

                # Filter by lat/lon
                if {"latitude", "longitude"}.issubset(df.columns):
                    df = df[
                        df["latitude"].between(LAT_MIN, LAT_MAX) &
                        df["longitude"].between(LON_MIN, LON_MAX)
                    ]
                else:
                    print(f"⚠️ Skipping lat/lon filter for {filename}")

                # Save cleaned file
                df.to_csv(filepath, index=False)
                print(f"✅ Saved cleaned file with {len(df)} rows\n")

            except Exception as e:
                print(f"❌ Error processing {filename}: {e}")
