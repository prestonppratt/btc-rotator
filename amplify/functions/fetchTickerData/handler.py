import json
import os
import urllib.request
import urllib.error
from typing import Dict, List, Any

# Supported tickers - hardcoded as requested
SUPPORTED_TICKERS = [
    "BTC-USD", "MSTR", "SMLR", "ASST", "MARA", "RIOT", 
    "COIN", "HUT", "CLSK", "BITF", "WULF", "CORZ", 
    "IREN", "CIFR", "BTBT"
]

def handler(event, context):
    """
    Lambda handler to fetch ticker data from Yahoo Finance API
    """
    try:
        ticker = event.get('ticker', '').upper()
        
        if ticker not in SUPPORTED_TICKERS:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': f'Ticker {ticker} not supported. Supported tickers: {", ".join(SUPPORTED_TICKERS)}'
                })
            }
        
        # Yahoo Finance API endpoint
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                data = json.loads(response.read().decode())
                
                if 'chart' in data and 'result' in data['chart'] and len(data['chart']['result']) > 0:
                    result = data['chart']['result'][0]
                    meta = result.get('meta', {})
                    
                    ticker_data = {
                        'symbol': ticker,
                        'name': meta.get('longName', ticker),
                        'price': meta.get('regularMarketPrice', 0),
                        'change24h': meta.get('regularMarketChange', 0),
                        'changePercent24h': meta.get('regularMarketChangePercent', 0),
                        'volume': meta.get('regularMarketVolume', 0),
                        'marketCap': meta.get('marketCap', 0),
                        'lastUpdated': int(meta.get('regularMarketTime', 0)),
                    }
                    
                    return {
                        'statusCode': 200,
                        'body': json.dumps(ticker_data)
                    }
                else:
                    return {
                        'statusCode': 404,
                        'body': json.dumps({'error': f'No data found for ticker {ticker}'})
                    }
                    
        except urllib.error.URLError as e:
            return {
                'statusCode': 500,
                'body': json.dumps({'error': f'Failed to fetch data: {str(e)}'})
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': f'Internal server error: {str(e)}'})
        }

