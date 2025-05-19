from typing import Optional, List, Annotated, Dict
from pydantic import BaseModel
from pydantic.functional_validators import BeforeValidator
from bson import ObjectId

# Represents an ObjectId field in the database.
# It will be represented as a `str` on the model so that it can be serialized to JSON.

PyObjectId = Annotated[str, BeforeValidator(str)]

class SpeciesListModel(BaseModel):
    """
    Model for species list
    """
    _id: PyObjectId
    species: list[str]
    scientific_names: list[str]

class OccurrencePoint(BaseModel):
    """
    Model for a single bird occurrence point
    """
    date: str
    latitude: float
    longitude: float
    count: int
    temperature: float  # Temperature data from PRISM
    precipitation: float  # Precipitation data from PRISM

class SpeciesOccurrenceModel(BaseModel):
    """
    Model for bird species occurrence data
    """
    _id: PyObjectId
    species: str
    scientific_name: str
    occurrences: list[OccurrencePoint]

class ForecastPoint(BaseModel):
    """
    Model for forecast data point
    """
    year: int
    month: int
    count_prediction: float
    range_north: float  # Predicted northern range boundary shift in latitude
    range_south: float  # Predicted southern range boundary shift in latitude
    range_east: float   # Predicted eastern range boundary shift in longitude
    range_west: float   # Predicted western range boundary shift in longitude

class SpeciesForecastModel(BaseModel):
    """
    Model for species forecast data
    """
    _id: PyObjectId
    species: str
    scientific_name: str
    forecasts: list[ForecastPoint]

class SeasonalDataPoint(BaseModel):
    """
    Model for seasonal variation data
    """
    year: int
    month: int
    average_count: float
    median_count: float
    max_count: float
    min_count: float
    q1_count: float  # 1st quartile
    q3_count: float  # 3rd quartile
    
class SpeciesSeasonalModel(BaseModel):
    """
    Model for species seasonal variation data
    """
    _id: PyObjectId
    species: str
    scientific_name: str
    seasonal_data: list[SeasonalDataPoint]