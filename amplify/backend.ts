import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';
import * as path from 'path';

const backend = defineBackend({
  auth,
  data,
});

// Create Python Lambda functions using CDK directly
const { resources } = backend;

// Post-confirmation Python function
const postConfirmationFunction = new Function(
  backend.stack,
  'PostConfirmationFunction',
  {
    runtime: Runtime.PYTHON_3_12,
    handler: 'handler.handler',
    code: Code.fromAsset(path.join(__dirname, 'functions/postConfirmation')),
  }
);

// Set environment variable
postConfirmationFunction.addEnvironment(
  'USER_TABLE_NAME',
  resources.data.tables['User'].tableName
);

// Grant DynamoDB permissions
resources.data.tables['User'].grantWriteData(postConfirmationFunction);

// Configure the post-confirmation trigger
resources.auth.resources.userPool.addLambdaTrigger(
  'PostConfirmation',
  postConfirmationFunction
);

// Rotator Python function
const rotatorFunction = new Function(
  backend.stack,
  'RotatorFunction',
  {
    runtime: Runtime.PYTHON_3_12,
    handler: 'handler.handler',
    code: Code.fromAsset(path.join(__dirname, 'functions/rotator')),
    timeout: Duration.seconds(300),
  }
);

// Set environment variable
rotatorFunction.addEnvironment(
  'USER_TABLE_NAME',
  resources.data.tables['User'].tableName
);

// Grant permissions
resources.data.tables['User'].grantReadWriteData(rotatorFunction);
rotatorFunction.addToRolePolicy({
  effect: 'Allow',
  actions: ['sns:Publish', 'ses:SendEmail', 'ses:SendRawEmail'],
  resources: ['*'],
});

