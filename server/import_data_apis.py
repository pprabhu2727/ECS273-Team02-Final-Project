import asyncio
import aiohttp
from datetime import datetime

GBIF_API = "https://api.gbif.org/v1"

# Get the GBIF species ID for a name
async def _get_species_id(session, name):
    url = f"{GBIF_API}/species/match"
    params = {'name': name}
    async with session.get(url, params=params) as resp:
        if resp.status != 200:
            return None
        data = await resp.json()
        return data.get('usageKey')

# Fetch sightings for a given species ID
async def _get_occurrences(session, species_id, name):
    url = f"{GBIF_API}/occurrence/search"
    params = {
        'taxonKey': species_id,
        'hasCoordinate': 'true',
        'hasGeospatialIssue': 'false',
        'country': 'US',
        'limit': 300,
        'year': '2010,2024'
    }

    sightings = []
    offset = 0

    while len(sightings) < 1000:
        params['offset'] = offset
        async with session.get(url, params=params) as resp:
            if resp.status != 200:
                break
            data = await resp.json()
            results = data.get('results', [])
            if not results:
                break

            for record in results:
                parsed = _parse_occurrence(record)
                if parsed:
                    sightings.append(parsed)

            if data.get('endOfRecords', True):
                break

            offset += len(results)
            await asyncio.sleep(0.1)

    return sightings

# Parse one sighting record
def _parse_occurrence(record):
    lat = record.get('decimalLatitude')
    lon = record.get('decimalLongitude')
    date_str = record.get('eventDate')

    if not all([lat, lon, date_str]):
        return None

    if 'T' in date_str:
        date = datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
    else:
        date = datetime.strptime(date_str[:10], '%Y-%m-%d').date()

    count = record.get('individualCount') or 1

    return {
        'date': date.isoformat(),
        'latitude': lat,
        'longitude': lon,
        'count': count,
        'gbif_id': record.get('key'),
        'basis_of_record': record.get('basisOfRecord'),
        'country': record.get('country'),
        'state': record.get('stateProvince')
    }

# Fetch ID and sightings for a single species
async def get_species_data(name):
    async with aiohttp.ClientSession() as session:
        species_id = await _get_species_id(session, name)
        if not species_id:
            return None
        sightings = await _get_occurrences(session, species_id, name)
        return {
            'id': species_id,
            'name': name,
            'sightings': sightings
        }

# Fetch data for a list of species
async def get_all_species_data():
    species_list = [
        'Cardinalis cardinalis', 'Turdus migratorius', 'Cyanocitta cristata',
        'Poecile atricapillus', 'Sialia sialis', 'Melanerpes carolinus',
        'Thryothorus ludovicianus', 'Dryobates pubescens', 'Haemorhous mexicanus',
        'Zenaida macroura', 'Corvus brachyrhynchos', 'Ardea herodias',
        'Buteo jamaicensis', 'Picoides villosus', 'Spinus tristis'
    ]

    results = {}

    for i in range(0, len(species_list), 5):
        batch = species_list[i:i + 5]
        tasks = [get_species_data(name) for name in batch]
        responses = await asyncio.gather(*tasks)

        for name, data in zip(batch, responses):
            if data:
                results[name] = data

        await asyncio.sleep(1)

    return results


# i am using llm to help create the loaction fn and help get live weather data
from geopy.geocoders import Nominatim
def get_location(longitude, latitude):
    geolocator = Nominatim(user_agent="geoapiExercises")
    location = geolocator.reverse((latitude, longitude), language='en')
    address = location.raw['address']
    city = address.get('city') or address.get('town') or address.get('village') or ''
    state = address.get('state', '')
    return city, state

import aiohttp
async def get_climate_data(lat, lon, date):
    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        f"&start_date={date}&end_date={date}"
        f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum"
        f"&timezone=UTC"
    )
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status == 200:
                data = await response.json()
                if "daily" in data and "temperature_2m_max" in data["daily"]:
                    temp = (data["daily"]["temperature_2m_max"][0] + data["daily"]["temperature_2m_min"][0]) / 2
                    precip = data["daily"]["precipitation_sum"][0]
                    return {"temperature": round(temp, 1), "precipitation": round(precip, 1)}
    return {"temperature": None, "precipitation": None}
