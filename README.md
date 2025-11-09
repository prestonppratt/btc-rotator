# BTC Rotator

A full-stack serverless web application for rotating and tracking Bitcoin-related tickers.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: AWS AppSync (GraphQL) + DynamoDB + Lambda (Python 3.12)
- **Auth**: AWS Cognito (email + phone number signup/login)
- **Hosting**: AWS Amplify Hosting

## Supported Tickers

The following tickers are hardcoded throughout the application:

- BTC-USD
- MSTR
- SMLR
- ASST
- MARA
- RIOT
- COIN
- HUT
- CLSK
- BITF
- WULF
- CORZ
- IREN
- CIFR
- BTBT

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- AWS CLI configured
- AWS Amplify CLI installed: `npm install -g @aws-amplify/cli`

### Installation

1. Install dependencies:
```bash
npm install
```

2. Initialize Amplify (if not already done):
```bash
npx ampx sandbox
```

3. Start development server:
```bash
npm run dev
```

## Deployment

1. Connect to Amplify:
```bash
npx ampx pipeline-deploy --branch main
```

2. Or deploy via Amplify Console:
   - Connect your GitHub repository
   - Amplify will automatically detect and deploy

## Project Structure

```
btc-rotator/
├── amplify/
│   ├── backend.ts          # Amplify backend configuration
│   ├── auth/
│   │   └── resource.ts     # Cognito auth configuration
│   ├── data/
│   │   ├── resource.ts     # AppSync GraphQL schema
│   │   └── schema.graphql  # GraphQL schema definition
│   └── functions/
│       └── fetchTickerData/
│           ├── resource.ts # Lambda function definition
│           ├── handler.py  # Python Lambda handler
│           └── requirements.txt
├── src/
│   ├── components/         # React components
│   ├── services/           # API services
│   ├── constants/         # Constants (tickers list)
│   ├── types/             # TypeScript types
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles
├── amplify.yml            # Amplify build configuration
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Features

- User authentication with email and phone number
- Real-time ticker data fetching
- Customizable rotation order
- Rotation history tracking
- Responsive design with Tailwind CSS

## License

MIT

