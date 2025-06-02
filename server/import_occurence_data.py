import os
import pandas as pd
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client.bird_tracking

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FOLDER = os.path.join(BASE_DIR, "data")

async def import_csvs_to_mongodb():
    if not os.path.exists(DATA_FOLDER):
        print(f"❌ Folder not found: {DATA_FOLDER}")
        return

    await db.species_list.delete_many({})
    await db.species_occurrences.delete_many({})

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

    # Traverse both subdirectories: 2023 and 2024
    for root, _, files in os.walk(DATA_FOLDER):
        for filename in files:
            if not filename.endswith(".csv"):
                continue

            filepath = os.path.join(root, filename)
            print(f"📄 Processing: {filepath}")

            try:
                df = pd.read_csv(filepath)

                expected = {'date', 'latitude', 'longitude', 'count'}
                if not expected.issubset(set(df.columns)):
                    print(f"⚠️ Missing one of required columns: {expected - set(df.columns)}")
                    continue

                print(f"📊 Loaded {len(df)} rows")

                # Extract scientific name from filename
                base = os.path.splitext(os.path.basename(filename))[0]
                scientific_name = base.replace("_", " ").title()
                if scientific_name in scientific_names:
                    species_name = species[scientific_names.index(scientific_name)]
                else:
                    species_name = scientific_name

                # Clean and convert
                df["date"] = pd.to_datetime(df["date"], errors="coerce")
                df["count"] = pd.to_numeric(df["count"], errors="coerce").fillna(1).astype(int)

                df = df[
                    df["date"].notna() &
                    df["latitude"].between(-90, 90) &
                    df["longitude"].between(-180, 180)
                ]

                print(f"🧹 After cleaning: {len(df)} rows remaining")

                if df.empty:
                    print(f"⚠️ No valid data in {filename}")
                    continue

                # Prepare documents
                occurrences = df[["date", "latitude", "longitude", "count"]].to_dict(orient="records")
                docs = [
                    {
                        "species": species_name,
                        "scientific_name": scientific_name,
                        **occ
                    } for occ in occurrences
                ]

                # Insert into MongoDB in batches
                BATCH_SIZE = 1000
                for i in range(0, len(docs), BATCH_SIZE):
                    await db.species_occurrences.insert_many(docs[i:i + BATCH_SIZE])

                print(f"✅ Inserted {len(docs)} records for {species_name}")

            except Exception as e:
                print(f"❌ Error with file {filename}: {e}")
                import traceback
                traceback.print_exc()

    # Store species list
    await db.species_list.insert_one({
        "species": species,
        "scientific_names": scientific_names
    })

    await db.species_occurrences.create_index(
        [("date", 1), ("scientific_name", 1)],
        name="date_scientific_index"
    )

    print("🔧 Created index on (date, scientific_name)")
    print("\n🎉 All CSVs imported into MongoDB collections")

if __name__ == "__main__":
    asyncio.run(import_csvs_to_mongodb())
