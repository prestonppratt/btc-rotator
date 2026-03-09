import { defineAuth } from '@aws-amplify/backend';
import { emailOTPFunction } from '../functions/emailOTP/resource';
import { preSignUpFunction } from '../functions/preSignUp/resource';

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
    preSignUp: preSignUpFunction,
    defineAuthChallenge: emailOTPFunction,
    createAuthChallenge: emailOTPFunction,
    verifyAuthChallengeResponse: emailOTPFunction,
  },
});

