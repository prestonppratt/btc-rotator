import type { Handler } from 'aws-lambda';

export const handler: Handler = async (event, context) => {
  console.log('Rotator function executed');
  
  // Mock logic for now - matching the previous Python stub
  return {
    shouldRotate: false,
    currentPosition: 'BTC-USD',
    newTopTicker: 'BTC-USD',
    newTopScore: 0.5,
    scoreGap: 0,
    message: 'HOLD – no new signal (Backend connected)',
    expectedAlpha: 0,
  };
};
