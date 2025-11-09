import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { postConfirmation } from './functions/postConfirmation/resource';
import { rotator } from './functions/rotator/resource';
import { backtest } from './functions/backtest/resource';

const backend = defineBackend({
  auth,
  data,
  postConfirmation,
  rotator,
  backtest,
});

// Grant the postConfirmation function permissions to write to the User table
const { resources } = backend;
resources.postConfirmation.addToRolePolicy({
  effect: 'Allow',
  actions: ['dynamodb:PutItem'],
  resources: [resources.data.tables['User'].tableArn],
});

// Set environment variable for the table name
resources.postConfirmation.addEnvironment(
  'USER_TABLE_NAME',
  resources.data.tables['User'].tableName
);

// Configure the post-confirmation trigger
resources.auth.resources.userPool.addLambdaTrigger(
  'PostConfirmation',
  resources.postConfirmation
);

// Grant rotator function permissions to read/write User table
resources.rotator.addToRolePolicy({
  effect: 'Allow',
  actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
  resources: [resources.data.tables['User'].tableArn],
});

// Set environment variable for the table name
resources.rotator.addEnvironment(
  'USER_TABLE_NAME',
  resources.data.tables['User'].tableName
);

// Grant backtest function permissions to read/write S3
resources.backtest.addToRolePolicy({
  effect: 'Allow',
  actions: [
    's3:GetObject',
    's3:PutObject',
    's3:HeadObject',
    's3:ListBucket'
  ],
  resources: [
    'arn:aws:s3:::btc-rotator-backtest',
    'arn:aws:s3:::btc-rotator-backtest/*'
  ],
});

// Grant rotator function additional permissions for notifications
resources.rotator.addToRolePolicy({
  effect: 'Allow',
  actions: ['dynamodb:Scan', 'dynamodb:Query'],
  resources: [resources.data.tables['User'].tableArn],
});

resources.rotator.addToRolePolicy({
  effect: 'Allow',
  actions: ['sns:Publish'],
  resources: ['*'],
});

resources.rotator.addToRolePolicy({
  effect: 'Allow',
  actions: ['ses:SendEmail', 'ses:SendRawEmail'],
  resources: ['*'],
});

// Create EventBridge rule to trigger rotator daily at 08:00 UTC
// Note: EventBridge integration may need to be configured differently in Amplify Gen 2
// This is a placeholder - actual implementation may require using AWS CDK or manual configuration
// For now, the rotator can be invoked manually or via API Gateway

