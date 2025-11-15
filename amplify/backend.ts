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

// Set environment variable - access data resources correctly
// In Amplify Gen 2, data resources are accessed through resources.data.resources
const userTable = resources.data.resources.tables['User'];
if (!userTable) {
  throw new Error('User table not found in data resources');
}
postConfirmationFunction.addEnvironment(
  'USER_TABLE_NAME',
  userTable.tableName
);

// Grant DynamoDB permissions
userTable.grantWriteData(postConfirmationFunction);

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

// Set environment variable - access data resources correctly
rotatorFunction.addEnvironment(
  'USER_TABLE_NAME',
  userTable.tableName
);

// Grant permissions
userTable.grantReadWriteData(rotatorFunction);
rotatorFunction.addToRolePolicy(
  new PolicyStatement({
    actions: ['sns:Publish', 'ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
  })
);

