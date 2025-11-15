import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Backend with passwordless email OTP authentication
const backend = defineBackend({
  auth,
});

const { resources } = backend;

// Email OTP Lambda function for DefineAuthChallenge
const defineAuthChallengeFunction = new Function(
  backend.stack,
  'DefineAuthChallengeFunction',
  {
    runtime: Runtime.NODEJS_20_X,
    handler: 'handler.defineAuthChallenge',
    code: Code.fromAsset(path.join(__dirname, 'functions/emailOTP')),
  }
);

// Email OTP Lambda function for CreateAuthChallenge
const createAuthChallengeFunction = new Function(
  backend.stack,
  'CreateAuthChallengeFunction',
  {
    runtime: Runtime.NODEJS_20_X,
    handler: 'handler.createAuthChallenge',
    code: Code.fromAsset(path.join(__dirname, 'functions/emailOTP')),
    environment: {
      SES_FROM_EMAIL: 'noreply@yourdomain.com', // Update with your verified SES email
    },
  }
);

// Email OTP Lambda function for VerifyAuthChallengeResponse
const verifyAuthChallengeFunction = new Function(
  backend.stack,
  'VerifyAuthChallengeFunction',
  {
    runtime: Runtime.NODEJS_20_X,
    handler: 'handler.verifyAuthChallengeResponse',
    code: Code.fromAsset(path.join(__dirname, 'functions/emailOTP')),
  }
);

// Attach Lambda triggers to Cognito User Pool
resources.auth.resources.userPool.addLambdaTrigger('DefineAuthChallenge', defineAuthChallengeFunction);
resources.auth.resources.userPool.addLambdaTrigger('CreateAuthChallenge', createAuthChallengeFunction);
resources.auth.resources.userPool.addLambdaTrigger('VerifyAuthChallengeResponse', verifyAuthChallengeFunction);

// Grant SES permissions to send emails
createAuthChallengeFunction.addToRolePolicy(
  new PolicyStatement({
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
  })
);

