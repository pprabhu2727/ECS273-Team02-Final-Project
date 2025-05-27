import asyncio
import aiohttp
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import time

GBIF_API = "https://api.gbif.org/v1"


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

# MongoDB connection with optimizations
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client.bird_tracking

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
    """Process and format occurrence data for MongoDB - optimized version"""
    records = []
    
    for occurrence in occurrences_data.get('results', []):
        # Skip if missing essential data
        if not all(key in occurrence for key in ['eventDate', 'decimalLatitude', 'decimalLongitude']):
            continue
            
        # Optimized date parsing
        event_date = occurrence['eventDate']
        try:
            if 'T' in event_date:
                # Remove microseconds if present and handle timezone
                if '.' in event_date:
                    event_date = event_date.split('.')[0] + 'Z'
                sighting_date = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
            else:
                sighting_date = datetime.strptime(event_date, '%Y-%m-%d')
        except (ValueError, TypeError):
            continue  # Skip invalid dates
        
        # Use dictionary comprehension for better performance
        record = {
            "date": sighting_date,
            "latitude": float(occurrence['decimalLatitude']),
            "longitude": float(occurrence['decimalLongitude']),
            "count": occurrence.get('individualCount', 1),
            "species": occurrence.get('species', ''),
            "scientificName": occurrence.get('scientificName', ''),
            "basisOfRecord": occurrence.get('basisOfRecord', ''),
            "countryCode": occurrence.get('countryCode', '')
        }
        records.append(record)
    
    return records

async def insert_to_mongodb_bulk(records, batch_size=1000):
    """Bulk insert records into MongoDB with larger batches"""
    if not records:
        return 0
        
    collection = db.species_occurrences
    
    # Process in larger batches for better performance
    total_inserted = 0
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            result = await collection.insert_many(batch, ordered=False)
            total_inserted += len(result.inserted_ids)
            print(f"✓ Inserted batch of {len(result.inserted_ids)} records")
        except Exception as e:
            print(f"Error inserting batch: {e}")
    
    return total_inserted

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
            all_records = await fetch_concurrent_batches(session, scientific_name)
            
            # Bulk insert all records
            if all_records:
                total_inserted = await insert_to_mongodb_bulk(all_records, batch_size=2000)
                
                species_end_time = time.time()
                species_duration = species_end_time - species_start_time
                
                print(f"🎉 Completed {scientific_name}:")
                print(f"   📊 {total_inserted} total records inserted")
                print(f"   ⏱️  Time taken: {species_duration:.2f} seconds")
                print(f"   🚀 Rate: {total_inserted/species_duration:.1f} records/second")
            else:
                print(f"❌ No records found for {scientific_name}")
            
            print("-" * 50)
    
    total_time = time.time() - start_time
    print(f"🏁 Total execution time: {total_time:.2f} seconds")

if __name__ == "__main__":
    asyncio.run(main())