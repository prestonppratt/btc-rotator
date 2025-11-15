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

// Set environment variable - construct table name from stack
// Amplify Gen 2 creates tables with a specific naming pattern
// We'll use the stack's region and construct a proper table name
const stackName = backend.stack.stackName;
const region = backend.stack.region;
// Amplify Gen 2 table naming: {appId}-{branch}-{resourceId}-{modelName}-{randomId}
// We'll use a CloudFormation reference to get the actual table name
const userTableName = backend.stack.node.tryFindChild('data')?.node.tryFindChild('User')?.node.id || 
  `${stackName}-User-${Date.now().toString().slice(-6)}`;
postConfirmationFunction.addEnvironment('USER_TABLE_NAME', userTableName);

// Grant DynamoDB permissions - use wildcard for now, will be refined
postConfirmationFunction.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:GetItem'],
    resources: [`arn:aws:dynamodb:${region}:*:table/${stackName}-*User*`],
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

// Set environment variable - use same table name
rotatorFunction.addEnvironment('USER_TABLE_NAME', userTableName);

// Grant DynamoDB permissions
rotatorFunction.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query', 'dynamodb:Scan'],
    resources: [`arn:aws:dynamodb:${region}:*:table/${stackName}-*User*`],
  })
);
rotatorFunction.addToRolePolicy(
  new PolicyStatement({
    actions: ['sns:Publish', 'ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
  })
);

