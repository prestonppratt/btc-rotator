import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { postConfirmation } from './functions/postConfirmation/resource';
import { rotator } from './functions/rotator/resource';

const backend = defineBackend({
  auth,
  data,
  postConfirmation,
  rotator,
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
  actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem', 'dynamodb:Scan', 'dynamodb:Query'],
  resources: [resources.data.tables['User'].tableArn],
});

// Set environment variable for the table name
resources.rotator.addEnvironment(
  'USER_TABLE_NAME',
  resources.data.tables['User'].tableName
);

// Grant rotator function permissions for SNS (SMS)
resources.rotator.addToRolePolicy({
  effect: 'Allow',
  actions: ['sns:Publish'],
  resources: ['*'],
});

// Grant rotator function permissions for SES (Email)
resources.rotator.addToRolePolicy({
  effect: 'Allow',
  actions: ['ses:SendEmail', 'ses:SendRawEmail'],
  resources: ['*'],
});

