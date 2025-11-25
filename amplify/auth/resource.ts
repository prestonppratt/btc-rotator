import { defineAuth } from '@aws-amplify/backend';
import { emailOTPFunction } from '../functions/emailOTP/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    email: {
      required: true,
    },
  },
  // Configure custom authentication triggers
  triggers: {
    defineAuthChallenge: emailOTPFunction,
    createAuthChallenge: emailOTPFunction,
    verifyAuthChallengeResponse: emailOTPFunction,
  },
});

