import json
import os
import boto3
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple
import yfinance as yf
import pandas as pd
import numpy as np

# Initialize AWS clients
s3 = boto3.client('s3')
BUCKET_NAME = 'btc-rotator-backtest'
CACHE_KEY = 'backtest_results.json'
CACHE_TTL_HOURS = 24

# Supported tickers - hardcoded as requested
SUPPORTED_TICKERS = [
    "BTC-USD", "MSTR", "SMLR", "ASST", "MARA", "RIOT", 
    "COIN", "HUT", "CLSK", "BITF", "WULF", "CORZ", 
    "IREN", "CIFR", "BTBT"
]

# Backtest parameters
START_DATE = "2024-11-09"
INITIAL_CAPITAL = 10000.0

def fetch_price_data(ticker: str, start_date: str, end_date: str) -> pd.DataFrame:
    """Fetch historical price data using yfinance"""
    try:
        symbol = ticker if ticker != "BTC-USD" else "BTC-USD"
        stock = yf.Ticker(symbol)
        data = stock.history(start=start_date, end=end_date)
        
        if data.empty:
            print(f"No data for {ticker} from {start_date} to {end_date}")
            return pd.DataFrame()
        
        return data
    except Exception as e:
        print(f"Error fetching data for {ticker}: {str(e)}")
        return pd.DataFrame()

def calculate_momentum(prices: pd.Series, days: int = 30) -> float:
    """Calculate 30-day momentum"""
    if len(prices) < days + 1:
        return 0.0
    
    current_price = prices.iloc[-1]
    past_price = prices.iloc[-(days + 1)]
    
    if past_price == 0:
        return 0.0
    
    momentum = (current_price - past_price) / past_price
    return momentum

def calculate_correlation(ticker_prices: pd.Series, btc_prices: pd.Series) -> float:
    """Calculate 30-day correlation to BTC-USD"""
    if len(ticker_prices) < 30 or len(btc_prices) < 30:
        return 0.0
    
    # Get last 30 days
    ticker_30d = ticker_prices.iloc[-30:]
    btc_30d = btc_prices.iloc[-30:]
    
    # Calculate returns
    ticker_returns = ticker_30d.pct_change().dropna()
    btc_returns = btc_30d.pct_change().dropna()
    
    # Align indices
    common_index = ticker_returns.index.intersection(btc_returns.index)
    if len(common_index) < 2:
        return 0.0
    
    ticker_aligned = ticker_returns.loc[common_index]
    btc_aligned = btc_returns.loc[common_index]
    
    # Calculate correlation
    correlation = ticker_aligned.corr(btc_aligned)
    
    return correlation if not np.isnan(correlation) else 0.0

def calculate_scores_for_date(all_data: Dict[str, pd.DataFrame], date: datetime) -> List[Tuple[str, float, float, float]]:
    """Calculate scores for a specific date using historical data up to that date"""
    # Get data up to the target date
    target_date_str = date.strftime('%Y-%m-%d')
    
    # Fetch BTC-USD data up to target date
    btc_data = all_data.get('BTC-USD', pd.DataFrame())
    if btc_data.empty:
        return []
    
    # Filter data up to target date
    btc_data_filtered = btc_data[btc_data.index <= date]
    if len(btc_data_filtered) < 60:  # Need at least 60 days of data
        return []
    
    btc_prices = btc_data_filtered['Close']
    
    results = []
    
    for ticker in SUPPORTED_TICKERS:
        # Skip BTC-USD for correlation (it's the reference)
        if ticker == "BTC-USD":
            continue
        
        # Get ticker data up to target date
        ticker_data = all_data.get(ticker, pd.DataFrame())
        if ticker_data.empty:
            continue
        
        ticker_data_filtered = ticker_data[ticker_data.index <= date]
        if len(ticker_data_filtered) < 60:
            continue
        
        ticker_prices = ticker_data_filtered['Close']
        
        # Calculate metrics
        momentum = calculate_momentum(ticker_prices, days=30)
        correlation = calculate_correlation(ticker_prices, btc_prices)
        
        results.append((ticker, momentum, correlation))
    
    # Calculate ranks
    if not results:
        return []
    
    # Sort by momentum (descending) for ranking
    results_sorted_momentum = sorted(results, key=lambda x: x[1], reverse=True)
    momentum_ranks = {ticker: rank + 1 for rank, (ticker, _, _) in enumerate(results_sorted_momentum)}
    
    # Sort by correlation (descending) for ranking
    results_sorted_correlation = sorted(results, key=lambda x: x[2], reverse=True)
    correlation_ranks = {ticker: rank + 1 for rank, (ticker, _, _) in enumerate(results_sorted_correlation)}
    
    # Calculate composite scores
    scores = []
    for ticker, momentum, correlation in results:
        momentum_rank = momentum_ranks[ticker]
        correlation_rank = correlation_ranks[ticker]
        
        # Score = 0.6 × (1/momentum_rank) + 0.4 × (1/correlation_rank)
        momentum_score = 1.0 / momentum_rank
        correlation_score = 1.0 / correlation_rank
        
        composite_score = 0.6 * momentum_score + 0.4 * correlation_score
        scores.append((ticker, momentum, correlation, composite_score))
    
    # Sort by composite score (descending)
    scores.sort(key=lambda x: x[3], reverse=True)
    
    return scores

def get_cache() -> Tuple[bool, Dict[str, Any]]:
    """Check if cached results exist and are still valid"""
    try:
        # Check if object exists
        s3.head_object(Bucket=BUCKET_NAME, Key=CACHE_KEY)
        
        # Get object
        response = s3.get_object(Bucket=BUCKET_NAME, Key=CACHE_KEY)
        cached_data = json.loads(response['Body'].read().decode('utf-8'))
        
        # Check if cache is still valid (within 24 hours)
        cache_time = datetime.fromisoformat(cached_data.get('cacheTime', ''))
        age = datetime.utcnow() - cache_time
        
        if age < timedelta(hours=CACHE_TTL_HOURS):
            print(f"Using cached results (age: {age})")
            return True, cached_data
        
        print(f"Cache expired (age: {age})")
        return False, {}
    except s3.exceptions.NoSuchKey:
        print("No cache found")
        return False, {}
    except Exception as e:
        print(f"Error reading cache: {str(e)}")
        return False, {}

def save_cache(results: List[Dict[str, Any]]):
    """Save results to S3 cache"""
    try:
        cache_data = {
            'cacheTime': datetime.utcnow().isoformat() + 'Z',
            'results': results
        }
        
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=CACHE_KEY,
            Body=json.dumps(cache_data, indent=2),
            ContentType='application/json'
        )
        print(f"Saved results to S3 cache")
    except Exception as e:
        print(f"Error saving cache: {str(e)}")
        import traceback
        traceback.print_exc()

def run_backtest() -> List[Dict[str, Any]]:
    """Run the backtest"""
    print(f"Starting backtest from {START_DATE}")
    
    # Get today's date
    end_date = datetime.now()
    start_date = datetime.strptime(START_DATE, "%Y-%m-%d")
    
    # Fetch all historical data for all tickers
    print("Fetching historical data...")
    all_data = {}
    for ticker in SUPPORTED_TICKERS:
        print(f"  Fetching {ticker}...")
        data = fetch_price_data(ticker, START_DATE, end_date.strftime('%Y-%m-%d'))
        if not data.empty:
            all_data[ticker] = data
    
    if 'BTC-USD' not in all_data:
        raise Exception("Failed to fetch BTC-USD data")
    
    # Initialize portfolio
    current_position = "BTC-USD"
    portfolio_value = INITIAL_CAPITAL
    current_shares = 0.0
    
    # Get BTC-USD prices for comparison
    btc_prices = all_data['BTC-USD']['Close']
    initial_btc_price = btc_prices.iloc[0]
    btc_shares = INITIAL_CAPITAL / initial_btc_price if initial_btc_price > 0 else 0
    
    results = []
    
    # Run backtest day by day
    current_date = start_date
    last_record_date = start_date
    
    # Initialize: buy BTC-USD on start date
    if current_position in all_data:
        position_data = all_data[current_position]
        position_data_filtered = position_data[position_data.index <= current_date]
        if not position_data_filtered.empty:
            initial_price = position_data_filtered['Close'].iloc[0]
            current_shares = INITIAL_CAPITAL / initial_price if initial_price > 0 else 0
    
    while current_date <= end_date:
        # Skip weekends (markets closed)
        if current_date.weekday() >= 5:  # Saturday = 5, Sunday = 6
            current_date += timedelta(days=1)
            continue
        
        # Calculate scores for this date
        scores = calculate_scores_for_date(all_data, current_date)
        
        if not scores:
            current_date += timedelta(days=1)
            continue
        
        # Get top ticker
        new_top_ticker, new_top_momentum, new_top_correlation, new_top_score = scores[0]
        
        # Get score gap
        if len(scores) > 1:
            _, _, _, second_score = scores[1]
            score_gap = new_top_score - second_score
        else:
            score_gap = 0.0
        
        # Check if rotation should be triggered
        should_rotate = False
        if new_top_ticker != current_position and score_gap > 0.15:
            should_rotate = True
            
            # Execute rotation: sell current position, buy new position
            if current_position in all_data:
                position_data = all_data[current_position]
                position_data_filtered = position_data[position_data.index <= current_date]
                if not position_data_filtered.empty:
                    sell_price = position_data_filtered['Close'].iloc[-1]
                    portfolio_value = current_shares * sell_price
            
            # Buy new position
            current_position = new_top_ticker
            if current_position in all_data:
                position_data = all_data[current_position]
                position_data_filtered = position_data[position_data.index <= current_date]
                if not position_data_filtered.empty:
                    buy_price = position_data_filtered['Close'].iloc[-1]
                    current_shares = portfolio_value / buy_price if buy_price > 0 else 0
        
        # Calculate current portfolio value
        if current_position in all_data:
            position_data = all_data[current_position]
            position_data_filtered = position_data[position_data.index <= current_date]
            if not position_data_filtered.empty:
                current_price = position_data_filtered['Close'].iloc[-1]
                portfolio_value = current_shares * current_price
        
        # Calculate BTC-USD value (buy and hold)
        btc_data_filtered = btc_prices[btc_prices.index <= current_date]
        if not btc_data_filtered.empty:
            current_btc_price = btc_data_filtered.iloc[-1]
            btc_value = btc_shares * current_btc_price
        else:
            btc_value = INITIAL_CAPITAL
        
        # Record result on rotation or weekly
        if should_rotate or (current_date - last_record_date).days >= 7:
            results.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'rotatorValue': round(portfolio_value, 2),
                'btcValue': round(btc_value, 2),
                'position': current_position,
                'topTicker': new_top_ticker,
                'scoreGap': round(score_gap, 4) if should_rotate else None
            })
            last_record_date = current_date
        
        current_date += timedelta(days=1)
    
    # Add final result if not already recorded
    if results and results[-1]['date'] != end_date.strftime('%Y-%m-%d'):
        # Get final scores for end date
        final_scores = calculate_scores_for_date(all_data, end_date)
        final_top_ticker = final_scores[0][0] if final_scores else current_position
        
        results.append({
            'date': end_date.strftime('%Y-%m-%d'),
            'rotatorValue': round(portfolio_value, 2),
            'btcValue': round(btc_value, 2),
            'position': current_position,
            'topTicker': final_top_ticker,
            'scoreGap': None
        })
    
    return results

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Backtest Lambda function
    Replays historical signals and compares to BTC-USD buy-and-hold
    """
    try:
        # Check cache first
        cache_valid, cached_data = get_cache()
        if cache_valid:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'cached': True,
                    'cacheTime': cached_data.get('cacheTime'),
                    'results': cached_data.get('results', [])
                })
            }
        
        # Run backtest
        print("Cache not valid, running backtest...")
        results = run_backtest()
        
        # Save to cache
        save_cache(results)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'cached': False,
                'results': results,
                'summary': {
                    'startDate': START_DATE,
                    'endDate': datetime.now().strftime('%Y-%m-%d'),
                    'initialCapital': INITIAL_CAPITAL,
                    'finalRotatorValue': results[-1]['rotatorValue'] if results else INITIAL_CAPITAL,
                    'finalBtcValue': results[-1]['btcValue'] if results else INITIAL_CAPITAL,
                    'totalReturn': round((results[-1]['rotatorValue'] / INITIAL_CAPITAL - 1) * 100, 2) if results else 0,
                    'btcReturn': round((results[-1]['btcValue'] / INITIAL_CAPITAL - 1) * 100, 2) if results else 0
                }
            })
        }
        
    except Exception as e:
        print(f"Error in backtest handler: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'An error occurred while running backtest'
            })
        }

