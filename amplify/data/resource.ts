import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { rotator } from '../functions/rotator/resource';
import { fetchHistoricalPrices } from '../functions/fetchHistoricalPrices/resource';
// import { getHistoricalPrices } from '../functions/getHistoricalPrices/resource';

const schema = a.schema({
  User: a
    .model({
      email: a.string().required(),
      name: a.string(),
      phone: a.string(),
      isPaid: a.boolean().required().default(false),
      signupDate: a.datetime().required(),
      notificationFreq: a.string().required(),
      denomination: a.string(),
      portfolio: a.json(),
      tradeHistory: a.json(),
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
  /* Force update 3 */

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
    .authorization((allow) => [allow.guest()]), // Allow unauthenticated access for development

  // Note: We'll use listHistoricalPrices with filters instead of a custom query
  // The composite key (ticker, timestamp) allows efficient queries
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

