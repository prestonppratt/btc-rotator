import json
import os
import boto3
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple
import yfinance as yf
import pandas as pd
import numpy as np

# Initialize AWS clients
dynamodb = boto3.client('dynamodb')
sns = boto3.client('sns')
ses = boto3.client('ses', region_name='us-east-1')  # SES is region-specific

# Get table name from environment variable
USER_TABLE_NAME = os.environ.get('USER_TABLE_NAME')

# Disclaimer to append to all messages
DISCLAIMER = " | Entertainment only. Not advice."

# Supported tickers - hardcoded as requested
SUPPORTED_TICKERS = [
    "BTC-USD", "MSTR", "SMLR", "ASST", "MARA", "RIOT", 
    "COIN", "HUT", "CLSK", "BITF", "WULF", "CORZ", 
    "IREN", "CIFR", "BTBT"
]

def get_user_portfolio(user_id: str) -> Dict[str, float]:
    """Get user's portfolio from DynamoDB"""
    try:
        response = dynamodb.get_item(
            TableName=USER_TABLE_NAME,
            Key={'id': {'S': user_id}}
        )
        
        if 'Item' not in response:
            return {}
        
        portfolio = response['Item'].get('portfolio', {})
        if 'L' not in portfolio:
            return {}
        
        holdings = {}
        for holding in portfolio['L']:
            ticker = holding['M']['ticker']['S']
            shares = float(holding['M']['shares']['N'])
            holdings[ticker] = shares
        
        return holdings
    except Exception as e:
        print(f"Error getting portfolio: {str(e)}")
        return {}

def get_current_position(portfolio: Dict[str, float]) -> str:
    """Get current position (ticker with most shares)"""
    if not portfolio:
        return None
    
    max_shares = max(portfolio.values())
    for ticker, shares in portfolio.items():
        if shares == max_shares:
            return ticker
    return None

def fetch_price_data(ticker: str, days: int = 60) -> pd.DataFrame:
    """Fetch price data using yfinance"""
    try:
        # For BTC-USD, use different symbol format
        symbol = ticker if ticker != "BTC-USD" else "BTC-USD"
        
        stock = yf.Ticker(symbol)
        data = stock.history(period=f"{days}d")
        
        if data.empty:
            print(f"No data for {ticker}")
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

def calculate_scores() -> List[Tuple[str, float, float, float]]:
    """Calculate momentum, correlation, and composite scores for all tickers"""
    # Fetch BTC-USD data first (reference)
    btc_data = fetch_price_data("BTC-USD", days=60)
    if btc_data.empty:
        print("Failed to fetch BTC-USD data")
        return []
    
    btc_prices = btc_data['Close']
    
    results = []
    
    for ticker in SUPPORTED_TICKERS:
        # Skip BTC-USD for correlation (it's the reference)
        if ticker == "BTC-USD":
            continue
        
        # Fetch ticker data
        ticker_data = fetch_price_data(ticker, days=60)
        if ticker_data.empty:
            continue
        
        ticker_prices = ticker_data['Close']
        
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
        
        # Score = 0.6 × momentum_rank + 0.4 × correlation_rank
        # Note: Lower rank is better (rank 1 is best), so we invert for scoring
        # Higher score should mean better, so: score = 0.6 × (1/momentum_rank) + 0.4 × (1/correlation_rank)
        # But user specified direct rank multiplication, so using normalized inverse ranks
        num_tickers = len(results)
        # Normalize: rank 1 -> 1.0, rank N -> 1/N
        momentum_score = 1.0 / momentum_rank
        correlation_score = 1.0 / correlation_rank
        
        composite_score = 0.6 * momentum_score + 0.4 * correlation_score
        scores.append((ticker, momentum, correlation, composite_score))
    
    # Sort by composite score (descending)
    scores.sort(key=lambda x: x[3], reverse=True)
    
    return scores

def should_notify_today(notification_freq: str, signup_date: datetime) -> bool:
    """Check if user should be notified today based on notification frequency"""
    today = datetime.utcnow().date()
    signup_date_only = signup_date.date() if isinstance(signup_date, datetime) else signup_date
    
    if notification_freq == 'daily':
        return True
    elif notification_freq == 'weekly':
        # Notify on same day of week as signup
        return today.weekday() == signup_date_only.weekday()
    elif notification_freq == 'biweekly':
        # Notify every other week on signup day
        days_since_signup = (today - signup_date_only).days
        return days_since_signup % 14 == 0 and today.weekday() == signup_date_only.weekday()
    elif notification_freq == 'monthly':
        # Notify on same day of month (or last day if month shorter)
        return today.day == min(signup_date_only.day, 28)  # Use 28 to avoid month-end issues
    elif notification_freq == 'off':
        return False
    return False

def get_users_to_notify() -> List[Dict[str, Any]]:
    """Query all users and filter by notification frequency and eligibility"""
    try:
        # Scan all users
        response = dynamodb.scan(TableName=USER_TABLE_NAME)
        users = []
        
        today = datetime.utcnow()
        
        for item in response.get('Items', []):
            try:
                # Parse user data
                user_id = item.get('id', {}).get('S', '')
                email = item.get('email', {}).get('S', '')
                phone = item.get('phone', {}).get('S', '')
                is_paid = item.get('isPaid', {}).get('BOOL', False)
                signup_date_str = item.get('signupDate', {}).get('S', '')
                notification_freq = item.get('notificationFreq', {}).get('S', 'off')
                
                if not signup_date_str:
                    continue
                
                # Parse signup date
                signup_date = datetime.fromisoformat(signup_date_str.replace('Z', '+00:00'))
                if signup_date.tzinfo:
                    signup_date = signup_date.replace(tzinfo=None)
                
                # Check if signup within 7 days
                days_since_signup = (today - signup_date).days
                is_new_user = days_since_signup <= 7
                
                # Check if should notify today
                should_notify = should_notify_today(notification_freq, signup_date)
                
                # Filter: (isPaid OR signupDate within 7 days) AND should notify today
                if (is_paid or is_new_user) and should_notify:
                    users.append({
                        'id': user_id,
                        'email': email,
                        'phone': phone,
                        'isPaid': is_paid
                    })
            except Exception as e:
                print(f"Error parsing user: {str(e)}")
                continue
        
        return users
    except Exception as e:
        print(f"Error querying users: {str(e)}")
        import traceback
        traceback.print_exc()
        return []

def create_html_email(sell_ticker: str, buy_ticker: str, scores: List[Tuple[str, float, float, float]]) -> str:
    """Create HTML email with rotation message and pretty table"""
    # Get top 5 scores for table
    top_scores = scores[:5] if len(scores) >= 5 else scores
    
    table_rows = ""
    for i, (ticker, momentum, correlation, score) in enumerate(top_scores, 1):
        momentum_pct = f"{momentum:.2%}"
        correlation_val = f"{correlation:.3f}"
        score_val = f"{score:.4f}"
        
        table_rows += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{i}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">{ticker}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{momentum_pct}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{correlation_val}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{score_val}</td>
        </tr>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #f7931a; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
            .content {{ background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; background-color: white; }}
            th {{ background-color: #f7931a; color: white; padding: 12px; text-align: left; }}
            td {{ padding: 8px; border-bottom: 1px solid #ddd; }}
            .disclaimer {{ margin-top: 20px; padding: 10px; background-color: #fff3cd; border-left: 4px solid #ffc107; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>BTC ROTATOR</h1>
            </div>
            <div class="content">
                <h2>🔄 Rotation Signal</h2>
                <p><strong>SELL {sell_ticker} → BUY {buy_ticker}</strong></p>
                
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Ticker</th>
                            <th>Momentum (30d)</th>
                            <th>Correlation</th>
                            <th>Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {table_rows}
                    </tbody>
                </table>
                
                <div class="disclaimer">
                    <strong>Disclaimer:</strong> Entertainment only. Not advice.
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    return html

def send_notifications(sell_ticker: str, buy_ticker: str, scores: List[Tuple[str, float, float, float]]):
    """Send SMS and email notifications to eligible users"""
    users = get_users_to_notify()
    
    if not users:
        print("No users to notify")
        return
    
    # Create messages
    sms_message = f"BTC ROTATOR: SELL {sell_ticker} → BUY {buy_ticker}{DISCLAIMER}"
    
    # Send notifications
    for user in users:
        try:
            # Send SMS if phone number exists
            if user.get('phone'):
                try:
                    sns.publish(
                        PhoneNumber=user['phone'],
                        Message=sms_message
                    )
                    print(f"Sent SMS to {user['phone']}")
                except Exception as e:
                    print(f"Error sending SMS to {user['phone']}: {str(e)}")
            
            # Send email if email exists
            if user.get('email'):
                try:
                    html_content = create_html_email(sell_ticker, buy_ticker, scores)
                    ses.send_email(
                        Source='noreply@btcrotator.com',  # Must be verified in SES
                        Destination={'ToAddresses': [user['email']]},
                        Message={
                            'Subject': {'Data': f'BTC ROTATOR: SELL {sell_ticker} → BUY {buy_ticker}'},
                            'Body': {
                                'Html': {'Data': html_content},
                                'Text': {'Data': sms_message}
                            }
                        }
                    )
                    print(f"Sent email to {user['email']}")
                except Exception as e:
                    print(f"Error sending email to {user['email']}: {str(e)}")
        except Exception as e:
            print(f"Error notifying user {user.get('id', 'unknown')}: {str(e)}")

def save_trade(user_id: str, from_ticker: str, to_ticker: str, reason: str):
    """Save trade to user's tradeHistory"""
    try:
        # Get current user record
        response = dynamodb.get_item(
            TableName=USER_TABLE_NAME,
            Key={'id': {'S': user_id}}
        )
        
        if 'Item' not in response:
            print(f"User {user_id} not found")
            return
        
        # Get existing tradeHistory
        trade_history = response['Item'].get('tradeHistory', {})
        trades = trade_history.get('L', []) if 'L' in trade_history else []
        
        # Create new trade entry
        new_trade = {
            'M': {
                'date': {'S': datetime.utcnow().isoformat() + 'Z'},
                'sellTicker': {'S': from_ticker},
                'buyTicker': {'S': to_ticker},
                'reason': {'S': reason}
            }
        }
        
        trades.append(new_trade)
        
        # Update user record
        dynamodb.update_item(
            TableName=USER_TABLE_NAME,
            Key={'id': {'S': user_id}},
            UpdateExpression='SET tradeHistory = :th',
            ExpressionAttributeValues={
                ':th': {'L': trades}
            }
        )
        
        print(f"Saved trade: {from_ticker} -> {to_ticker}")
    except Exception as e:
        print(f"Error saving trade: {str(e)}")
        import traceback
        traceback.print_exc()

def process_user_rotation(user_id: str) -> Dict[str, Any]:
    """Process rotation for a single user"""
    # Get user's portfolio
    portfolio = get_user_portfolio(user_id)
    current_position = get_current_position(portfolio)
    
    # Calculate scores for all tickers
    scores = calculate_scores()
    
    if not scores:
        return {
            'error': 'Failed to calculate scores',
            'message': 'Unable to fetch or process ticker data'
        }
    
    # Get top ticker (new #1)
    new_top_ticker, new_top_momentum, new_top_correlation, new_top_score = scores[0]
    
    # Get second ticker for score gap calculation
    if len(scores) > 1:
        second_ticker, _, _, second_score = scores[1]
        score_gap = new_top_score - second_score
    else:
        score_gap = 0.0
    
    # Determine if rotation should be triggered
    should_rotate = False
    message = ""
    expected_alpha = 0.0
    
    if current_position is None:
        # No current position, recommend top ticker
        message = f"No current position. Top recommendation: {new_top_ticker} (Score: {new_top_score:.3f}, Momentum: {new_top_momentum:.2%}, Correlation: {new_top_correlation:.3f})"
        expected_alpha = new_top_score
    elif new_top_ticker != current_position:
        # Different top ticker
        if score_gap > 0.15:
            # Trigger rotation
            should_rotate = True
            
            # Calculate expected alpha (score difference)
            current_position_score = next((score for ticker, _, _, score in scores if ticker == current_position), 0.0)
            expected_alpha = new_top_score - current_position_score
            
            # Save trade
            reason = f"Rotation triggered: Score gap {score_gap:.3f} > 0.15 threshold. New top: {new_top_ticker} (Score: {new_top_score:.3f})"
            save_trade(user_id, current_position, new_top_ticker, reason)
            
            # Send notifications to eligible users
            try:
                send_notifications(current_position, new_top_ticker, scores)
            except Exception as e:
                print(f"Error sending notifications: {str(e)}")
                # Don't fail the rotation if notifications fail
            
            message = f"🔄 ROTATION TRIGGERED: {current_position} → {new_top_ticker}\n"
            message += f"Score gap: {score_gap:.3f} (threshold: 0.15)\n"
            message += f"New position: {new_top_ticker} (Score: {new_top_score:.3f}, Momentum: {new_top_momentum:.2%}, Correlation: {new_top_correlation:.3f})\n"
            message += f"Expected alpha: {expected_alpha:.3f}"
        else:
            # Gap not large enough
            message = f"⚠️ No rotation: New top ticker {new_top_ticker} detected, but score gap {score_gap:.3f} ≤ 0.15 threshold.\n"
            message += f"Current: {current_position} | New top: {new_top_ticker} (Score: {new_top_score:.3f})"
            expected_alpha = 0.0
    else:
        # Same top ticker, no rotation needed
        message = f"✓ Hold: {current_position} remains top ticker (Score: {new_top_score:.3f}, Momentum: {new_top_momentum:.2%}, Correlation: {new_top_correlation:.3f})"
        expected_alpha = 0.0
    
    return {
        'shouldRotate': should_rotate,
        'currentPosition': current_position,
        'newTopTicker': new_top_ticker,
        'newTopScore': new_top_score,
        'scoreGap': score_gap,
        'message': message,
        'expectedAlpha': expected_alpha,
        'scores': [
            {
                'ticker': ticker,
                'momentum': momentum,
                'correlation': correlation,
                'score': score
            }
            for ticker, momentum, correlation, score in scores[:5]  # Top 5
        ]
    }

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Rotator Lambda function
    Analyzes tickers and triggers rotation if conditions are met
    Can be called with user_id or triggered by EventBridge for all users
    """
    try:
        # Check if triggered by EventBridge (no user_id) or direct call (with user_id)
        user_id = event.get('user_id', event.get('userId', ''))
        
        if not user_id:
            # EventBridge trigger - process all users
            print("EventBridge trigger: Processing all users")
            try:
                # Scan all users
                response = dynamodb.scan(TableName=USER_TABLE_NAME)
                results = []
                
                for item in response.get('Items', []):
                    user_id_from_db = item.get('id', {}).get('S', '')
                    if user_id_from_db:
                        result = process_user_rotation(user_id_from_db)
                        results.append({
                            'userId': user_id_from_db,
                            'result': result
                        })
                
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'processed': len(results),
                        'results': results
                    })
                }
            except Exception as e:
                print(f"Error processing all users: {str(e)}")
                import traceback
                traceback.print_exc()
                return {
                    'statusCode': 500,
                    'body': json.dumps({
                        'error': str(e),
                        'message': 'An error occurred while processing all users'
                    })
                }
        else:
            # Direct call with user_id - process single user
            result = process_user_rotation(user_id)
            return {
                'statusCode': 200,
                'body': json.dumps(result)
            }
        
    except Exception as e:
        print(f"Error in rotator handler: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'An error occurred while processing rotation logic'
            })
        }

