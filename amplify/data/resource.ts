import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const Holding = a.customType({
  ticker: a.string().required(),
  shares: a.float().required(),
});

const Trade = a.customType({
  date: a.datetime().required(),
  sellTicker: a.string().required(),
  buyTicker: a.string().required(),
  reason: a.string().required(),
});

const schema = a.schema({
  Ticker: a
    .model({
      symbol: a.string().required(),
      name: a.string().required(),
      price: a.float(),
      change24h: a.float(),
      changePercent24h: a.float(),
      volume: a.float(),
      marketCap: a.float(),
      lastUpdated: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  UserRotation: a
    .model({
      userId: a.string().required(),
      tickerSymbol: a.string().required(),
      rotationOrder: a.int().required(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner().identityClaim('sub'),
      allow.publicApiKey().to(['read']),
    ]),

  RotationHistory: a
    .model({
      userId: a.string().required(),
      fromTicker: a.string().required(),
      toTicker: a.string().required(),
      timestamp: a.datetime().required(),
      reason: a.string(),
    })
    .authorization((allow) => [
      allow.owner().identityClaim('sub'),
      allow.publicApiKey().to(['read']),
    ]),

  User: a
    .model({
      email: a.string().required(),
      phone: a.string(),
      isPaid: a.boolean().default(false),
      signupDate: a.datetime().required(),
      notificationFreq: a.string().required(),
      portfolio: a.json(),
      tradeHistory: a.json(),
    })
    .authorization((allow) => [allow.owner().identityClaim('sub')]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

