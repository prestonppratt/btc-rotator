import json
import os
import boto3
from typing import Dict, Any, List

# Initialize AWS clients
dynamodb = boto3.client('dynamodb')
sns = boto3.client('sns')
ses = boto3.client('ses', region_name='us-east-1')

USER_TABLE_NAME = os.environ.get('USER_TABLE_NAME')

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Rotator Lambda function - sends SMS notifications via SNS
    Can be invoked directly or via EventBridge
    """
    try:
        # For now, return a simple response
        # In production, this would:
        # 1. Calculate rotation signals
        # 2. Query users to notify
        # 3. Send SMS via SNS
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Rotator function executed',
                'smsEnabled': True
            })
        }
    except Exception as e:
        print(f"Error in rotator function: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def send_sms(phone_number: str, message: str) -> bool:
    """
    Send SMS via SNS
    """
    try:
        response = sns.publish(
            PhoneNumber=phone_number,
            Message=message
        )
        print(f"SMS sent to {phone_number}: {response['MessageId']}")
        return True
    except Exception as e:
        print(f"Error sending SMS to {phone_number}: {str(e)}")
        return False

