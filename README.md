# Birds Across Time: Tracking Species Distribution Shifts under Climate Change

An interactive data visualization project that displays the changing distributions of bird species across the United States in relation to climate data.

## Project Overview

This project visualizes bird occurrence data from GBIF (Global Biodiversity Information Facility) and climate data from PRISM to track and analyze how bird species distributions are shifting in response to climate change. The visualization includes:

1. **Density Map** - A heatmap showing bird occurrences across the United States
2. **Predictive Future Projections** - Forecasting charts showing predicted future trends
3. **Recent Occurrences Table** - Tabular data of recent bird sightings
4. **Seasonal Variation View** - Box plots showing seasonal patterns in bird sightings

## Getting Started

The project consists of two parts: a server (FastAPI backend) and a client (React frontend).

### Server Setup

1. Make sure you have Python installed on your system.
2. Install required packages:

```
cd server
pip install -r requirements.txt
```

3. Ensure you have MongoDB installed and running. For example, with homebrew:

```
brew services start mongodb-community
```

4. Import the sample data into MongoDB:

```
python import_data.py
```

5. Start the API server:

```
uvicorn main:app --reload --port 8000
```

### Client Setup

1. Make sure you have Node.js installed on your system.
2. Install dependencies:

```
cd client
npm install
```

3. Start the development server:

```
npm run dev
```

## Data Sources

The project currently uses sample data generated to mimic:
- [GBIF Occurrence Data](https://www.gbif.org/) - Bird species observations
- [PRISM Climate Data](https://prism.oregonstate.edu/) - Temperature and precipitation data

## Featured Bird Species

The visualization includes data for ten common North American bird species:
- American Robin (Turdus migratorius)
- Northern Cardinal (Cardinalis cardinalis)
- Blue Jay (Cyanocitta cristata)
- Mourning Dove (Zenaida macroura)
- Downy Woodpecker (Dryobates pubescens)
- House Finch (Haemorhous mexicanus)
- Carolina Wren (Thryothorus ludovicianus)
- Black-capped Chickadee (Poecile atricapillus)
- Red-bellied Woodpecker (Melanerpes carolinus)
- Eastern Bluebird (Sialia sialis)
