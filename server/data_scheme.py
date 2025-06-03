from typing import List, Optional
from datetime import datetime
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
    year: int
    month: int
    count_prediction: float
    range_north: float
    range_south: float
    range_east: float
    range_west: float

class SpeciesForecastModel(BaseModel):
    model_config = ConfigDict(
    populate_by_name=True,
    arbitrary_types_allowed=True,
    json_encoders={ObjectId: str}
    )

    # _id: PyObjectId
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    species: str
    scientific_name: str
    forecasts: list[ForecastPoint]

class SeasonalDataPoint(BaseModel):
    year: int
    month: int
    average_count: float
    median_count: float
    max_count: float
    min_count: float
    q1_count: float
    q3_count: float

class SpeciesSeasonalModel(BaseModel):
    model_config = ConfigDict(
    populate_by_name=True,
    arbitrary_types_allowed=True,
    json_encoders={ObjectId: str}
    )

    # _id: PyObjectId
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

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

class FlatOccurrenceModel(BaseModel):
    id: Optional[str] = Field(alias="_id")
    scientific_name: str
    species: str
    date: datetime   # ✅ Fix here: allow datetime object from MongoDB
    latitude: float
    longitude: float
