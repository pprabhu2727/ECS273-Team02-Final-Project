# ============== SIMPLIFIED CONFIGURATION ==============
# Observation years to use for training
OBSERVATION_YEARS = [2023, 2024]  # Modify this to change which years' data is used

# Prediction settings - SIMPLIFIED!
PREDICTION_START_YEAR = 2024  # Start year for prediction queries
PREDICTION_END_YEAR = 2030    # End year for prediction queries

# Spatial grid settings
GRID_SIZE = 0.5  # Degrees for spatial aggregation (smaller = finer grid)

# Model training settings
TRAINING_EPOCHS = 100
BATCH_SIZE = 32
LEARNING_RATE = 0.001

# ============== ENHANCED MODEL HYPERPARAMETERS ==============
# L1_LAMBDA = 0.01              # L1 regularization strength for region bias features
# L1_DECAY_RATE = 0.95          # Decay rate for L1 penalty (reduces over training)
# L1_DECAY_INTERVAL = 10        # Apply decay every N epochs
# CLIMATE_WEIGHT = 0.3          # Weight for climate features vs occurrence features
# REGION_BIAS_THRESHOLD = 0.1   # Threshold for identifying over-represented regions
# ENHANCED_INPUT_DIM = 9        # Input dimension with climate + bias features
# ============== END ENHANCED MODEL HYPERPARAMETERS ==============

# MongoDB settings
MONGO_URI = "mongodb://localhost:27017"
MONGO_DB = "bird_tracking"

# Auto-calculate months ahead based on years
PREDICTION_MONTHS_AHEAD = (PREDICTION_END_YEAR - PREDICTION_START_YEAR + 1) * 12
# Print configuration summary
print(f"📅 Prediction range: {PREDICTION_START_YEAR}-{PREDICTION_END_YEAR}")
print(f"📊 Auto-calculated months ahead: {PREDICTION_MONTHS_AHEAD}")

# ============== ENHANCEMENT INFO ==============
# The commented sections are for implementing improvements to the model such as incorporating climate data,
# region-frequency bias correction, and enhanced feature engineering. These sections are commented out to avoid the
# performance overhead, however they can be uncommented and implemented as needed.
# ============== END ENHANCEMENT ==============
# ===========================================

# ============== ETL PIPELINE: OBSERVATIONS → PREDICTIONS ==============
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import torch
import torch.nn as nn
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

# MongoDB setup
client = AsyncIOMotorClient(MONGO_URI)
db = client[MONGO_DB]

# Collections
observations_collection = db.species_occurrences  # Input: your existing data
predictions_collection = db.bird_predictions    # Output: predictions for frontend

# ============== STEP 1: READ FROM MONGO ==============

async def load_observations_from_mongo(scientific_name, years=None):
    """
    Load bird observation data from MongoDB
    """
    print(f"Loading observations for {scientific_name} from MongoDB...")
    
    # Build query - CASE INSENSITIVE
    query = {
        'scientific_name': {
            '$regex': f'^{scientific_name}$', 
            '$options': 'i'  # Case insensitive
        }
    }
    
    # Fetch data
    cursor = observations_collection.find(query)
    documents = await cursor.to_list(length=None)
    
    if not documents:
        raise Exception(f"No observations found for {scientific_name}")
    
    # Convert to DataFrame
    df = pd.DataFrame(documents)
    
    # Parse dates
    if isinstance(df['date'].iloc[0], dict):
        df['date'] = pd.to_datetime(df['date'].apply(lambda x: x['$date']))
    else:
        df['date'] = pd.to_datetime(df['date'])
    
    # The data already has a 'species' column (common name), no need to extract from scientific_name
    
    print(f"Loaded {len(df)} observations from MongoDB")
    print(f"Date range: {df['date'].min()} to {df['date'].max()}")
    
    return df

# ============== STEP 2: DATA PREPROCESSING ==============

def analyze_and_preprocess_data(df):
    """
    Analyze data distribution and preprocess with outlier handling
    Enhanced with climate integration and region-frequency bias correction
    """
    print("\n=== Preprocessing Observations ===")
    counts = df['count'].values
    print(f"Total records: {len(df)}")
    print(f"Mean: {counts.mean():.1f}")
    print(f"Median: {np.median(counts):.1f}")
    print(f"Max: {counts.max()}")
    
    # Calculate percentiles
    p99 = np.percentile(counts, 99)
    p95 = np.percentile(counts, 95)
    print(f"95th percentile: {p95:.1f}")
    print(f"99th percentile: {p99:.1f}")
    
    # Extract temporal features
    df['year'] = df['date'].dt.year
    df['month'] = df['date'].dt.month
    df['year_month'] = df['date'].dt.to_period('M')
    
    # ============== CLIMATE INTEGRATION ==============
    # This section would load and merge temperature data with observations
    
    # # Load climate data (PRISM or other source)
    # climate_data = load_climate_data(df['date'].min(), df['date'].max())
    # 
    # # Merge temperature data with observations based on date and location
    # # Need to spatially interpolate climate data to match observation coordinates
    # df = merge_temperature_data(df, climate_data)
    # 
    # # Create temperature features for LSTM input
    # df['temp_normalized'] = (df['mean_temperature'] - df['mean_temperature'].mean()) / df['mean_temperature'].std()
    # df['temp_seasonal'] = np.sin(2 * np.pi * df['month'] / 12) * df['temp_normalized']
    # 
    # # Temperature trend features (moving averages)
    # df['temp_3month_avg'] = df.groupby(['lat_grid', 'lon_grid'])['mean_temperature'].rolling(3, min_periods=1).mean().reset_index(drop=True)
    # df['temp_anomaly'] = df['mean_temperature'] - df['temp_3month_avg']
    # 
    # print(f"Climate integration: Added temperature features for {len(df)} records")
    # ============== END CLIMATE INTEGRATION ==============
      # Create spatial grid
    df['lat_grid'] = (df['latitude'] / GRID_SIZE).round() * GRID_SIZE
    df['lon_grid'] = (df['longitude'] / GRID_SIZE).round() * GRID_SIZE
    
    # ============== REGION-FREQUENCY BIAS CORRECTION ==============
    # This addresses over-representation of certain geographic regions due to human activity
    
    # # Calculate how often each geographic region appears in training set
    # region_frequency = df.groupby(['lat_grid', 'lon_grid']).size().reset_index(name='region_count')
    # region_frequency['region_frequency'] = region_frequency['region_count'] / len(df)
    # region_frequency['log_region_frequency'] = np.log1p(region_frequency['region_count'])
    # 
    # # Create normalized frequency feature (0-1 scale) 
    # # Higher values = more over-represented regions
    # region_frequency['region_bias_score'] = (
    #     region_frequency['region_frequency'] - region_frequency['region_frequency'].min()
    # ) / (region_frequency['region_frequency'].max() - region_frequency['region_frequency'].min())
    # 
    # # Merge back with main dataframe
    # df = df.merge(region_frequency[['lat_grid', 'lon_grid', 'region_bias_score', 'log_region_frequency']], 
    #               on=['lat_grid', 'lon_grid'], how='left')
    # 
    # print(f"Region bias correction: Calculated frequency scores for {len(region_frequency)} unique regions")
    # print(f"Most over-represented region frequency: {region_frequency['region_frequency'].max():.4f}")
    # print(f"Least represented region frequency: {region_frequency['region_frequency'].min():.4f}")
    # ============== END REGION-FREQUENCY BIAS CORRECTION ==============
    
    # Aggregate by grid cell and month
    print(f"\nAggregating with {GRID_SIZE}° grid cells...")
    monthly_agg = df.groupby(['year_month', 'lat_grid', 'lon_grid']).agg({
        'count': 'sum',
        'latitude': 'mean',
        'longitude': 'mean',
        'month': 'first',
        'year': 'first'
    }).reset_index()
    
    # Clip outliers at 99th percentile
    p99_agg = np.percentile(monthly_agg['count'], 99)
    print(f"\nClipping aggregated counts at 99th percentile: {p99_agg:.1f}")
    monthly_agg['count_original'] = monthly_agg['count']
    monthly_agg['count'] = monthly_agg['count'].clip(upper=p99_agg)
    
    # Add temporal encodings
    monthly_agg['month_sin'] = np.sin(2 * np.pi * monthly_agg['month'] / 12)
    monthly_agg['month_cos'] = np.cos(2 * np.pi * monthly_agg['month'] / 12)
    
    # Find grid cells with sufficient temporal coverage
    temporal_coverage = monthly_agg.groupby(['lat_grid', 'lon_grid'])['year_month'].nunique()
    good_cells = temporal_coverage[temporal_coverage >= 12].index
    
    # Filter to keep only cells with good coverage
    monthly_agg_filtered = monthly_agg.set_index(['lat_grid', 'lon_grid'])
    monthly_agg_filtered = monthly_agg_filtered.loc[monthly_agg_filtered.index.isin(good_cells)]
    monthly_agg_filtered = monthly_agg_filtered.reset_index()
    
    print(f"\nKept {len(good_cells)} grid cells with 12+ months of data")
    print(f"Final dataset: {len(monthly_agg_filtered)} records")
    
    return monthly_agg_filtered, p99_agg

# ============== STEP 3: SEQUENCE CREATION ==============

def create_sequences(monthly_agg, seq_len=12, pred_horizon=1):
    """
    Create sequences from aggregated data
    Enhanced with climate variables and region-frequency features
    """
    X, y, metadata = [], [], []
    
    # Group by grid cell
    grid_groups = monthly_agg.groupby(['lat_grid', 'lon_grid'])
    
    for (lat_grid, lon_grid), group in grid_groups:
        group = group.sort_values('year_month')
        
        # Create sequences
        for i in range(len(group) - seq_len - pred_horizon + 1):
            # Input features for sequence
            sequence_data = group.iloc[i:i+seq_len]
            
            # ============== ENHANCED FEATURES ==============
            # Expands feature vector to include climate and bias correction
            # Current features: [log(count), month_sin, month_cos, lat_norm, lon_norm]
            # Enhanced features: [log(count), month_sin, month_cos, lat_norm, lon_norm, 
            #                     temp_normalized, temp_seasonal, temp_anomaly, region_bias_score]
            
            # # Enhanced feature creation with climate integration
            # features = []
            # for _, row in sequence_data.iterrows():
            #     enhanced_features = [
            #         np.log1p(row['count']),      # Log-transformed count (existing)
            #         row['month_sin'],            # Seasonal encoding (existing)
            #         row['month_cos'],            # Seasonal encoding (existing)
            #         row['latitude'] / 90,        # Normalized latitude (existing)
            #         row['longitude'] / 180,      # Normalized longitude (existing)
            #         row['temp_normalized'],      # NEW: Normalized temperature
            #         row['temp_seasonal'],        # NEW: Seasonal temperature interaction
            #         row['temp_anomaly'],         # NEW: Temperature anomaly from trend
            #         row['region_bias_score']     # NEW: Region over-representation score
            #     ]
            #     features.append(enhanced_features)
            # ============== END ENHANCED FEATURES ==============
            
            # Current basic feature creation (keep existing functionality)
            features = []
            for _, row in sequence_data.iterrows():
                features.append([
                    np.log1p(row['count']),  # Log transform
                    row['month_sin'],
                    row['month_cos'],
                    row['latitude'] / 90,    # Normalize latitude
                    row['longitude'] / 180   # Normalize longitude
                ])
            
            X.append(features)
            
            # Target: log(count) at prediction horizon
            target_count = group.iloc[i + seq_len + pred_horizon - 1]['count']
            y.append(np.log1p(target_count))
            
            # Metadata
            metadata.append({
                'location': (group.iloc[i]['latitude'], group.iloc[i]['longitude']),
                'target_date': group.iloc[i + seq_len + pred_horizon - 1]['year_month'],
                'grid': (lat_grid, lon_grid)
                # # Enhanced metadata
                # 'region_bias_score': group.iloc[i]['region_bias_score'],
                # 'avg_temperature': sequence_data['mean_temperature'].mean()
            })
    
    print(f"\nCreated {len(X)} sequences from {len(grid_groups)} grid cells")
    
    return np.array(X), np.array(y), metadata

# ============== STEP 4: MODEL DEFINITION ==============

class BirdLSTM(nn.Module):
    """LSTM model for bird occurrence prediction"""
    def __init__(self, input_dim=5, hidden_dim=64, num_layers=2, dropout=0.2):
        super().__init__()
        
        # ============== ENHANCED MODEL ARCHITECTURE (COMMENTED) ==============
        # TODO: Update input dimension and add L1 regularization for bias correction
        # Enhanced version would use input_dim=9 to accommodate:
        # [count, month_sin, month_cos, lat, lon, temp_norm, temp_seasonal, temp_anomaly, region_bias]
        
        # # Enhanced LSTM with larger input dimension
        # self.lstm = nn.LSTM(
        #     input_dim,  # Should be 9 for enhanced version
        #     hidden_dim, 
        #     num_layers, 
        #     batch_first=True, 
        #     dropout=dropout if num_layers > 1 else 0
        # )
        # 
        # # Separate processing for bias-prone features
        # # The last feature (index 8) is region_bias_score - apply L1 penalty to its weights
        # self.region_bias_linear = nn.Linear(1, hidden_dim // 4)  # Smaller capacity for bias feature
        # self.climate_linear = nn.Linear(3, hidden_dim // 2)      # Climate features (temp_norm, temp_seasonal, temp_anomaly)
        # self.core_lstm = nn.LSTM(5, hidden_dim // 2, num_layers, batch_first=True, dropout=dropout)
        # 
        # # Fusion layer to combine different feature streams
        # self.fusion = nn.Linear(hidden_dim, hidden_dim)
        # ============== END ENHANCED MODEL ARCHITECTURE ==============
        
        # Current basic LSTM architecture (keep existing functionality)
        self.lstm = nn.LSTM(
            input_dim, 
            hidden_dim, 
            num_layers, 
            batch_first=True, 
            dropout=dropout if num_layers > 1 else 0
        )
        
        # Output layers with dropout
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(16, 1)
        )
        
    def forward(self, x):
        # ============== ENHANCED FORWARD PASS ==============
        # 
        # # Split input into different feature streams
        # core_features = x[:, :, :5]          # [count, month_sin, month_cos, lat, lon]
        # climate_features = x[:, :, 5:8]      # [temp_norm, temp_seasonal, temp_anomaly]
        # region_bias = x[:, :, 8:9]           # [region_bias_score]
        # 
        # # Process core features with main LSTM
        # core_out, (core_hidden, _) = self.core_lstm(core_features)
        # core_last = core_hidden[-1]
        # 
        # # Process climate features
        # climate_processed = self.climate_linear(climate_features[:, -1, :])  # Use last timestep
        # 
        # # Process region bias (with L1 penalty applied during training)
        # bias_processed = self.region_bias_linear(region_bias[:, -1, :])
        # 
        # # Fuse all feature streams
        # combined = torch.cat([core_last, climate_processed, bias_processed], dim=1)
        # fused = self.fusion(combined)
        # 
        # return self.fc(fused)
        # ============== END ENHANCED FORWARD PASS ==============
        
        # Current basic forward pass (keep existing functionality)
        lstm_out, (hidden, _) = self.lstm(x)
        last_hidden = hidden[-1]
        return self.fc(last_hidden)
    
    # ============== L1 REGULARIZATION METHODS ==============
    # This helps prevent overfitting to over-represented regions
    
    # def get_region_bias_l1_penalty(self):
    #     """
    #     Compute L1 penalty on region bias linear layer weights
    #     This helps reduce the model's reliance on over-represented regions
    #     """
    #     return torch.sum(torch.abs(self.region_bias_linear.weight))
    # 
    # def get_total_l1_penalty(self, lambda_l1=0.01):
    #     """
    #     Get total L1 penalty for regularization
    #     Apply stronger penalty to region bias features
    #     """
    #     region_penalty = self.get_region_bias_l1_penalty()
    #     return lambda_l1 * region_penalty
    # ============== END L1 REGULARIZATION METHODS ==============

# ============== STEP 5: MODEL TRAINING ==============

def train_model(X, y, metadata):
    """
    Train the LSTM model
    """
    # Split data
    n_samples = len(X)
    indices = np.random.permutation(n_samples)
    split_idx = int(0.8 * n_samples)
    
    train_idx = indices[:split_idx]
    test_idx = indices[split_idx:]
    
    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]
    
    print(f"\nTraining set: {len(X_train)} sequences")
    print(f"Test set: {len(X_test)} sequences")
    
    # Convert to tensors
    X_train_tensor = torch.FloatTensor(X_train)
    y_train_tensor = torch.FloatTensor(y_train).unsqueeze(1)
    X_test_tensor = torch.FloatTensor(X_test)
    y_test_tensor = torch.FloatTensor(y_test).unsqueeze(1)
    
    # ============== ENHANCED MODEL CREATION ==============
    # model = BirdLSTM(input_dim=9, hidden_dim=64, num_layers=2, dropout=0.2)  # Enhanced version
    # ============== END ENHANCED MODEL CREATION ==============
    
    # Create model (current basic version)
    model = BirdLSTM(input_dim=5, hidden_dim=64, num_layers=2, dropout=0.2)
    
    # Loss and optimizer
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=10, verbose=True
    )
    
    # ============== ENHANCED TRAINING CONFIGURATION ==============
    # Add L1 regularization parameters for bias correction
    # lambda_l1 = 0.01  # L1 regularization strength for region bias features
    # lambda_l1_schedule = lambda epoch: lambda_l1 * (0.95 ** (epoch // 10))  # Decay L1 penalty over time
    # ============== END ENHANCED TRAINING CONFIGURATION ==============
      # Training loop
    print("\nTraining model...")
    train_losses = []
    test_losses = []
    
    for epoch in range(TRAINING_EPOCHS):
        # Training
        model.train()
        
        # ============== ENHANCED TRAINING LOOP ==============
        # Include L1 regularization in loss computation for bias correction
        # current_lambda_l1 = lambda_l1_schedule(epoch)  # Decay L1 penalty over training
        # ============== END ENHANCED TRAINING LOOP ==============
        
        # Mini-batch training
        epoch_loss = 0
        n_batches = 0
        
        for i in range(0, len(X_train), BATCH_SIZE):
            batch_X = X_train_tensor[i:i+BATCH_SIZE]
            batch_y = y_train_tensor[i:i+BATCH_SIZE]
            
            optimizer.zero_grad()
            predictions = model(batch_X)
            
            # ============== ENHANCED LOSS COMPUTATION ==============
            # Add L1 penalty to loss for region bias correction
            # This prevents the model from overfitting to over-represented regions
            
            # # Basic MSE loss
            # mse_loss = criterion(predictions, batch_y)
            # 
            # # L1 penalty on region bias weights (lightweight bias correction)
            # l1_penalty = model.get_total_l1_penalty(current_lambda_l1)
            # 
            # # Combined loss: MSE + L1 penalty on bias features
            # total_loss = mse_loss + l1_penalty
            # 
            # total_loss.backward()
            # 
            # # Log both components for monitoring
            # epoch_loss += mse_loss.item()  # Track MSE separately
            # if epoch % 20 == 0 and i == 0:  # Log L1 penalty occasionally
            #     print(f"   MSE: {mse_loss.item():.4f}, L1 penalty: {l1_penalty.item():.6f}")
            # ============== END ENHANCED LOSS COMPUTATION ==============
              # Current basic loss computation (keep existing functionality)
            loss = criterion(predictions, batch_y)
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item()
            n_batches += 1
        
        avg_train_loss = epoch_loss / n_batches
        train_losses.append(avg_train_loss)
        
        # Evaluation
        model.eval()
        with torch.no_grad():
            test_pred = model(X_test_tensor)
            test_loss = criterion(test_pred, y_test_tensor).item()
            test_losses.append(test_loss)
        
        # Learning rate scheduling
        scheduler.step(test_loss)
        
        # Print progress
        if epoch % 20 == 0:
            print(f"Epoch {epoch}/{TRAINING_EPOCHS} - Train Loss: {avg_train_loss:.4f}, Test Loss: {test_loss:.4f}")
    
    # Final evaluation
    model.eval()
    with torch.no_grad():
        train_pred = model(X_train_tensor).numpy().flatten()
        test_pred = model(X_test_tensor).numpy().flatten()
    
    # Transform back from log space
    train_pred_counts = np.expm1(train_pred)
    test_pred_counts = np.expm1(test_pred)
    y_train_counts = np.expm1(y_train)
    y_test_counts = np.expm1(y_test)
    
    # Calculate metrics
    train_mae = np.mean(np.abs(train_pred_counts - y_train_counts))
    test_mae = np.mean(np.abs(test_pred_counts - y_test_counts))
    test_mape = np.mean(np.abs((test_pred_counts - y_test_counts) / (y_test_counts + 1))) * 100
    
    print(f"\n=== Final Results ===")
    print(f"Train MAE: {train_mae:.2f} birds")
    print(f"Test MAE: {test_mae:.2f} birds")
    print(f"Test MAPE: {test_mape:.1f}%")
    
    return {
        'model': model,
        'train_losses': train_losses,
        'test_losses': test_losses,
        'predictions': {
            'train': train_pred_counts,
            'test': test_pred_counts
        },
        'actuals': {
            'train': y_train_counts,
            'test': y_test_counts
        },
        'metadata': {
            'train': [metadata[i] for i in train_idx],
            'test': [metadata[i] for i in test_idx]
        },
        'metrics': {
            'train_mae': train_mae,
            'test_mae': test_mae,
            'test_mape': test_mape
        }
    }

# ============== STEP 6: GENERATE & WRITE PREDICTIONS TO MONGO ==============

async def generate_and_store_predictions(model, monthly_agg, scientific_name):
    """
    Generate future predictions and store in MongoDB predictions collection
    """
    print(f"\n=== Generating Predictions for {scientific_name} ===")
    
    # Clear existing predictions for this species
    await predictions_collection.delete_many({'scientific_name': scientific_name})
    print(f"Cleared existing predictions for {scientific_name}")
    
    # Get unique grid cells
    grid_cells = monthly_agg.groupby(['lat_grid', 'lon_grid']).agg({
        'latitude': 'mean',
        'longitude': 'mean'
    }).reset_index()
    
    documents = []
    current_date = datetime.now()
    
    for _, cell in grid_cells.iterrows():
        # Get recent 12 months of data for this cell
        cell_data = monthly_agg[
            (monthly_agg['lat_grid'] == cell['lat_grid']) & 
            (monthly_agg['lon_grid'] == cell['lon_grid'])
        ].sort_values('year_month').tail(12)
        
        if len(cell_data) < 12:
            continue
          # Generate predictions for next months
        for month_offset in range(1, PREDICTION_MONTHS_AHEAD + 1):
            # Calculate target date
            last_date = cell_data['year_month'].iloc[-1].to_timestamp()
            target_date = last_date + pd.DateOffset(months=month_offset)
            target_year = target_date.year
            target_month = target_date.month
            
            # ============== ENHANCED PREDICTION FEATURES ==============
            # Include climate variables in prediction features
            # This would require forecasting or using climate projections
            
            # # Get climate data for target date (from forecasts or historical averages)
            # target_climate = get_climate_forecast(
            #     target_date, 
            #     cell['latitude'], 
            #     cell['longitude']
            # )
            # 
            # # Create enhanced features for prediction including climate
            # enhanced_features = []
            # for _, row in cell_data.iterrows():
            #     enhanced_features.append([
            #         np.log1p(row['count']),           # Historical occurrence
            #         row['month_sin'],                 # Seasonal encoding
            #         row['month_cos'],                 # Seasonal encoding  
            #         row['latitude'] / 90,             # Normalized latitude
            #         row['longitude'] / 180,           # Normalized longitude
            #         row['temp_normalized'],           # Historical temperature
            #         row['temp_seasonal'],             # Seasonal temperature
            #         row['temp_anomaly'],              # Temperature anomaly
            #         row['region_bias_score']          # Region over-representation
            #     ])
            # 
            # # Add projected climate features for target month
            # enhanced_features[-1][5] = target_climate['temp_normalized']  # Projected temp
            # enhanced_features[-1][6] = np.sin(2 * np.pi * target_month / 12) * target_climate['temp_normalized']
            # enhanced_features[-1][7] = target_climate['temp_anomaly']
            # ============== END ENHANCED PREDICTION FEATURES ==============
            
            # Create features for prediction (current basic version)
            features = []
            for _, row in cell_data.iterrows():
                features.append([
                    np.log1p(row['count']),
                    row['month_sin'],
                    row['month_cos'],
                    row['latitude'] / 90,
                    row['longitude'] / 180
                ])
            
            # Make prediction
            X = torch.FloatTensor([features])
            model.eval()
            with torch.no_grad():
                log_pred = model(X).item()
            
            predicted_count = np.expm1(log_pred)
            
            # Simulate range shifts (replace with real model when available)
            base_shift = np.random.normal(0, 0.5, 4)
            seasonal_factor = np.sin(2 * np.pi * target_month / 12) * 0.3
            range_shifts = base_shift + seasonal_factor
            
            # Create document for chart frontend
            doc = {
                'scientific_name': scientific_name,
                'count_prediction': float(max(0, predicted_count)),
                'range_north': float(range_shifts[0]),
                'range_south': float(range_shifts[1]), 
                'range_east': float(range_shifts[2]),
                'range_west': float(range_shifts[3]),
                'year': int(target_year),
                'month': int(target_month),
                'latitude': float(cell['latitude']),
                'longitude': float(cell['longitude']),
                'grid_lat': float(cell['lat_grid']),
                'grid_lon': float(cell['lon_grid']),
                'prediction_type': 'future',
                'months_ahead': month_offset,
                'prediction_date': current_date,
                'model_version': 'v1.0'
            }
            documents.append(doc)
    
    # Batch insert all predictions
    if documents:
        result = await predictions_collection.insert_many(documents)
        print(f"✅ Stored {len(result.inserted_ids)} predictions to MongoDB")
        print(f"   Collection: {predictions_collection.name}")
        print(f"   Months ahead: {PREDICTION_MONTHS_AHEAD}")
        print(f"   Grid cells: {len(grid_cells)}")
        
        # Create index for efficient querying
        await predictions_collection.create_index([
            ('scientific_name', 1),
            ('year', 1), 
            ('month', 1)
        ])
        print("✅ Created database index for efficient querying")
    
    return len(documents)

# ============== STEP 7: ETL PIPELINE ORCHESTRATOR ==============

async def run_prediction_etl_pipeline(scientific_name):
    """
    Complete ETL Pipeline: MongoDB Observations → Model Training → MongoDB Predictions
    """
    try:
        print(f"🚀 Starting ETL Pipeline for {scientific_name}")
        print("=" * 60)
        
        # EXTRACT: Load observations from MongoDB
        print("📥 STEP 1: EXTRACTING observations from MongoDB...")
        df = await load_observations_from_mongo(scientific_name, OBSERVATION_YEARS)
        
        # TRANSFORM: Preprocess data
        print("\n🔄 STEP 2: TRANSFORMING data...")
        monthly_agg, p99_threshold = analyze_and_preprocess_data(df)
        
        # Create sequences for training
        print("\n📊 STEP 3: Creating training sequences...")
        X, y, metadata = create_sequences(monthly_agg, seq_len=12, pred_horizon=1)
        
        if len(X) == 0:
            raise Exception("No sequences created! Check data quality.")
        
        # Train model
        print("\n🤖 STEP 4: TRAINING model...")
        results = train_model(X, y, metadata)
        
        # LOAD: Generate predictions and store in MongoDB
        print("\n💾 STEP 5: LOADING predictions to MongoDB...")
        num_predictions = await generate_and_store_predictions(
            results['model'], 
            monthly_agg, 
            scientific_name
        )
        
        # Save trained model for future use
        import os
        os.makedirs('models', exist_ok=True)
        model_path = f'models/{scientific_name.replace(" ", "_")}_model.pth'
        torch.save(results['model'].state_dict(), model_path)
        print(f"💾 Saved model to {model_path}")
        
        print("\n" + "=" * 60)
        print("✅ ETL PIPELINE COMPLETED SUCCESSFULLY!")
        print(f"📊 Generated {num_predictions} predictions")
        print(f"🎯 Model MAE: {results['metrics']['test_mae']:.2f} birds")
        print(f"📍 Data stored in: {predictions_collection.name}")
        print("=" * 60)
        
        return {
            'success': True,
            'predictions_generated': num_predictions,
            'model_metrics': results['metrics'],
            'model_path': model_path
        }
        
    except Exception as e:
        print(f"❌ ETL Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e)}

# ============== STEP 8: SIMPLIFIED DATA ACCESS FUNCTIONS ==============

async def get_predictions_for_chart(scientific_name, start_year=None, end_year=None):
    """
    Get predictions from MongoDB for frontend chart
    Now uses configured years by default and full year ranges (Jan-Dec)
    """
    # Use configured years as defaults
    if start_year is None:
        start_year = PREDICTION_START_YEAR
    if end_year is None:
        end_year = PREDICTION_END_YEAR
    
    # Always use full year ranges (January to December)
    start_month = 1
    end_month = 12
    
    pipeline = [
        {
            '$match': {
                'scientific_name': scientific_name,
                '$expr': {
                    '$and': [
                        {
                            '$gte': [
                                {'$add': [{'$multiply': ['$year', 12]}, '$month']},
                                start_year * 12 + start_month
                            ]
                        },
                        {
                            '$lte': [
                                {'$add': [{'$multiply': ['$year', 12]}, '$month']},
                                end_year * 12 + end_month
                            ]
                        }
                    ]
                }
            }
        },
        {
            '$group': {
                '_id': {
                    'year': '$year',
                    'month': '$month'
                },
                'count_prediction': {'$avg': '$count_prediction'},
                'range_north': {'$avg': '$range_north'},
                'range_south': {'$avg': '$range_south'},
                'range_east': {'$avg': '$range_east'},
                'range_west': {'$avg': '$range_west'}
            }
        },
        {
            '$project': {
                '_id': 0,
                'year': '$_id.year',
                'month': '$_id.month',
                'count_prediction': {'$round': ['$count_prediction', 2]},
                'range_north': {'$round': ['$range_north', 3]},
                'range_south': {'$round': ['$range_south', 3]},
                'range_east': {'$round': ['$range_east', 3]},
                'range_west': {'$round': ['$range_west', 3]}
            }
        },
        {
            '$sort': {'year': 1, 'month': 1}
        }
    ]
    
    cursor = predictions_collection.aggregate(pipeline)
    chart_data = await cursor.to_list(length=None)
    
    print(f"📈 Retrieved {len(chart_data)} data points for {scientific_name} ({start_year}-{end_year})")
    
    return chart_data

async def get_species_list():
    """
    Get list of species with available predictions
    """
    species_list = await predictions_collection.distinct('scientific_name')
    return species_list

# ============== MAIN EXECUTION ==============

async def get_species_from_mongo():
    """
    Pull species list from MongoDB species_list collection
    """
    species_collection = db.species_list
    
    try:
        # Get the document containing scientific_names
        species_doc = await species_collection.find_one()
        
        if species_doc and 'scientific_names' in species_doc:
            species_list = species_doc['scientific_names']
            print(f"📋 Loaded {len(species_list)} species from MongoDB")
            return species_list
        else:
            print("⚠️  No scientific_names found in species_list collection")
            # Fallback to default species
            return ["Cardinalis Cardinalis"]
            
    except Exception as e:
        print(f"❌ Error loading species from MongoDB: {e}")
        # Fallback to default species
        return ["Cardinalis Cardinalis"]

async def main():
    """
    Run ETL pipeline for all species from MongoDB
    """
    # Pull species list from MongoDB
    print("📋 Loading species list from MongoDB...")
    species_list = await get_species_from_mongo()
    
    if not species_list:
        print("⚠️  No species found, exiting...")
        return {}
    
    print(f"🎯 Will process {len(species_list)} species:")
    for i, species in enumerate(species_list[:5]):  # Show first 5
        print(f"   {i+1}. {species}")
    if len(species_list) > 5:
        print(f"   ... and {len(species_list) - 5} more")
    
    results = {}
    
    for i, species in enumerate(species_list):
        print(f"\n🔄 Processing {i+1}/{len(species_list)}: {species}")
        result = await run_prediction_etl_pipeline(species)
        results[species] = result
        
        if result['success']:
            # Test data retrieval using simplified function
            chart_data = await get_predictions_for_chart(species)
            print(f"📈 Sample chart data: {len(chart_data)} points")
            if chart_data:
                print(f"   First point: {chart_data[0]}")
        else:
            print(f"❌ Failed to process {species}: {result.get('error', 'Unknown error')}")
    
    # Summary
    successful = sum(1 for r in results.values() if r['success'])
    print(f"\n🎉 ETL Pipeline Complete!")
    print(f"✅ Successfully processed: {successful}/{len(species_list)} species")
    print(f"❌ Failed: {len(species_list) - successful}/{len(species_list)} species")
    
    return results

if __name__ == "__main__":
    # Run the complete ETL pipeline
    asyncio.run(main())