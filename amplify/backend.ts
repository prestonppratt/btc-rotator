import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Set environment variable - use table name pattern that Amplify Gen 2 uses
// Amplify Gen 2 creates tables with pattern: {stackName}-{resourceId}-{modelName}
// We'll use a wildcard ARN since we can't access the table reference directly
const tableNamePattern = `*User*`;
postConfirmationFunction.addEnvironment('USER_TABLE_NAME', tableNamePattern);

// Grant DynamoDB permissions using wildcard (Amplify will resolve the actual table name)
postConfirmationFunction.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:GetItem'],
    resources: [`arn:aws:dynamodb:*:*:table/*User*`],
  })
);

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

// Set environment variable - use same pattern
rotatorFunction.addEnvironment('USER_TABLE_NAME', tableNamePattern);

// Grant DynamoDB permissions
rotatorFunction.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query', 'dynamodb:Scan'],
    resources: [`arn:aws:dynamodb:*:*:table/*User*`],
  })
);
rotatorFunction.addToRolePolicy(
  new PolicyStatement({
    actions: ['sns:Publish', 'ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
  })
);

