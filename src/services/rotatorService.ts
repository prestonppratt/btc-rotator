import { getCurrentUser } from 'aws-amplify/auth';

export interface RotationSignal {
  shouldRotate: boolean;
  currentPosition: string | null;
  newTopTicker: string;
  newTopScore: number;
  scoreGap: number;
  message: string;
  expectedAlpha: number;
  scores?: Array<{
    ticker: string;
    momentum: number;
    correlation: number;
    score: number;
  }>;
}

export async function fetchRotationSignal(): Promise<RotationSignal> {
  try {
    const user = await getCurrentUser();
    
    // Call rotator Lambda via API Gateway
    // You'll need to set up an API Gateway endpoint or use AppSync
    const response = await fetch('/api/rotator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: user.userId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // Handle both direct response and Lambda response format
    const body = typeof data.body === 'string' ? JSON.parse(data.body) : data;
    return body;
  } catch (error) {
    console.error('Error fetching rotation signal:', error);
    throw error;
  }
}

