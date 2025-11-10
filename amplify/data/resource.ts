import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  User: a
    .model({
      email: a.string().required(),
      phone: a.string(),
      isPaid: a.boolean().required().default(false),
      signupDate: a.datetime().required(),
      notificationFreq: a.string().required(),
      portfolio: a.json(),
      tradeHistory: a.json(),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

