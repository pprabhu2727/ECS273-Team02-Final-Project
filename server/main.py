"""
FastAPI Backend for Bird Migration Visualization Dashboard

This server provides REST API endpoints for accessing bird observation data,
neural network predictions, and statistical analysis. It interfaces with MongoDB
to serve data to the React frontend components including heatmaps, box plots,
forecasting charts, and data tables.

The async approach is necessary because we're serving potentially large datasets
and multiple concurrent users. MongoDB queries can be expensive, so async operations
prevent blocking the entire server.
"""

import re
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

# Configure logging for debugging database queries and performance monitoring
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# FastAPI application with static file serving for generated heatmap images
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

# MongoDB connection using async motor for non-blocking database operations
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client.bird_tracking
collection = db.species_occurrences
climate_collection = db.climate

# CORS middleware configured for development and production
# Allow all origins for now - in production this should be restricted to frontend domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/species_list", response_model=SpeciesListModel)
async def get_species_list():
    """
    Returns the complete list of bird species available in our database.
    
    This endpoint provides the dropdown options for the frontend species selector.
    We maintain this as a separate collection rather than computing it dynamically
    because the species list changes infrequently and this approach is much faster
    for the user interface.
    """
    species_collection = db.get_collection("species_list")
    species_list = await species_collection.find_one()
    return species_list

@app.get("/occurrences/{scientific_name}")
async def get_species_occurrences(scientific_name: str):
    """
    Retrieves all occurrence records for a specific bird species.
    
    Uses case-insensitive matching because scientific names can be inconsistent
    in the data sources. 
    
    Returns structured occurrence data that feeds into the visualization components.
    """
    logger.debug(f"Fetching occurrences for species: {scientific_name}")
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
    """
    Generates a geographic heatmap for species observations on a specific date.
    
    This endpoint dynamically creates matplotlib visualizations and serves them
    as static files. The heatmap generation is handled by make_plot.py which
    creates density plots showing where the species was most commonly observed.
    
    We return a URL to the generated image rather than embedding the image data
    because the frontend can cache images more efficiently this way.
    """
    from make_plot import generate_and_save_heatmap
    output_path = generate_and_save_heatmap(date, species)
    return {"url": f"/static/{os.path.basename(output_path)}"}

'''
from fastapi.middleware.cors import CORSMiddleware

@app.get("/heatmap")
async def get_heatmap(date: str = Query(...), species: str = Query(...)):
    from make_plot import generate_and_save_heatmap
    output_path = generate_and_save_heatmap(date, species)
    return JSONResponse(
        content={"url": f"/static/{os.path.basename(output_path)}"},
        headers={"Access-Control-Allow-Origin": "*"}
    )
    '''




@app.get("/forecasts/{scientific_name}")
async def get_species_forecasts(scientific_name: str):
    """
    Returns neural network predictions for future bird occurrences and range changes.
    
    This endpoint accesses our machine learning model's output which predicts
    both population counts and geographic range boundaries for upcoming months.
    The predictions include spatial coordinates because the frontend needs to
    plot range boundaries on the map visualizations.
    
    We sort by year and month to ensure the time series data is properly ordered
    for the forecasting chart component.
    """
    try:
        predictions_collection = db.get_collection("bird_predictions")
        
        # Search for exact species match (case-insensitive) to avoid confusion
        cursor = predictions_collection.find({
            "scientific_name": {"$regex": f"^{scientific_name}$", "$options": "i"}
        }).sort([("year", 1), ("month", 1)])
        
        forecasts = []
        async for doc in cursor:
            forecasts.append({
                "year": doc["year"],
                "month": doc["month"],
                "count_prediction": doc["count_prediction"],
                "range_north": doc["range_north"],
                "range_south": doc["range_south"],
                "range_east": doc["range_east"],
                "range_west": doc["range_west"],
                "latitude": doc["latitude"],  # Needed for map boundary plotting
                "longitude": doc["longitude"]  # Needed for map boundary plotting
            })
        
        if not forecasts:
            raise HTTPException(
                status_code=404,
                detail=f"No forecasts found for {scientific_name}"
            )
        
        return {
            "species": scientific_name,
            "scientific_name": scientific_name,
            "forecasts": forecasts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/seasonal/{species_name}", response_model=SpeciesSeasonalModel)
async def get_species_seasonal_data(species_name: str) -> SpeciesSeasonalModel:
    """
    Retrieves pre-computed seasonal migration patterns for a species.
    
    This endpoint serves statistical summaries of when and where species are
    typically observed throughout the year. The data powers seasonal trend
    visualizations and helps users understand migration timing patterns.
    
    We store this as aggregated data rather than computing on-the-fly because
    seasonal patterns are stable and expensive to calculate from raw observations.
    """
    seasonal_collection = db.get_collection("species_seasonal")
    seasonal_data = await seasonal_collection.find_one({"species": species_name})
    return seasonal_data

@app.get("/boxplot/{species_name}")
async def get_boxplot_data(species_name: str):
    """
    Generates statistical data for boxplot visualization of daily observation counts.
    
    This endpoint performs a complex aggregation that groups observations by day,
    counts daily occurrences, then groups by month to create distributions.
    The result shows the variability in daily sighting counts throughout the year,
    which helps identify consistent vs sporadic observation patterns.
    
    The aggregation pipeline is optimized to minimize memory usage by projecting
    only the date field before performing expensive grouping operations.
    """
    try:
        pipeline = [
            {"$match": {"scientific_name": species_name}},
            {"$project": {"date": 1}},  # Only keep date field to reduce memory usage
            {"$addFields": {
                "year": {"$year": "$date"},
                "month": {"$month": "$date"},
                "day": {"$dayOfMonth": "$date"}
            }},
            # First group by individual days to count daily observations
            {"$group": {
                "_id": {"year": "$year", "month": "$month", "day": "$day"},
                "dailyCount": {"$sum": 1}
            }},
            # Then group by month to collect all daily counts for that month
            {"$group": {
                "_id": {"year": "$_id.year", "month": "$_id.month"},
                "dailyCounts": {"$push": "$dailyCount"}
            }},
            {"$sort": {"_id.year": 1, "_id.month": 1}}
        ]

        results = await collection.aggregate(pipeline).to_list(length=None)

        response = []
        for entry in results:
            response.append({
                "year": entry["_id"]["year"],
                "month": entry["_id"]["month"],
                "dailyCounts": entry["dailyCounts"]
            })

        return JSONResponse(content=response)

    except Exception as e:
        logger.error(f"Failed to compute boxplot data: {e}")
        raise HTTPException(status_code=500, detail="Failed to compute boxplot data")

@app.get("/recent_occurrences/{scientific_name}", response_model=List[FlatOccurrenceModel])
async def get_recent_occurrences(scientific_name: str):
    """
    Returns the 20 most recent observations for a species.
    
    This endpoint supports the "recent sightings" feature in the dashboard,
    showing users the latest data points that have been added to our database.
    The limit of 20 keeps response times fast while providing enough examples
    to show current activity patterns.
    
    We sort by date descending to get the newest records first.
    """
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

@app.get("/occurrences_by_date/{scientific_name}", response_model=List[FlatOccurrenceModel])
async def get_occurrences_by_date(
    scientific_name: str, 
    target_date: str = Query(..., description="Date in YYYY-MM-DD format"),
    limit: int = Query(20, description="Maximum number of results to return")
):
    """
    Finds all observations for a species on a specific date.
    
    This endpoint enables detailed exploration of what happened on particular days,
    supporting the drill-down functionality when users click on specific points
    in the time series visualizations.
    
    We create a full day range (00:00 to 23:59) to handle timezone variations
    in the source data. Some observations might have timestamps from different
    time zones, so casting a wider net ensures we don't miss relevant records.
    
    The date parsing is defensive to provide clear error messages for malformed inputs.
    """
    try:
        from datetime import datetime, timedelta
        
        # Parse the target date carefully to avoid timezone confusion
        year, month, day = target_date.split('-')
        target_datetime = datetime(int(year), int(month), int(day))
        
        # Create a full day range to catch all timezone variations
        start_of_day = target_datetime.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        logger.info(f"Searching for occurrences between {start_of_day} and {end_of_day}")
        
        # Query for all occurrences within the 24-hour window
        cursor = collection.find({
            "scientific_name": scientific_name,
            "date": {
                "$gte": start_of_day,
                "$lt": end_of_day
            }
        }).sort("date", -1).limit(limit)
        
        results = []
        async for doc in cursor:
            if doc.get("_id"):
                doc["_id"] = str(doc["_id"])
            results.append(doc)
        
        logger.info(f"Found {len(results)} occurrences for {target_date}")
        return results
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {target_date}. Use YYYY-MM-DD format.")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch occurrences by date")
