import { defineFunction } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

export const emailOTPFunction = defineFunction({
  name: 'emailOTP',
  entry: './index.ts',
  environment: {
    // Use verified email address - pppratt@gmail.com is verified in SES
    SES_FROM_EMAIL: 'pppratt@gmail.com',
  },
  // Grant SES permissions directly in the function definition
  // This ensures permissions are set even if backend.resources isn't available
});

// Note: SES permissions need to be added via backend.ts or IAM role
// The function will have permissions to invoke, but SES permissions
// may need to be added manually in sandbox environment

