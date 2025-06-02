import os
import re
from datetime import datetime

# Folder containing the files
folder_path = "C:/Users/Guransh/Desktop/ECS 273/ECS273-Team02-Final-Project/server/PRISM_2024"

# Regex pattern to extract date from filename
pattern = re.compile(r'_(\d{8})_bil')

for filename in os.listdir(folder_path):
    match = pattern.search(filename)
    if match:
        date_str = match.group(1)
        try:
            # Convert date to YYYY-MM-DD format
            formatted_date = datetime.strptime(date_str, "%Y%m%d").strftime("%Y-%m-%d")
            ext = os.path.splitext(filename)[1]  # Get file extension
            new_name = f"{formatted_date}{ext}"
            
            # Full paths for renaming
            src = os.path.join(folder_path, filename)
            dst = os.path.join(folder_path, new_name)
            
            # Rename the file
            os.rename(src, dst)
            print(f"Renamed: {filename} → {new_name}")
        except ValueError:
            print(f"Invalid date in file: {filename}")
