import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { emailOTPFunction } from './functions/emailOTP/resource';
import { rotator } from './functions/rotator/resource';
import { fetchHistoricalPrices } from './functions/fetchHistoricalPrices/resource';
import { updateHistoricalPrices } from './functions/updateHistoricalPrices/resource';
import { getHistoricalPrices } from './functions/getHistoricalPrices/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Function } from 'aws-cdk-lib/aws-lambda';

// Backend with auth, data, and passwordless email OTP authentication
const backend = defineBackend({
  auth,
  data,
  emailOTPFunction,
  rotator,
  fetchHistoricalPrices,
  updateHistoricalPrices,
  // getHistoricalPrices,
});

// Schedule daily updates of historical prices (runs once per day at midnight UTC)
// Note: This can also be set up via AWS Console > EventBridge > Rules
try {
  const updateLambda = backend.updateHistoricalPrices.resources.lambda;

  // Create EventBridge rule to trigger daily at midnight UTC
  // const dailyUpdateRule = new Rule(backend.stack, 'DailyPriceUpdateRule', {
  //   schedule: Schedule.cron({ hour: '0', minute: '0' }),
  //   description: 'Daily update of historical price data',
  // });

  // dailyUpdateRule.addTarget(new LambdaFunction(updateLambda));
} catch (error) {
  // In sandbox, scheduling may need to be set up manually
  console.warn('Could not set up scheduled price updates:', error);
}

// Grant SES permissions to send emails
// Access resources if available (for production deployments)
try {
  const emailOTPLambda = backend.emailOTPFunction.resources.lambda;
  emailOTPLambda.addToRolePolicy(
    new PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    })
  );
} catch (error) {
  // In sandbox, resources may not be available - SES permissions will be set via IAM
  console.warn('Could not add SES permissions:', error);
}


// Grant DynamoDB permissions to fetchHistoricalPrices
// Grant DynamoDB permissions to fetchHistoricalPrices
try {
  const fetchLambda = backend.fetchHistoricalPrices.resources.lambda;
  // const getLambda = backend.getHistoricalPrices.resources.lambda; // Added
  const table = backend.data.resources.tables['HistoricalPrice'];

  if (table) {
    // Debugging: Grant broad permissions to verify IAM update (Removed)
    // fetchLambda.addToRolePolicy(
    //   new PolicyStatement({
    //     actions: ['dynamodb:*'],
    //     resources: ['*'],
    //   })
    // );

    // Fetch Lambda (Write)
    (fetchLambda as Function).addEnvironment('AMPLIFY_DATA_TABLE_NAME_HISTORICALPRICE', table.tableName);
    table.grantWriteData(fetchLambda);

    // Get Lambda (Read)
    // (getLambda as Function).addEnvironment('AMPLIFY_DATA_TABLE_NAME_HISTORICALPRICE', table.tableName); // Added
    // table.grantReadData(getLambda); // Added

    // Grant DynamoDB read permissions to Unauthenticated Role (Guest)
    // const unauthRole = backend.auth.resources.unauthenticatedUserIamRole;
    // table.grantReadData(unauthRole);
  }
} catch (error) {
  console.warn('Could not add DynamoDB permissions:', error);
}
