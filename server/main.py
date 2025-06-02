import os
import logging
from fastapi import FastAPI, HTTPException, Query
from typing import List

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from data_scheme import (
    SpeciesOccurrenceModel,
    SpeciesListModel,
    SpeciesForecastModel,
    SpeciesSeasonalModel,
    ClimateGridModel,
    SeasonalDataPoint,
    FlatOccurrenceModel
)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client.bird_tracking
collection = db.species_occurrences
climate_collection = db.climate

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

@app.get("/species_list", response_model=SpeciesListModel)
async def get_species_list():
    species_collection = db.get_collection("species_list")
    species_list = await species_collection.find_one()
    return species_list

@app.get("/occurrences/{scientific_name}")
async def get_species_occurrences(scientific_name: str):
    print(f"🔍 Looking for: {scientific_name}")
    try:
        result = await collection.find_one({"scientific_name": {"$regex": f"^{scientific_name}$", "$options": "i"}})
        if not result:
            raise HTTPException(status_code=404, detail="Species not found")
        if result.get('_id'):
            result['_id'] = str(result['_id'])
        species_model = SpeciesOccurrenceModel(**result)
        return species_model
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.get("/heatmap")
async def get_heatmap(date: str = Query(...), species: str = Query(...)):
    from make_plot import generate_and_save_heatmap
    output_path = generate_and_save_heatmap(date, species)
    return {"url": f"/static/{os.path.basename(output_path)}"}

@app.get("/forecasts/{species_name}", response_model=SpeciesForecastModel)
async def get_species_forecasts(species_name: str) -> SpeciesForecastModel:
    forecasts_collection = db.get_collection("species_forecasts")
    forecasts = await forecasts_collection.find_one({"species": species_name})
    return forecasts

@app.get("/seasonal/{species_name}", response_model=SpeciesSeasonalModel)
async def get_species_seasonal_data(species_name: str) -> SpeciesSeasonalModel:
    seasonal_collection = db.get_collection("species_seasonal")
    seasonal_data = await seasonal_collection.find_one({"species": species_name})
    return seasonal_data

@app.get("/boxplot/{species_name}")
async def get_boxplot_data(species_name: str):
    try:
        pipeline = [
    {"$match": {"scientific_name": species_name}},
    {"$project": {"date": 1}},  # 👈 only keep `date`
    {"$addFields": {
        "year": {"$year": "$date"},
        "month": {"$month": "$date"},
        "day": {"$dayOfMonth": "$date"}
    }},
    {"$group": {
        "_id": {"year": "$year", "month": "$month", "day": "$day"},
        "dailyCount": {"$sum": 1}
    }},
    {"$group": {
        "_id": "$_id.month",
        "dailyCounts": {"$push": "$dailyCount"}
    }},
    {"$sort": {"_id": 1}}
]

        results = await collection.aggregate(pipeline).to_list(length=None)

        response = []
        for entry in results:
            response.append({
                "month": entry["_id"],
                "dailyCounts": entry["dailyCounts"]
            })

        return JSONResponse(content=response)

    except Exception as e:
        logger.error(f"Failed to compute boxplot data: {e}")
        raise HTTPException(status_code=500, detail="Failed to compute boxplot data")

@app.get("/recent_occurrences/{scientific_name}", response_model=List[FlatOccurrenceModel])
async def get_recent_occurrences(scientific_name: str):
    try:
        cursor = collection.find(
            {"scientific_name": scientific_name}
        ).sort("date", -1).limit(20)

        results = []
        async for doc in cursor:
            if doc.get("_id"):
                doc["_id"] = str(doc["_id"])
            results.append(doc)

        return results

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch recent occurrences")
