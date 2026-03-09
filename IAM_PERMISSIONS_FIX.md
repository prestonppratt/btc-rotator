# How to Fix IAM Permissions for Amplify Gen 2 Backend Deployment

## The Problem
The Amplify CodeBuild role doesn't have permission to read the CDK bootstrap SSM parameter, causing backend deployments to fail.

## Solution Options

### Option 1: Add Custom Service Role to Amplify (Recommended)

1. **Create an IAM Policy for SSM Access:**
   - Go to AWS Console → IAM → Policies → Create Policy
   - Use JSON editor and paste this:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ssm:GetParameter",
           "ssm:GetParameters"
         ],
         "Resource": "arn:aws:ssm:*:*:parameter/cdk-bootstrap/*"
       }
     ]
   }
   ```
   - Name it: `AmplifyCDKBootstrapAccess`

2. **Create a Service Role for Amplify:**
   - Go to IAM → Roles → Create Role
   - Select "AWS Service" → "Amplify"
   - Attach the policy you just created
   - Also attach: `AWSCodeBuildAdminAccess` (for CodeBuild)
   - Name it: `AmplifyServiceRole-Custom`

3. **Attach the Role to Your Amplify App:**
   - Go to AWS Console → Amplify → Your App (btc-rotator)
   - Go to "App settings" → "General"
   - Under "Service role", select your custom role
   - Save

### Option 2: Deploy Backend Manually (Workaround)

If you can't modify the service role, deploy the backend from your local machine:

```bash
cd ~/Projects/btc-rotator
npx ampx sandbox
```

This will deploy the backend locally and generate `amplify_outputs.json` that you can use in your frontend.

### Option 3: Contact AWS Support

Since the role is in an AWS-managed account, you may need AWS Support to add the SSM permissions to the Amplify service role.

## Current Status
- ✅ Frontend: Deploying successfully
- ❌ Backend: Disabled due to IAM permissions

