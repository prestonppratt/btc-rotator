// Frontend-only MVP - backend will be added later
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

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export async function fetchRotationSignal(): Promise<RotationSignal> {
  try {
    const { data, errors } = await client.queries.getRotationSignal();

    if (errors) {
      console.error('Error fetching rotation signal:', errors);
      throw new Error(errors[0].message);
    }

    if (!data) {
      throw new Error('No data returned from rotation signal query');
    }

    return {
      shouldRotate: data.shouldRotate,
      currentPosition: data.currentPosition ?? null,
      newTopTicker: data.newTopTicker,
      newTopScore: data.newTopScore,
      scoreGap: data.scoreGap,
      message: data.message,
      expectedAlpha: data.expectedAlpha,
    };
  } catch (error) {
    console.error('Failed to fetch rotation signal:', error);
    // Fallback to mock data if backend fails (e.g. during initial setup)
    return {
      shouldRotate: false,
      currentPosition: 'BTC-USD',
      newTopTicker: 'BTC-USD',
      newTopScore: 0.5,
      scoreGap: 0,
      message: 'Backend connection failed - using fallback',
      expectedAlpha: 0,
    };
  }
}
