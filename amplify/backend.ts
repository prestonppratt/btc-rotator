import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { emailOTPFunction } from './functions/emailOTP/resource';
import { rotator } from './functions/rotator/resource';
import { fetchHistoricalPrices } from './functions/fetchHistoricalPrices/resource';
import { updateHistoricalPrices } from './functions/updateHistoricalPrices/resource';
import { modelEngine } from './functions/modelEngine/resource';
import { PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { Rule, Schedule, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';

// Backend with auth, data, and passwordless email OTP authentication
const backend = defineBackend({
  auth,
  data,
  emailOTPFunction,
  rotator,
  fetchHistoricalPrices,
  updateHistoricalPrices,
  modelEngine,
  // getHistoricalPrices,
});

// Schedule daily updates of historical prices (runs once per day at midnight UTC)
// Note: This can also be set up via AWS Console > EventBridge > Rules
try {
  const updateLambda = backend.updateHistoricalPrices.resources.lambda;
  const fetchLambda = backend.fetchHistoricalPrices.resources.lambda;

  // Create EventBridge rule to trigger daily at midnight UTC
  const dailyUpdateRule = new Rule(backend.stack, 'DailyPriceUpdateRule', {
    schedule: Schedule.cron({ minute: '0', hour: '0' }),
    description: 'Daily update of historical price data',
  });

  dailyUpdateRule.addTarget(new LambdaFunction(updateLambda));

  // Hourly budgeted backfill to gradually densify historical data.
  const hourlyBackfillRule = new Rule(backend.stack, 'HourlyBackfillRule', {
    schedule: Schedule.rate(Duration.hours(1)),
    description: 'Hourly budgeted historical backfill for portfolio tickers',
  });

  hourlyBackfillRule.addTarget(
    new LambdaFunction(fetchLambda, {
      event: RuleTargetInput.fromObject({
        autoBackfill: true,
      }),
    })
  );
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
  const systemTable = backend.data.resources.tables['System'];

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

    // Grant permission for the Lambda to invoke itself (for batch processing)
    fetchLambda.addToRolePolicy(
      new PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: ['*'], // Use wildcard to avoid circular dependency with functionArn
      })
    );

    if (systemTable) {
      (fetchLambda as Function).addEnvironment('AMPLIFY_DATA_TABLE_NAME_SYSTEM', systemTable.tableName);
      systemTable.grantReadWriteData(fetchLambda);
    }

    // Fix for S3 AccessDenied error during build
    // Grant the Amplify Build Role access to the deployment bucket to read the schema
    // We do this by attaching a policy to the role itself, rather than the bucket,
    // as modifying the bucket policy of an imported bucket can be problematic.
    const deploymentBucketName = 'amplify-d24onflt4hl1r4-ma-amplifydataamplifycodege-khrisk5c59p2';
    const buildRole = Role.fromRoleName(backend.stack, 'BuildRole', 'AmplifyServiceRole-Custom');

    buildRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`arn:aws:s3:::${deploymentBucketName}/model-schema.graphql`],
      })
    );

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

// Grant read permissions/env to model engine
try {
  const engineLambda = backend.modelEngine.resources.lambda;
  const historicalTable = backend.data.resources.tables['HistoricalPrice'];
  const userTable = backend.data.resources.tables['User'];

  if (historicalTable) {
    (engineLambda as Function).addEnvironment('AMPLIFY_DATA_TABLE_NAME_HISTORICALPRICE', historicalTable.tableName);
    historicalTable.grantReadData(engineLambda);
  }

  if (userTable) {
    (engineLambda as Function).addEnvironment('AMPLIFY_DATA_TABLE_NAME_USER', userTable.tableName);
    userTable.grantReadData(engineLambda);
  }
} catch (error) {
  console.warn('Could not add model engine permissions:', error);
}
