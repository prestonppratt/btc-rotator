import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { rotator } from '../functions/rotator/resource';
import { fetchHistoricalPrices } from '../functions/fetchHistoricalPrices/resource';
import { modelEngine } from '../functions/modelEngine/resource';
// import { getHistoricalPrices } from '../functions/getHistoricalPrices/resource';

const schema = a.schema({
  User: a
    .model({
      email: a.string().required(),
      firstName: a.string(),
      lastName: a.string(),
      phone: a.string(),
      isPaid: a.boolean().required().default(false),
      signupDate: a.datetime().required(),
      notificationFreq: a.string().required(),
      denomination: a.string(),
      portfolio: a.json(),
      tradeHistory: a.json(),
      _schemaVersion: a.integer(), // Force schema update
    })
    .authorization((allow) => [allow.owner()]),

  HistoricalPrice: a
    .model({
      ticker: a.string().required(),
      timestamp: a.float().required(), // Unix timestamp in milliseconds
      priceUSD: a.float().required(),
      priceBTC: a.float().required(),
      btcPriceUSD: a.float().required(),
    })
    .identifier(['ticker', 'timestamp'])
    .authorization((allow) => [allow.guest(), allow.authenticated(), allow.publicApiKey()]),
  /* Force update 5 */

  getRotationSignal: a
    .query()
    .returns(
      a.customType({
        shouldRotate: a.boolean().required(),
        currentPosition: a.string(),
        newTopTicker: a.string().required(),
        newTopScore: a.float().required(),
        scoreGap: a.float().required(),
        message: a.string().required(),
        expectedAlpha: a.float().required(),
      })
    )
    .handler(a.handler.function(rotator))
    .authorization((allow) => [allow.authenticated()]),

  // getHistoricalPrices: a
  //   .query()
  //   .arguments({
  //     ticker: a.string().required(),
  //     days: a.integer(),
  //   })
  //   .returns(a.string())
  //   .handler(a.handler.function(getHistoricalPrices))
  //   .authorization((allow) => [allow.guest(), allow.authenticated()]),

  fetchHistoricalPrices: a
    .mutation()
    .arguments({
      tickers: a.string().array().required(),
      days: a.integer(),
    })
    .returns(a.string())
    .handler(a.handler.function(fetchHistoricalPrices))
    .authorization((allow) => [
      allow.authenticated(),
    ]),

  // Note: We'll use listHistoricalPrices with filters instead of a custom query
  // The composite key (ticker, timestamp) allows efficient queries

  System: a
    .model({
      key: a.id().required(),
      value: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  ModelSelectionConfig: a
    .model({
      name: a.string().required(),
      config: a.json().required(),
      isDefault: a.boolean(),
      lastRunAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),

  RecommendationSnapshot: a
    .model({
      modelName: a.string().required(),
      config: a.json(),
      snapshot: a.json().required(),
      signalDate: a.string(),
      generatedAt: a.datetime().required(),
    })
    .authorization((allow) => [allow.owner()]),

  listModels: a
    .query()
    .returns(a.string().array().required())
    .handler(a.handler.function(modelEngine))
    .authorization((allow) => [allow.authenticated()]),

  runModelComparison: a
    .query()
    .arguments({
      config: a.json(),
    })
    .returns(a.string().required())
    .handler(a.handler.function(modelEngine))
    .authorization((allow) => [allow.authenticated()]),

  getTradeRecommendations: a
    .query()
    .arguments({
      model: a.string(),
      config: a.json(),
      currentHoldings: a.json(),
    })
    .returns(a.string().required())
    .handler(a.handler.function(modelEngine))
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
// Force rebuild 4
