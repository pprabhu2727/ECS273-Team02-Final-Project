export interface Margin {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
}

export interface ComponentSize {
    width: number;
    height: number;
}

export interface Point {
    readonly posX: number;
    readonly posY: number;
}

export interface OccurrencePoint {
    date: string;
    latitude: number;
    longitude: number;
    count: number;
    temperature: number;
    precipitation: number;
}

export interface SpeciesOccurrence {
    _id: string;
    species: string;
    scientific_name: string;
    occurrences: OccurrencePoint[];
}

export interface ForecastPoint {
    year: number;
    month: number;
    count_prediction: number;
    range_north: number;
    range_south: number;
    range_east: number;
    range_west: number;
}

export interface SpeciesForecast {
    _id: string;
    species: string;
    scientific_name: string;
    forecasts: ForecastPoint[];
}

export interface SeasonalDataPoint {
    year: number;
    month: number;
    average_count: number;
    median_count: number;
    max_count: number;
    min_count: number;
    q1_count: number;
    q3_count: number;
}

export interface SpeciesSeasonalData {
    _id: string;
    species: string;
    scientific_name: string;
    seasonal_data: SeasonalDataPoint[];
}

export interface TimeRange {
    startYear: number;
    startMonth: number;
    endYear: number;
    endMonth: number;
    currentYear: number;
    currentMonth: number;
}

export interface MapBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}