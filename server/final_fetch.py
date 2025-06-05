"""
GBIF Data Fetcher for Bird Observation Data

This script downloads bird observation data from the Global Biodiversity Information
Facility (GBIF) API for training our neural network models. It fetches occurrence
records for specific bird species across an entire year, handling rate limiting
and pagination to collect comprehensive datasets.

The async approach is necessary because we're making thousands of API calls
(365 days × multiple offset pages per day × 10 species), which would take
hours if done synchronously.
"""

import asyncio
import aiohttp
from datetime import datetime, timedelta
import time
from typing import List
import pandas as pd
import os

GBIF_API = "https://api.gbif.org/v1"

# Target species for our bird migration prediction models
# These were selected based on abundance in eBird data and ecological significance
scientific_names = [
    "Turdus migratorius",      # American Robin
    "Cardinalis cardinalis",   # Northern Cardinal  
    "Cyanocitta cristata",     # Blue Jay
    "Zenaida macroura",        # Mourning Dove
    "Dryobates pubescens",     # Downy Woodpecker
    "Haemorhous mexicanus",    # House Finch
    "Thryothorus ludovicianus", # Carolina Wren
    "Poecile atricapillus",    # Black-capped Chickadee
    "Melanerpes carolinus",    # Red-bellied Woodpecker
    "Sialia sialis"            # Eastern Bluebird
]


class OccurrencePoint:
    """
    Individual bird observation record from GBIF.
    
    Represents a single sighting with location, date, and count information.
    The temperature and precipitation fields are placeholders for future
    climate data integration, set to zero for now since GBIF doesn't
    provide weather data consistently.
    """
    
    def __init__(self, date, latitude, longitude, count):
        self.date = date
        self.latitude = latitude
        self.longitude = longitude
        self.count = count
        # Weather data placeholders - GBIF doesn't reliably provide this
        # We'll get climate data from PRISM instead in a separate pipeline
        self.temperature = 0.0
        self.precipitation = 0.0

    def to_dict(self):
        """Convert to dictionary for pandas DataFrame creation."""
        return {
            "date": self.date,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "count": self.count,
            "temperature": self.temperature,
            "precipitation": self.precipitation,
        }


def save_occurrences_to_csv(scientific_name: str, all_occurrences: List[OccurrencePoint]):
    """
    Save daily occurrence data to CSV files.
    
    We append to existing files to handle the day-by-day fetching approach.
    This prevents data loss if the script crashes partway through and allows
    for resuming downloads. Files are organized by species for easy processing.
    """
    os.makedirs("csv_output", exist_ok=True)
    df = pd.DataFrame([occ.to_dict() for occ in all_occurrences])
    safe_name = scientific_name.replace(" ", "_")
    file_path = f"csv_output/{safe_name}.csv"
    
    # Append mode prevents overwriting when processing day by day
    if os.path.exists(file_path):
        df.to_csv(file_path, mode='a', header=False, index=False)
    else:
        df.to_csv(file_path, index=False)
    print(f"📁 Saved CSV: {file_path}")

async def fetch_gbif_occurrences(session, scientific_name, date: str, limit=300, offset=0):
    """
    Fetch occurrence records from GBIF API for a specific species and date.
    
    GBIF limits responses to 300 records per request, so we use offset pagination
    to get all observations for high-activity days. The rate limiting handling
    is crucial because GBIF throttles requests to prevent server overload.
    
    Args:
        session: aiohttp session for connection pooling
        scientific_name: Latin species name (e.g., "Turdus migratorius")
        date: ISO date string (e.g., "2024-01-15")
        limit: Max records per request (GBIF max is 300)
        offset: Starting record number for pagination
    """
    url = f"{GBIF_API}/occurrence/search"
    params = {
        'scientificName': scientific_name,
        'hasCoordinate': 'true',           # Only georeferenced observations
        'hasGeospatialIssue': 'false',     # Exclude suspect coordinates
        'country': 'US',                   # Continental US focus
        'limit': limit,
        'offset': offset,
        'eventDate': f'{date},{date}'      # Single day range
    }
    
    try:
        async with session.get(url, params=params) as response:
            if response.status == 200:
                return await response.json()
            elif response.status == 429:
                # Rate limiting - wait and retry with exponential backoff
                await asyncio.sleep(2)
                return await fetch_gbif_occurrences(session, scientific_name, date, limit, offset)
            else:
                print(f"Error: {response.status}")
                return None
    except asyncio.TimeoutError:
        print(f"⏰ Timeout when fetching {scientific_name} on {date} offset={offset}")
        return None


async def process_occurrences(occurrences_data):
    """
    Parse GBIF API response into our OccurrencePoint objects.
    
    GBIF date formats are inconsistent - some include timestamps, others don't.
    We normalize everything to ISO format for consistency with our models.
    Missing coordinate or date data is silently skipped since it's unusable
    for spatial-temporal analysis.
    """
    occurrence_points = []
    for occurrence in occurrences_data.get('results', []):
        # Skip records missing essential spatial-temporal data
        if not all(key in occurrence for key in ['eventDate', 'decimalLatitude', 'decimalLongitude']):
            continue
        
        try:
            event_date = occurrence['eventDate']
            # Handle timestamp formats: "2024-01-15T08:30:00.000Z" vs "2024-01-15"
            if 'T' in event_date:
                # Remove microseconds if present, then parse with timezone
                if '.' in event_date:
                    event_date = event_date.split('.')[0] + 'Z'
                sighting_date = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
            else:
                # Simple date format
                sighting_date = datetime.strptime(event_date, '%Y-%m-%d')
            date_str = sighting_date.isoformat()
        except Exception:
            # Skip malformed dates rather than crash
            continue
            
        occurrence_points.append(OccurrencePoint(
            date=date_str,
            latitude=float(occurrence['decimalLatitude']),
            longitude=float(occurrence['decimalLongitude']),
            count=occurrence.get('individualCount', 1)  # Default to 1 if count missing
        ))
    return occurrence_points

async def fetch_batches(session, scientific_name):
    """
    Download a full year of data for one species, day by day.
    
    We process each day separately because:
    1. Popular species can have 10,000+ observations per day, requiring multiple API calls
    2. Daily processing allows progress monitoring and recovery from interruptions  
    3. Memory usage stays reasonable by not loading entire year at once
    
    The 1-second delay between requests respects GBIF's usage guidelines
    and prevents triggering rate limiting.
    """
    limit = 300  # GBIF maximum records per request
    total_fetched = 0

    # Fetch full year 2024 for model training data
    start_date = datetime(2024, 1, 1)
    end_date = datetime(2025, 1, 1)
    current = start_date
    
    while current < end_date:
        current_date = current.date().isoformat()
        offset = 0
        daily_occurrences = []

        # Pagination loop - some days have thousands of observations
        while True:
            print(f"Fetching {scientific_name} on {current_date} - offset {offset}")
            data = await fetch_gbif_occurrences(session, scientific_name, current_date, limit, offset)
            
            # No more data available for this day
            if not data or not data.get("results"):
                break
                
            occurrences = await process_occurrences(data)
            if not occurrences:
                break
                
            daily_occurrences.extend(occurrences)
            total_fetched += len(occurrences)
            offset += limit
            
            # Respectful delay to avoid overwhelming GBIF servers
            await asyncio.sleep(1)

        print(f"📅 {current_date} ➜ {len(daily_occurrences)} occurrences")
        save_occurrences_to_csv(scientific_name, daily_occurrences)

        current += timedelta(days=1)

    print(f"✅ Done with {scientific_name}: Total fetched {total_fetched}")


async def main():
    """
    Main execution function with optimized HTTP session configuration.
    
    Connection pooling and timeout settings are tuned for GBIF's API characteristics:
    - 10 concurrent connections prevents overwhelming their servers
    - Long timeouts accommodate their sometimes slow response times
    - Sequential species processing ensures we don't hit rate limits
    """
    # HTTP client optimized for long-running API collection
    connector = aiohttp.TCPConnector(limit=10)
    timeout = aiohttp.ClientTimeout(total=120, connect=20, sock_read=100)
    
    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        # Process species sequentially to avoid rate limiting issues
        for name in scientific_names:
            await fetch_batches(session, name)

if __name__ == "__main__":
    asyncio.run(main())
