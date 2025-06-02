from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId



class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, handler=None):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")

class SpeciesListModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    species: list[str]
    scientific_names: list[str]



class OccurrencePoint(BaseModel):
    date: str
    latitude: float
    longitude: float
    count: int

class SpeciesOccurrenceModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    species: str
    scientific_name: str
    occurrences: List[OccurrencePoint]

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


class ClimateGridModel(BaseModel):
    date: str
    source: str
    resolution: str
    origin: List[float]
    step: List[float]
    nodata: float
    grid: List[List[Optional[float]]]
