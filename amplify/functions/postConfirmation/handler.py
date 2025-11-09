import json
import os
import boto3
from datetime import datetime
from typing import Dict, Any

# Initialize DynamoDB client
dynamodb = boto3.client('dynamodb')

# Get table name from environment variable
USER_TABLE_NAME = os.environ.get('USER_TABLE_NAME')

# Paid email addresses (exact match, case-insensitive)
PAID_EMAILS = {
    'you@btcrotator.com',
    'brother@example.com'
}

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Cognito post-confirmation trigger to create User record in DynamoDB
    Automatically sets isPaid = true for specific emails, false for others
    Sets signupDate = now for all users
    """
    try:
        # Extract user information from the event
        user_attributes = event['request']['userAttributes']
        user_id = user_attributes.get('sub', '')
        email = user_attributes.get('email', '').lower().strip()
        phone = user_attributes.get('phone_number', '')
        
        # Determine if user is paid (exact email match)
        is_paid = email in PAID_EMAILS
        
        # Get current timestamp in ISO format
        signup_date = datetime.utcnow().isoformat() + 'Z'
        
        # Default notification frequency
        notification_freq = 'weekly'
        
        # Create User record in DynamoDB
        user_item = {
            'id': {'S': user_id},
            'email': {'S': user_attributes.get('email', '')},
            'isPaid': {'BOOL': is_paid},
            'signupDate': {'S': signup_date},
            'notificationFreq': {'S': notification_freq},
            'portfolio': {'L': []},  # Empty list
            'tradeHistory': {'L': []}  # Empty list
        }
        
        # Add phone if present
        if phone:
            user_item['phone'] = {'S': phone}
        
        # Put item in DynamoDB
        dynamodb.put_item(
            TableName=USER_TABLE_NAME,
            Item=user_item
        )
        
        print(f"Created User record for {email} with isPaid={is_paid}, signupDate={signup_date}")
        
        return event
        
    except Exception as e:
        print(f"Error in post-confirmation trigger: {str(e)}")
        import traceback
        traceback.print_exc()
        # Don't fail the signup process, just log the error
        return event

