"""
CSV to MongoDB Import Script for Bird Observation Data

This script processes cleaned CSV files from the GBIF data fetcher and imports them 
into MongoDB collections optimized for our bird migration visualization dashboard.
It handles data validation, species name mapping, and creates indexes for efficient
querying by the FastAPI backend.

The async approach is necessary because we're processing potentially millions of 
records across multiple species files, and MongoDB insertions benefit from 
asynchronous batching to avoid blocking on I/O operations.
"""

import os
import pandas as pd
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB connection to local instance
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client.bird_tracking

# Path configuration relative to script location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FOLDER = os.path.join(BASE_DIR, "data")

async def import_csvs_to_mongodb():
    """
    Main import function that processes all CSV files and loads them into MongoDB.
    
    This function handles the complete ETL pipeline: extracting from CSV files,
    transforming the data to match our schema, and loading into MongoDB with
    proper indexing for optimal query performance.
    """
    if not os.path.exists(DATA_FOLDER):
        print(f"❌ Folder not found: {DATA_FOLDER}")
        return

    # Clear existing data to ensure clean import
    # This prevents duplicate records when re-running the import script
    await db.species_list.delete_many({})
    await db.species_occurrences.delete_many({})

    # Master species lists for the dropdown selector and data validation
    # These lists must stay synchronized with the species we have models for
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
        "Turdus Migratorius",
        "Cardinalis Cardinalis",
        "Cyanocitta Cristata",
        "Zenaida Macroura",
        "Dryobates Pubescens",
        "Haemorhous Mexicanus",
        "Thryothorus Ludovicianus",
        "Poecile Atricapillus",
        "Melanerpes Carolinus",
        "Sialia Sialis"
    ]

    # Process all CSV files recursively from data/2023/ and data/2024/ subdirectories
    # The os.walk approach handles any nested folder structure automatically
    for root, _, files in os.walk(DATA_FOLDER):
        for filename in files:
            if not filename.endswith(".csv"):
                continue

            filepath = os.path.join(root, filename)
            print(f"📄 Processing: {filepath}")

            try:
                df = pd.read_csv(filepath)

                # Validate required columns before processing
                # Missing any of these makes the data unusable for our models
                expected = {'date', 'latitude', 'longitude', 'count'}
                if not expected.issubset(set(df.columns)):
                    print(f"⚠️ Missing one of required columns: {expected - set(df.columns)}")
                    continue

                print(f"📊 Loaded {len(df)} rows")

                """
                Species name extraction and mapping from filename
                
                CSV files are named like "Turdus_migratorius.csv", so we convert
                underscores to spaces and title-case to get "Turdus Migratorius".
                Then we map to the common name for consistent frontend display.
                """
                base = os.path.splitext(os.path.basename(filename))[0]
                scientific_name = base.replace("_", " ").title()
                if scientific_name in scientific_names:
                    species_name = species[scientific_names.index(scientific_name)]
                else:
                    # Fallback for any unexpected species files
                    species_name = scientific_name

                """
                Data cleaning and validation
                
                We're strict about data quality because bad coordinates or dates
                will break our spatial-temporal models. Invalid counts default to 1
                since that's the most common case for presence-only data.
                """
                df["date"] = pd.to_datetime(df["date"], errors="coerce")
                df["count"] = pd.to_numeric(df["count"], errors="coerce").fillna(1).astype(int)

                # Filter out invalid records that would cause model errors
                df = df[
                    df["date"].notna() &                    # No null dates
                    df["latitude"].between(-90, 90) &       # Valid latitude range
                    df["longitude"].between(-180, 180)      # Valid longitude range
                ]

                print(f"🧹 After cleaning: {len(df)} rows remaining")

                if df.empty:
                    print(f"⚠️ No valid data in {filename}")
                    continue

                """
                Document preparation for MongoDB insertion
                
                We denormalize the data by including species info in each document.
                This trades storage space for query speed - the frontend can filter
                by species without joins, which is crucial for responsive charts.
                """
                occurrences = df[["date", "latitude", "longitude", "count"]].to_dict(orient="records")
                docs = [
                    {
                        "species": species_name,
                        "scientific_name": scientific_name,
                        **occ
                    } for occ in occurrences
                ]
                
                """
                Batch insertion for performance
                
                MongoDB performs much better with batch inserts rather than
                individual document insertions. 1000 docs per batch balances
                memory usage with insertion speed.
                """
                print(f"📊 Inserting records ...")
                BATCH_SIZE = 1000
                for i in range(0, len(docs), BATCH_SIZE):
                    await db.species_occurrences.insert_many(docs[i:i + BATCH_SIZE])

                print(f"✅ Inserted {len(docs)} records for {species_name}")

            except Exception as e:
                print(f"❌ Error with file {filename}: {e}")
                import traceback
                traceback.print_exc()

    # Store the master species list for the frontend dropdown component
    await db.species_list.insert_one({
        "species": species,
        "scientific_names": scientific_names
    })

    """
    Create database index for query optimization
    
    The (date, scientific_name) compound index is crucial because our frontend
    frequently filters by species and date ranges. Without this index, queries
    would require full collection scans and be prohibitively slow.
    """
    await db.species_occurrences.create_index(
        [("date", 1), ("scientific_name", 1)],
        name="date_scientific_index"
    )

    print("🔧 Created index on (date, scientific_name)")
    print("\n🎉 All CSVs imported into MongoDB collections")

if __name__ == "__main__":
    asyncio.run(import_csvs_to_mongodb())
