import asyncio
import aiohttp
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import time
from pydantic import BaseModel
from bson import ObjectId
from typing import List

GBIF_API = "https://api.gbif.org/v1"


# Reminder to choose which "scientific_names" you want loaded
# this code only loads JAN 2023
delete this line, it will throw an error when running. Chose which species 
scientific_names = [
    "Turdus migratorius",
    # "Cardinalis cardinalis",
    # "Cyanocitta cristata",
    # "Zenaida macroura",
    # "Dryobates pubescens",
    # "Haemorhous mexicanus",
    # "Thryothorus ludovicianus",
    # "Poecile atricapillus",
    # "Melanerpes carolinus",
    # "Sialia sialis"
]

# I used llm to help make this code as quick as possible while also avoid crashing/fail bc of hitting rate limit
# MongoDB connection with optimizations
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client.bird_tracking

# Pydantic models matching your structure
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

class OccurrencePoint(BaseModel):
    """
    Model for a single bird occurrence point
    """
    date: str
    latitude: float
    longitude: float
    count: int
    temperature: float  # Temperature data from PRISM - placeholder for now
    precipitation: float  # Precipitation data from PRISM - placeholder for now

class SpeciesOccurrenceModel(BaseModel):
    """
    Model for bird species occurrence data
    """
    _id: PyObjectId
    species: str
    scientific_name: str
    occurrences: List[OccurrencePoint]

async def fetch_gbif_occurrences(session, scientific_name, offset=0, limit=1000):
    """Fetch occurrences from GBIF API with pagination"""
    url = f"{GBIF_API}/occurrence/search"
    params = {
        'scientificName': scientific_name,
        'year': 2023,
        'month': 1,  # January
        'hasCoordinate': 'true',
        'hasGeospatialIssue': 'false',
        'country': 'US',  # United States only
        'limit': limit,
        'offset': offset
    }
    
    # Add retry logic with exponential backoff
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=30)) as response:
                if response.status == 200:
                    return await response.json()
                elif response.status == 429:  # Rate limited
                    wait_time = 2 ** attempt
                    print(f"Rate limited, waiting {wait_time}s...")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    print(f"Error fetching data: {response.status}")
                    return None
        except asyncio.TimeoutError:
            print(f"Timeout on attempt {attempt + 1}")
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue
            return None
    
    return None

async def process_occurrences(occurrences_data):
    """Process and format occurrence data for the new structure"""
    occurrence_points = []
    
    for occurrence in occurrences_data.get('results', []):
        # Skip if missing essential data
        if not all(key in occurrence for key in ['eventDate', 'decimalLatitude', 'decimalLongitude']):
            continue
            
        # Optimized date parsing - convert to string format
        event_date = occurrence['eventDate']
        try:
            if 'T' in event_date:
                # Remove microseconds if present and handle timezone
                if '.' in event_date:
                    event_date = event_date.split('.')[0] + 'Z'
                sighting_date = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
            else:
                sighting_date = datetime.strptime(event_date, '%Y-%m-%d')
            
            # Convert to string for storage
            date_str = sighting_date.isoformat()
        except (ValueError, TypeError):
            continue  # Skip invalid dates
        
        # Create OccurrencePoint
        occurrence_point = OccurrencePoint(
            date=date_str,
            latitude=float(occurrence['decimalLatitude']),
            longitude=float(occurrence['decimalLongitude']),
            count=occurrence.get('individualCount', 1),
            temperature=0.0,  # Placeholder - will be filled by PRISM data later
            precipitation=0.0  # Placeholder - will be filled by PRISM data later
        )
        occurrence_points.append(occurrence_point)
    
    return occurrence_points

async def upsert_species_occurrences(scientific_name, species_name, occurrence_points):
    """Upsert species occurrence data using the new structure"""
    if not occurrence_points:
        return 0
        
    collection = db.species_occurrences
    
    # Check if species already exists
    existing_doc = await collection.find_one({"scientific_name": scientific_name})
    
    if existing_doc:
        # Update existing document by extending occurrences array
        result = await collection.update_one(
            {"scientific_name": scientific_name},
            {
                "$push": {
                    "occurrences": {
                        "$each": [point.dict() for point in occurrence_points]
                    }
                }
            }
        )
        print(f"✓ Updated existing species {scientific_name} with {len(occurrence_points)} new occurrences")
        return len(occurrence_points)
    else:
        # Create new document
        species_doc = SpeciesOccurrenceModel(
            _id=PyObjectId(ObjectId()),
            species=species_name,
            scientific_name=scientific_name,
            occurrences=occurrence_points
        )
        
        result = await collection.insert_one(species_doc.dict())
        print(f"✓ Created new species document for {scientific_name} with {len(occurrence_points)} occurrences")
        return len(occurrence_points)

async def fetch_concurrent_batches(session, scientific_name, max_concurrent=5):
    """Fetch multiple pages concurrently for faster data retrieval"""
    
    # First, get the total count
    initial_data = await fetch_gbif_occurrences(session, scientific_name, 0, 1)
    if not initial_data:
        return []
    
    total_count = initial_data['count']
    limit = 300  # GBIF's max limit
    
    print(f"Total records to fetch for {scientific_name}: {total_count}")
    
    # Calculate all the offset values we need
    offsets = list(range(0, total_count, limit))
    
    # Process offsets in concurrent batches
    all_records = []
    semaphore = asyncio.Semaphore(max_concurrent)  # Limit concurrent requests
    
    async def fetch_single_page(offset):
        async with semaphore:
            print(f"Fetching {scientific_name} - offset: {offset}")
            data = await fetch_gbif_occurrences(session, scientific_name, offset, limit)
            if data and data.get('results'):
                return await process_occurrences(data)
            return []
    
    # Process all pages concurrently in batches
    batch_size = max_concurrent * 2  # Process 2 rounds of concurrent requests at a time
    
    for i in range(0, len(offsets), batch_size):
        batch_offsets = offsets[i:i + batch_size]
        
        # Create tasks for this batch
        tasks = [fetch_single_page(offset) for offset in batch_offsets]
        
        # Wait for all tasks in this batch to complete
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Collect successful results
        for result in batch_results:
            if isinstance(result, list):  # Successful result
                all_records.extend(result)
            elif isinstance(result, Exception):
                print(f"Error in batch: {result}")
        
        # Add a small delay between batches to be respectful to the API
        if i + batch_size < len(offsets):
            await asyncio.sleep(0.5)
    
    return all_records

async def main():
    """Main function with performance monitoring"""
    start_time = time.time()
    
    # Clear the collection first
    print("🗑️  Clearing species_occurrences collection...")
    await db.species_occurrences.delete_many({})
    print("✅ Collection cleared")
    print("-" * 50)
    
    # Configure session with connection pooling
    connector = aiohttp.TCPConnector(
        limit=20,  # Total connection pool size
        limit_per_host=10,  # Max connections per host
        ttl_dns_cache=300,  # DNS cache TTL
        use_dns_cache=True,
    )
    
    timeout = aiohttp.ClientTimeout(total=60, connect=10)
    
    async with aiohttp.ClientSession(
        connector=connector,
        timeout=timeout,
        headers={'User-Agent': 'GBIF-Data-Extractor/1.0'}
    ) as session:
        
        for scientific_name in scientific_names:
            print(f"Processing {scientific_name}...")
            species_start_time = time.time()
            
            # Fetch all occurrences concurrently
            all_occurrence_points = await fetch_concurrent_batches(session, scientific_name)
            
            # Get species common name (you might want to add this logic or hardcode mappings)
            species_name = scientific_name.split()[-1] if scientific_name else "Unknown"
            
            # Upsert species occurrence data in the new structure
            if all_occurrence_points:
                total_inserted = await upsert_species_occurrences(
                    scientific_name, 
                    species_name, 
                    all_occurrence_points
                )
                
                species_end_time = time.time()
                species_duration = species_end_time - species_start_time
                
                print(f"🎉 Completed {scientific_name}:")
                print(f"   📊 {total_inserted} total occurrences processed")
                print(f"   ⏱️  Time taken: {species_duration:.2f} seconds")
                print(f"   🚀 Rate: {total_inserted/species_duration:.1f} occurrences/second")
            else:
                print(f"❌ No occurrences found for {scientific_name}")
            
            print("-" * 50)
    
    total_time = time.time() - start_time
    print(f"🏁 Total execution time: {total_time:.2f} seconds")

if __name__ == "__main__":
    asyncio.run(main())

