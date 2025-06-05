"""
PRISM Climate Data File Cleanup Script

This script processes PRISM climate data files to standardize their naming convention
and remove unnecessary files. PRISM data comes with complex filenames that include
metadata, but we need clean date-based names for our heatmap generation system.

The script keeps only the essential file types (.bil, .hdr, .prj) that are needed
for raster processing and renames them to a YYYY-MM-DD format that matches our
database date formatting.
"""

import os
import re
from datetime import datetime

# Directory containing the downloaded PRISM climate data files
folder_path = "./server/2025"

# Pattern to extract the 8-digit date (YYYYMMDD) from PRISM filenames
# PRISM files typically have names like "PRISM_tmean_stable_4kmD2_20250101_bil.bil"
pattern = re.compile(r'_(\d{8})_bil')

# File extensions required for raster data processing
# .bil = binary raster data, .hdr = header with spatial info, .prj = projection data
allowed_extensions = {'.bil', '.hdr', '.prj'}

for filename in os.listdir(folder_path):
    ext = os.path.splitext(filename)[1].lower()
    file_path = os.path.join(folder_path, filename)

    if ext not in allowed_extensions:
        # Remove auxiliary files that aren't needed for raster processing
        # PRISM downloads often include .xml metadata and .txt files we don't use
        try:
            os.remove(file_path)
            print(f"Deleted unnecessary file: {filename}")
        except Exception as e:
            print(f"Failed to delete {filename}: {e}")
        continue

    # Standardize naming for files we need to keep
    match = pattern.search(filename)
    if match:
        date_str = match.group(1)
        try:
            # Convert from YYYYMMDD to YYYY-MM-DD to match our database date format
            # This consistency is crucial for the heatmap generation system
            formatted_date = datetime.strptime(date_str, "%Y%m%d").strftime("%Y-%m-%d")
            new_name = f"{formatted_date}{ext}"
            dst = os.path.join(folder_path, new_name)
            os.rename(file_path, dst)
            print(f"Renamed: {filename} → {new_name}")
        except ValueError:
            print(f"Invalid date format in filename: {filename}")
    else:
        print(f"Could not extract date from filename: {filename}")
