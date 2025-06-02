import os
import re
from datetime import datetime

# Folder containing the files
folder_path = "./server/2025"

# Regex pattern to extract date from filename
pattern = re.compile(r'_(\d{8})_bil')

# Allowed extensions
allowed_extensions = {'.bil', '.hdr', '.prj'}

for filename in os.listdir(folder_path):
    ext = os.path.splitext(filename)[1].lower()
    file_path = os.path.join(folder_path, filename)

    if ext not in allowed_extensions:
        # Delete unwanted file
        try:
            os.remove(file_path)
            print(f"❌ Deleted: {filename}")
        except Exception as e:
            print(f"⚠️ Failed to delete {filename}: {e}")
        continue

    # Rename valid files
    match = pattern.search(filename)
    if match:
        date_str = match.group(1)
        try:
            formatted_date = datetime.strptime(date_str, "%Y%m%d").strftime("%Y-%m-%d")
            new_name = f"{formatted_date}{ext}"
            dst = os.path.join(folder_path, new_name)
            os.rename(file_path, dst)
            print(f"✅ Renamed: {filename} → {new_name}")
        except ValueError:
            print(f"⚠️ Invalid date format in file: {filename}")
