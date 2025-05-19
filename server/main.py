from fastapi import FastAPI
from pydantic.functional_validators import BeforeValidator
from motor.motor_asyncio import AsyncIOMotorClient

from fastapi.middleware.cors import CORSMiddleware

from data_scheme import (
    SpeciesListModel, SpeciesOccurrenceModel, 
    SpeciesForecastModel, SpeciesSeasonalModel
)

# MongoDB connection (localhost, default port)
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client.bird_tracking # database for bird tracking data
            
app = FastAPI(
    title="Birds Across Time API",
    summary="An application tracking bird species distribution shifts under climate change"
)

# Enables CORS to allow frontend apps to make requests to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/species_list", 
         response_model=SpeciesListModel
    )
async def get_species_list():
    """
    Get the list of bird species from the database
    """
    species_collection = db.get_collection("species_list")
    species_list = await species_collection.find_one()
    return species_list

@app.get("/occurrences/{species_name}", 
        response_model=SpeciesOccurrenceModel
    )
async def get_species_occurrences(species_name: str) -> SpeciesOccurrenceModel:
    """
    Get the occurrence data for a specific bird species
    Parameters:
    - species_name: The common name of the bird species
    """
    occurrences_collection = db.get_collection("species_occurrences")
    occurrences = await occurrences_collection.find_one({"species": species_name})
    return occurrences

@app.get("/forecasts/{species_name}", 
        response_model=SpeciesForecastModel
    )
async def get_species_forecasts(species_name: str) -> SpeciesForecastModel:
    """
    Get the forecast data for a specific bird species
    Parameters:
    - species_name: The common name of the bird species
    """
    forecasts_collection = db.get_collection("species_forecasts")
    forecasts = await forecasts_collection.find_one({"species": species_name})
    return forecasts

@app.get("/seasonal/{species_name}",
        response_model=SpeciesSeasonalModel
    )
async def get_species_seasonal_data(species_name: str) -> SpeciesSeasonalModel:
    """
    Get the seasonal variation data for a specific bird species
    Parameters:
    - species_name: The common name of the bird species
    """
    seasonal_collection = db.get_collection("species_seasonal")
    seasonal_data = await seasonal_collection.find_one({"species": species_name})
    return seasonal_data