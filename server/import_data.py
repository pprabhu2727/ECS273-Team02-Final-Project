import os
import pandas as pd
import random
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import numpy as np

# MongoDB connection (localhost, default port)
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client.bird_tracking

# Bird species data
species = [
    "American Robin",
    "Northern Cardinal",
    "Blue Jay",
    "Mourning Dove",
    "Downy Woodpecker",
    "House Finch",
    "Carolina Wren",
    "Black-capped Chickadee",
    "Red-bellied Woodpecker",
    "Eastern Bluebird"
]

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

# US mainland bounds (approximate)
US_LAT_MIN, US_LAT_MAX = 24.0, 49.0
US_LON_MIN, US_LON_MAX = -125.0, -66.0

# Species-specific regions (simplified for sample data)
species_regions = {
    "American Robin": {"lat": (30.0, 48.0), "lon": (-120.0, -70.0)},
    "Northern Cardinal": {"lat": (26.0, 45.0), "lon": (-105.0, -75.0)},
    "Blue Jay": {"lat": (29.0, 47.0), "lon": (-105.0, -70.0)},
    "Mourning Dove": {"lat": (25.0, 46.0), "lon": (-120.0, -70.0)},
    "Downy Woodpecker": {"lat": (30.0, 48.0), "lon": (-120.0, -70.0)},
    "House Finch": {"lat": (25.0, 48.0), "lon": (-123.0, -70.0)},
    "Carolina Wren": {"lat": (26.0, 43.0), "lon": (-100.0, -75.0)},
    "Black-capped Chickadee": {"lat": (37.0, 49.0), "lon": (-125.0, -67.0)},
    "Red-bellied Woodpecker": {"lat": (28.0, 43.0), "lon": (-99.0, -72.0)},
    "Eastern Bluebird": {"lat": (27.0, 45.0), "lon": (-102.0, -70.0)}
}

# Function to generate random occurrence data for a species
def generate_occurrence_data(species_name, num_points=200):
    region = species_regions[species_name]
    start_date = datetime(2020, 1, 1)
    end_date = datetime(2025, 4, 1)
    date_range = (end_date - start_date).days
    
    occurrences = []
    
    for _ in range(num_points):
        # Random date within range
        random_days = random.randint(0, date_range)
        date = start_date + timedelta(days=random_days)
        date_str = date.strftime("%Y-%m-%d")
        
        # Random location within species region
        lat = random.uniform(region["lat"][0], region["lat"][1])
        lon = random.uniform(region["lon"][0], region["lon"][1])
        
        # Random count with seasonal variation
        base_count = random.randint(1, 15)
        month_factor = 1.0 + 0.5 * np.sin((date.month - 3) * np.pi / 6)  # Peak in June
        count = max(1, int(base_count * month_factor))
        
        # Climate data
        base_temp = 10 + 15 * np.sin((date.month - 1) * np.pi / 6)  # Temperature varies by season
        temp_variation = random.uniform(-5, 5)
        temperature = base_temp + temp_variation + (lat - 35) * (-0.5)  # Cooler in the north
        
        precip_base = 50 + 30 * np.sin((date.month - 4) * np.pi / 6)  # Precipitation peaks in July
        precip_variation = random.uniform(-20, 20)
        precipitation = max(0, precip_base + precip_variation)
        
        occurrences.append({
            "date": date_str,
            "latitude": lat,
            "longitude": lon,
            "count": count,
            "temperature": round(temperature, 1),
            "precipitation": round(precipitation, 1)
        })
    
    return sorted(occurrences, key=lambda x: x["date"])

# Function to generate forecast data
def generate_forecast_data(species_name):
    forecasts = []
    
    # Generate historical + future data (2020-2030)
    for year in range(2020, 2031):
        for month in range(1, 13):
            if year > 2025 or (year == 2025 and month > 4):
                # Future forecast data
                is_prediction = True
            else:
                # Historical data
                is_prediction = False
                
            # Base forecast with increasing trend for predictions
            base_count = 100 + (year - 2020) * 5
            
            # Apply seasonal variation
            seasonal_factor = 1.0 + 0.3 * np.sin((month - 3) * np.pi / 6)  # Peak in June
            count_prediction = base_count * seasonal_factor
            
            # Add some noise
            if not is_prediction:
                count_prediction += random.uniform(-10, 10)
            
            # Range shifts (increasing over time for climate change effect)
            time_factor = (year - 2020) / 10  # Normalized time progression
            
            # Different shift patterns for different species
            if species_name in ["American Robin", "Black-capped Chickadee"]:
                # Moving north
                range_north = 0.2 * time_factor
                range_south = 0.1 * time_factor
            elif species_name in ["Northern Cardinal", "Carolina Wren"]:
                # Expanding range
                range_north = 0.3 * time_factor
                range_south = -0.05 * time_factor
            else:
                # General shift
                range_north = 0.15 * time_factor
                range_south = 0.05 * time_factor
                
            # East-west shifts
            range_east = 0.1 * time_factor
            range_west = 0.0
            
            forecasts.append({
                "year": year,
                "month": month,
                "count_prediction": round(count_prediction, 1),
                "range_north": round(range_north, 3),
                "range_south": round(range_south, 3),
                "range_east": round(range_east, 3),
                "range_west": round(range_west, 3)
            })
    
    return forecasts

# Function to generate seasonal data
def generate_seasonal_data(species_name):
    seasonal_data = []
    
    for year in range(2020, 2026):
        for month in range(1, 13):
            if year == 2025 and month > 4:
                continue  # Skip future months in 2025
                
            # Base count with year-over-year increase
            base = 50 + (year - 2020) * 3
            
            # Seasonal variation
            seasonal_factor = 1.0 + 0.7 * np.sin((month - 3) * np.pi / 6)  # Peak in June
            average_count = base * seasonal_factor
            
            # Generate range around average
            std_dev = average_count * 0.2  # 20% standard deviation
            min_count = max(0, average_count - 2 * std_dev)
            max_count = average_count + 2 * std_dev
            q1_count = average_count - 0.7 * std_dev
            median_count = average_count + random.uniform(-0.2, 0.2) * std_dev
            q3_count = average_count + 0.7 * std_dev
            
            seasonal_data.append({
                "year": year,
                "month": month,
                "average_count": round(average_count, 1),
                "median_count": round(median_count, 1),
                "max_count": round(max_count, 1),
                "min_count": round(min_count, 1),
                "q1_count": round(q1_count, 1),
                "q3_count": round(q3_count, 1)
            })
    
    return seasonal_data

# Import all data to MongoDB
async def import_data_to_mongodb():
    # Clear collections first
    await db.species_list.delete_many({})
    await db.species_occurrences.delete_many({})
    await db.species_forecasts.delete_many({})
    await db.species_seasonal.delete_many({})
    
    # Insert the species list
    await db.species_list.insert_one({
        "species": species,
        "scientific_names": scientific_names
    })
    
    print("Imported species list")
    
    # Insert occurrence data for each species
    for i, species_name in enumerate(species):
        occurrences = generate_occurrence_data(species_name)
        await db.species_occurrences.insert_one({
            "species": species_name,
            "scientific_name": scientific_names[i],
            "occurrences": occurrences
        })
    
    print("Imported occurrence data")
    
    # Insert forecast data for each species
    for i, species_name in enumerate(species):
        forecasts = generate_forecast_data(species_name)
        await db.species_forecasts.insert_one({
            "species": species_name,
            "scientific_name": scientific_names[i],
            "forecasts": forecasts
        })
    
    print("Imported forecast data")
    
    # Insert seasonal data for each species
    for i, species_name in enumerate(species):
        seasonal_data = generate_seasonal_data(species_name)
        await db.species_seasonal.insert_one({
            "species": species_name,
            "scientific_name": scientific_names[i],
            "seasonal_data": seasonal_data
        })
    
    print("Imported seasonal data")
    
    print("All data successfully imported!")

if __name__ == "__main__":
    asyncio.run(import_data_to_mongodb())
