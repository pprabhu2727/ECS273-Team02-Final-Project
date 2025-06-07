# Birds Across Time: Tracking Species Distribution Shifts under Climate Change

An interactive data visualization dashboard that explores how bird species distributions are changing across the United States in response to climate patterns. Note: AI was used as assistance in creating this project and for modular and cleaner code improvements.

## Description

Climate change is reshaping ecosystems worldwide, and bird species are among the most visible indicators of these environmental shifts. This project combines real-world bird observation data with climate information to create an interactive dashboard that helps users understand these complex ecological relationships. Our application integrates data from two major scientific sources: bird occurrence records from the Global Biodiversity Information Facility (GBIF) and temperature data from the PRISM Climate Group. By overlaying these datasets, we can visualize where different bird species are being observed and how their distributions correlate with temperature patterns across the United States. What makes this project particularly valuable is its combination of historical analysis and forward-looking predictions. The seasonal variation analysis helps users understand natural migration patterns, while the predictive components use machine learning models to suggest how these patterns might shift over time. This dual approach provides both immediate insights into current conditions and thoughtful projections about future ecological scenarios.

The system includes several key visualization components that work together to tell the story of changing bird distributions. Users can explore geographic heatmaps that show bird observation density overlaid on temperature data, helping reveal correlations between species presence and environmental conditions (These files are located in the client/src/component). The dashboard also features predictive models that forecast future distribution trends based on historical patterns, giving insight into potential future changes (These files are located in the server/prediction.py + other .py files).  

The technical architecture consists of a FastAPI backend that handles data processing and serves machine learning predictions, paired with a React frontend that provides an intuitive user interface. MongoDB stores the processed observation data, while Python scripts handle the complex geographic and temporal data transformations needed to create meaningful visualizations.

## Key Features

The dashboard provides four main visualization components:

- **Interactive Heatmaps** - Geographic density maps showing bird occurrences overlaid on temperature data, allowing users to explore correlations between species presence and environmental conditions
- **Predictive Forecasting** - Machine learning models that project future distribution trends based on historical patterns and climate data
- **Recent Observations Table** - Real-time data showing the most recent bird sightings with location and date information
- **Seasonal Analysis** - Box plots revealing seasonal migration patterns and timing variations across different species

## Installation

### Prerequisites

Before setting up the project, ensure you have the following installed on your system:

- **Python 3.12+** - Required for the backend server and data processing
- **Node.js 16+** - Needed for the React frontend
- **MongoDB Community Edition** - Database for storing bird observation data
- **Git** - For cloning the repository

### Step 1: Clone the Repository

```powershell
git clone https://github.com/your-username/ECS273-Team02-Final-Project.git
cd ECS273-Team02-Final-Project
```

### Step 2: Backend Setup

1. Navigate to the server directory

```powershell
cd server
```

2. Install Python dependencies:

```powershell
pip install -r requirements.txt
```

3. Install and start MongoDB:

For Windows users, download MongoDB Community Edition from the official website, or if you have Homebrew:

```powershell
brew services start mongodb-community
```

Start the MongoDB service:

```powershell
net start MongoDB
```

### Step 3: Frontend Setup

1. Navigate to the client directory:

```powershell
cd ../client
```

2. Install Node.js dependencies:

```powershell
npm install lucide-react
npm install vite@5.2.9 --save-dev
npm install
```

### Step 4: Database Setup

1. Return to the server directory and populate the database with data: 
If you skip this step, our sample dataset is already included, but the dashboard output will not be as populated (the dates/species with valid data are also limited, map will show very little points at some dates [Jan 2023 for American Robin is a good options]), and the predictions/boxplot may not be representative (due to how the sample data is setup, but the views still function.).  However despite these disadvantages, we still recommend using this sample data for testing as loading the full data is a multi-hour process, as we have over 5 million entries that need to be moved into a database and put into a prediction algorithm (Note that running the full data may also cause very long loading times for the visuals and UI due to the amount of data the front end needs to process, another reason why we recommend using the sample data).


- Full Data Load: Download the zip file from: https://drive.google.com/file/d/1FiSKbXRBwzHh25gqmQSLUeDFq2Enx-R2/view?usp=sharing
- Unzip the folder and replace the current data file, located: ./server/data
- Additionally, please delete the files within ./server/static (as these were populated with our smaller mock sample data). Do not delete the static folder itself.
- Again, this will take hours to full load data to our database, so for testing, it is reccommend to skip this step.
Note that there are over 5 million entries if using the entire dataset from the google drive link. 
Our small sample dataset has under 200K entires, so it will process much faster for you but will cause the dashboard to be Null for the dates that are not included in the small dataset.

### Step 5: Load Data into MongoDB 
 1. Make your way to the server directory
```powershell
cd ..
cd server
```   
Then, 
```powershell
python import_occurence_data.py
```
This process will take a while with the FULL dataset proided in the Google Drive link.
For testing, please use the small sample datset that is already preloaded. (no need to download data)

### Step 6: Generate Predictions
 1. While in the server directory

```powershell
python predictions.py
```
This process will take a while, as there is alot of data. 

## Execution

### Running the Application

Once you've completed the installation steps, follow these instructions to run a demo of the application:

1. **Start MongoDB** (if not already running):

```powershell
net start MongoDB
```

2. **Launch the Backend Server**:

While in the server directory: 

```powershell
uvicorn main:app --reload --port 8000
```

The FastAPI backend will start on `http://localhost:8000`. You can verify it's working by visiting `http://localhost:8000/docs` to see the interactive API documentation.

3. **Launch the Frontend**:

Open another PowerShell window and navigate to the client directory:

```powershell
cd client
npm install vite@5.2.9 --save-dev
npm install lucide-react
npm install
npm run dev
```

The React frontend will start on `http://localhost:5173` (or another port if 5173 is busy, it will let you know in the terminal).

4. **Access the Dashboard**:

Open your web browser and go to `http://localhost:5173` to view the interactive bird migration dashboard.

### Demo Walkthrough

Check out the video walkthrough on YouTube: [Watch the Demo](https://youtu.be/WfaZzgi_wyw)

Once the application is running, you can explore the following features:

1. **Species Selection** - Use the dropdown menu to select from North American bird species. Other views will update
2. **Date Selection** - Use the dropdown menus to select the year and month. The slider adjusts the day. Other views will update
3. **Density Map Visualization** - Displays temperature-overlay heatmaps showing where birds were observed. Can zoom with scroll wheel and pan by dragging the mouse. 
4. **Forecasting Charts** - View machine learning predictions for future distribution trends. Can hover over the multi-line chart to see more details. 
5. **Recent Observations** - Browse the most recent bird sightings in tabular format. Can sort by date, lattitude, or longitude by clicking the table header. 
6. **Seasonal Patterns** - Examine box plots showing how observation patterns change throughout the year. Can hover over the plots to see details about each month. 


The demo includes sample data for species like American Robin, Northern Cardinal, and Blue Jay, with observations spanning multiple years to demonstrate seasonal and annual trends.

### Troubleshooting

- **MongoDB Connection Issues**: Ensure MongoDB is running and accessible on the default port (27017)
- **Port Conflicts**: If ports 8000 or 5173 are busy, the applications will automatically try alternative ports. Otherwise additional flag may be required at the end of "uvicorn main:app --reload --port 8000" if the server is not responding to any requests. 
- **Missing Dependencies**: Re-run the installation commands if you encounter import errors (unless you intentionally removed data for testing purposes, then the application should still be able to function and if not, try removing the extra species listed in your local mongoDB instance using MongoDB Compass)
- **Data Loading**: The initial heatmap generation may take a few moments as images are created and cached. At time a blank screen may appear while moving through the time slider, sometimes adjusting the slider to a different day and returning back will display the map. (How it works is if the map isn't cached, it will begin the process to generate a new map. This can take about 30-sec, so we recommend to scrub through a region you want to look at. This will queue the creation of all the heatmaps for that date if not already created, then after a couple min, go back to those same dates and the map should appear.)

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


###### Note that ChatGPT was used to help us learn syntax of the programming languages used (like Typscript and Python), help with adding debugging statements, help make visualizations look more appealing, along with making code more efficent (wiht priority on computation time, since working large dataset time is a key constraint)
