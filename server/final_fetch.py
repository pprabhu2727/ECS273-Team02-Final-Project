import asyncio
import aiohttp
from datetime import datetime, timedelta
import time
from typing import List
import pandas as pd
import os

GBIF_API = "https://api.gbif.org/v1"

scientific_names = [
    "Turdus migratorius",
    "Cardinalis cardinalis",
    "Cyanocitta cristata",
    "Zenaida macroura",
    "Dryobates pubescens",
    "Haemorhous mexicanus",
    "Thryothorus ludovicianus",
    "Poecile atricapillus",
    "Melanerpes carolinus",
    "Sialia sialis"
]

class OccurrencePoint:
    def __init__(self, date, latitude, longitude, count):
        self.date = date
        self.latitude = latitude
        self.longitude = longitude
        self.count = count
        self.temperature = 0.0
        self.precipitation = 0.0

    def to_dict(self):
        return {
            "date": self.date,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "count": self.count,
            "temperature": self.temperature,
            "precipitation": self.precipitation,
        }

def save_occurrences_to_csv(scientific_name: str, all_occurrences: List[OccurrencePoint]):
    os.makedirs("csv_output", exist_ok=True)
    df = pd.DataFrame([occ.to_dict() for occ in all_occurrences])
    safe_name = scientific_name.replace(" ", "_")
    file_path = f"csv_output/{safe_name}.csv"
    if os.path.exists(file_path):
        df.to_csv(file_path, mode='a', header=False, index=False)
    else:
        df.to_csv(file_path, index=False)
    print(f"📁 Saved CSV: {file_path}")

async def fetch_gbif_occurrences(session, scientific_name, date: str, limit=300, offset=0):
    url = f"{GBIF_API}/occurrence/search"
    params = {
        'scientificName': scientific_name,
        'hasCoordinate': 'true',
        'hasGeospatialIssue': 'false',
        'country': 'US',
        'limit': limit,
        'offset': offset,
        'eventDate': f'{date},{date}'
    }
    try:
        async with session.get(url, params=params) as response:
            if response.status == 200:
                return await response.json()
            elif response.status == 429:
                await asyncio.sleep(2)
                return await fetch_gbif_occurrences(session, scientific_name, date, limit, offset)
            else:
                print(f"Error: {response.status}")
                return None
    except asyncio.TimeoutError:
        print(f"⏰ Timeout when fetching {scientific_name} on {date} offset={offset}")
        return None

async def process_occurrences(occurrences_data):
    occurrence_points = []
    for occurrence in occurrences_data.get('results', []):
        if not all(key in occurrence for key in ['eventDate', 'decimalLatitude', 'decimalLongitude']):
            continue
        try:
            event_date = occurrence['eventDate']
            if 'T' in event_date:
                if '.' in event_date:
                    event_date = event_date.split('.')[0] + 'Z'
                sighting_date = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
            else:
                sighting_date = datetime.strptime(event_date, '%Y-%m-%d')
            date_str = sighting_date.isoformat()
        except Exception:
            continue
        occurrence_points.append(OccurrencePoint(
            date=date_str,
            latitude=float(occurrence['decimalLatitude']),
            longitude=float(occurrence['decimalLongitude']),
            count=occurrence.get('individualCount', 1)
        ))
    return occurrence_points

async def fetch_batches(session, scientific_name):
    limit = 300
    total_fetched = 0

    # Fetch all days in January 2023
    start_date = datetime(2024, 1, 1)
    end_date = datetime(2025, 1, 1)
    current = start_date
    while current < end_date:
        current_date = current.date().isoformat()
        offset = 0
        daily_occurrences = []

        while True:
            print(f"Fetching {scientific_name} on {current_date} - offset {offset}")
            data = await fetch_gbif_occurrences(session, scientific_name, current_date, limit, offset)
            if not data or not data.get("results"):
                break
            occurrences = await process_occurrences(data)
            if not occurrences:
                break
            daily_occurrences.extend(occurrences)
            total_fetched += len(occurrences)
            offset += limit
            await asyncio.sleep(1)

        print(f"📅 {current_date} ➜ {len(daily_occurrences)} occurrences")
        save_occurrences_to_csv(scientific_name, daily_occurrences)

        print(f"✅ Done with {scientific_name}: Total fetched {total_fetched}")
        current += timedelta(days=1)

async def main():
    connector = aiohttp.TCPConnector(limit=10)
    timeout = aiohttp.ClientTimeout(total=120, connect=20, sock_read=100)
    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        for name in scientific_names:
            await fetch_batches(session, name)

if __name__ == "__main__":
    asyncio.run(main())
