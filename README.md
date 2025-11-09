# BTC Rotator – Automated Bitcoin Alpha

A full-stack serverless web application for automated Bitcoin ticker rotation strategy. Built with AWS Amplify Gen 2, React 18, TypeScript, and Python 3.12.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- AWS Account
- GitHub Account
- Domain name (btcrotator.com)

## 📦 Project Structure

```
btc-rotator/
├── amplify/
│   ├── auth/resource.ts          # Cognito authentication
│   ├── backend.ts                 # Backend configuration
│   ├── data/
│   │   ├── resource.ts            # AppSync + DynamoDB
│   │   └── schema.graphql        # GraphQL schema
│   └── functions/
│       ├── backtest/              # Backtest Lambda (Python 3.12)
│       ├── postConfirmation/     # User creation trigger
│       └── rotator/               # Rotation logic + notifications
├── src/
│   ├── components/                # React components
│   ├── pages/                     # Page components
│   ├── services/                  # API services
│   └── hooks/                     # React hooks
└── public/
    └── favicon.svg                # Bitcoin logo favicon
```

## 🚀 How to Deploy to AWS Amplify in 2 Clicks

### Quick Deploy (Recommended)

1. **Go to AWS Amplify Console**
   - Navigate to: https://console.aws.amazon.com/amplify/
   - Click "New app" → "Host web app"

2. **Connect & Deploy**
   - Select "GitHub" as source
   - Authorize AWS Amplify
   - Select repository: `prestonppratt/btc-rotator`
   - Select branch: `main`
   - Click "Save and deploy"

**That's it!** Amplify will:
- Auto-detect `amplify.yml` build configuration
- Install dependencies (Node 18)
- Build frontend (Vite)
- Deploy backend (Cognito, AppSync, DynamoDB, Lambda)
- Generate `amplify_outputs.json` automatically
- Deploy to production URL

**Your app will be live in ~10-15 minutes!**

---

## 🔧 Detailed Deployment Guide

### 1. Connect GitHub to AWS Amplify

1. **Go to AWS Amplify Console**
   - Navigate to: https://console.aws.amazon.com/amplify/
   - Click "New app" → "Host web app"

2. **Connect Repository**
   - Select "GitHub" as source
   - Authorize AWS Amplify to access your GitHub account
   - Select repository: `prestonppratt/btc-rotator`
   - Select branch: `main`

3. **Configure Build Settings**
   - Amplify will auto-detect the `amplify.yml` file
   - Review build settings:
     - Frontend: Vite build (outputs to `dist/`)
     - Backend: Python 3.12 Lambda functions
   - Click "Save and deploy"

4. **Initial Deployment**
   - Amplify will:
     - Install dependencies (`npm ci`)
     - Build frontend (`npm run build`)
     - Deploy backend resources (Cognito, AppSync, DynamoDB, Lambda)
   - Wait for deployment to complete (~10-15 minutes)

5. **Get Amplify Outputs**
   - After deployment, download `amplify_outputs.json` from Amplify Console
   - Place it in project root (already committed for local dev)

### 2. Add Custom Domain (btcrotator.com)

1. **In Amplify Console**
   - Go to your app → "Domain management"
   - Click "Add domain"

2. **Enter Domain**
   - Domain: `btcrotator.com`
   - Click "Configure domain"

3. **DNS Configuration**
   - Amplify will provide DNS records to add:
     - CNAME record: `_amazonses.btcrotator.com` → (provided value)
     - A record or CNAME: `btcrotator.com` → (provided value)
     - A record or CNAME: `www.btcrotator.com` → (provided value)

4. **Update DNS at Your Registrar**
   - Go to your domain registrar (e.g., Namecheap, GoDaddy)
   - Add the DNS records provided by Amplify
   - Wait for DNS propagation (5-60 minutes)

5. **SSL Certificate**
   - Amplify automatically provisions SSL certificate via AWS Certificate Manager
   - Certificate will be issued once DNS is verified
   - HTTPS will be enabled automatically

6. **Verify Domain**
   - Amplify will verify domain ownership
   - Once verified, domain will be active
   - Update can take up to 48 hours

### 3. Move SNS Out of Sandbox (Request Increase)

**Why:** SNS starts in sandbox mode, only allowing SMS to verified phone numbers. To send SMS to any number, request production access.

1. **Go to AWS SNS Console**
   - Navigate to: https://console.aws.amazon.com/sns/
   - Select your region (e.g., `us-east-1`)

2. **Request Production Access**
   - Go to "Text messaging (SMS)" → "Account preferences"
   - Click "Request production access"
   - Fill out the form:
     - **Use case**: "Automated trading signal notifications for cryptocurrency rotation strategy"
     - **Website URL**: `https://btcrotator.com`
     - **Sample messages**: 
       ```
       BTC ROTATOR: SELL BTC-USD → BUY MSTR | Entertainment only. Not advice.
       ```
     - **Opt-out instructions**: "Reply STOP to unsubscribe"
     - **Monthly volume**: Estimate your expected SMS volume
   - Submit request

3. **Wait for Approval**
   - AWS typically reviews within 24-48 hours
   - You'll receive email when approved
   - Once approved, SMS can be sent to any phone number

4. **Verify Current Status**
   - Check "Account preferences" → "SMS sandbox"
   - If still in sandbox, you can only send to verified numbers

### 4. Verify Phone Numbers (For Testing)

**While in SNS Sandbox**, you must verify phone numbers:

1. **In SNS Console**
   - Go to "Text messaging (SMS)" → "Phone numbers"
   - Click "Add phone number"
   - Enter phone number in E.164 format: `+1234567890`
   - Click "Add phone number"

2. **Verify via SMS**
   - AWS will send verification code via SMS
   - Enter code in console to verify
   - Verified numbers can receive SMS in sandbox mode

3. **For Production**
   - Once SNS is out of sandbox, verification not needed
   - Can send to any phone number

### 5. Test Full Flow (Fake User → Trial → Paywall)

#### Step 1: Create Test User

1. **Sign Up**
   - Go to your deployed app: `https://btcrotator.com`
   - Click "Create account"
   - Use test email: `test@example.com`
   - Use verified phone number (if in SNS sandbox)
   - Complete signup

2. **Verify User Created**
   - Check DynamoDB Console → `User` table
   - Find user record with:
     - `email`: `test@example.com`
     - `isPaid`: `false` (unless email is `you@btcrotator.com` or `brother@example.com`)
     - `signupDate`: Current timestamp

#### Step 2: Test Trial Period (< 7 days)

1. **Access App**
   - Login with test user
   - Should have full access to:
     - Dashboard
     - Portfolio
     - Settings

2. **Verify Trial Status**
   - Check DynamoDB `User` table
   - `signupDate` should be recent
   - `isPaid` should be `false`
   - User should NOT be redirected to `/upgrade`

#### Step 3: Simulate Trial Expiration

1. **Manually Update User in DynamoDB**
   - Go to DynamoDB Console → `User` table
   - Find test user record
   - Click "Edit item"
   - Update `signupDate` to 8 days ago:
     ```json
     {
       "signupDate": {
         "S": "2024-11-01T00:00:00Z"
       }
     }
     ```
   - Save changes

2. **Test Paywall**
   - Refresh app or navigate to any page
   - Should be automatically redirected to `/upgrade`
   - Should see: "Your 7-day trial has ended"
   - Should see mailto link to join waitlist

3. **Verify Access Blocked**
   - Try navigating to `/dashboard` directly
   - Should redirect back to `/upgrade`
   - User cannot access protected pages

#### Step 4: Test Paid User

1. **Update User to Paid**
   - In DynamoDB Console → `User` table
   - Edit test user
   - Set `isPaid` to `true`:
     ```json
     {
       "isPaid": {
         "BOOL": true
       }
     }
     ```

2. **Verify Full Access**
   - Refresh app
   - Should have full access to all pages
   - No redirect to `/upgrade`

#### Step 5: Test Special Paid Emails

1. **Create User with Special Email**
   - Sign up with: `you@btcrotator.com`
   - Check DynamoDB
   - `isPaid` should be automatically set to `true`
   - Same for `brother@example.com`

### 6. How to Trigger Manual Backtest

#### Option 1: Via AWS Lambda Console

1. **Go to Lambda Console**
   - Navigate to: https://console.aws.amazon.com/lambda/
   - Find function: `backtest-{environment}`

2. **Test Function**
   - Click on function → "Test" tab
   - Create new test event:
     ```json
     {}
     ```
   - Click "Test"
   - View execution results
   - Check CloudWatch logs for output

3. **View Results**
   - Results are cached in S3 bucket: `btc-rotator-backtest`
   - Check S3 Console for `backtest_results.json`
   - Or view in Lambda response

#### Option 2: Via API Gateway (If Configured)

1. **Get API Endpoint**
   - In Amplify Console → "Backend environments"
   - Find API Gateway endpoint URL
   - Or check `amplify_outputs.json`

2. **Call API**
   ```bash
   curl -X POST https://your-api-id.execute-api.region.amazonaws.com/backtest \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

3. **View Response**
   - Returns JSON with:
     - `results`: Array of `{date, rotatorValue, btcValue}`
     - `summary`: Performance metrics
     - `cached`: Whether results came from cache

#### Option 3: Via AppSync (Recommended)

1. **In AppSync Console**
   - Navigate to: https://console.aws.amazon.com/appsync/
   - Select your API
   - Go to "Queries" tab

2. **Create Query/Mutation**
   - If you've added backtest to GraphQL schema:
     ```graphql
     query GetBacktest {
       backtest {
         results {
           date
           rotatorValue
           btcValue
         }
         summary {
           totalReturn
           btcReturn
         }
       }
     }
     ```

3. **Execute Query**
   - Click "Play" button
   - View results in response panel

#### Option 4: Direct Lambda Invocation (CLI)

```bash
aws lambda invoke \
  --function-name backtest-{environment} \
  --payload '{}' \
  --region us-east-1 \
  response.json

cat response.json
```

## 🔐 Environment Variables

The following environment variables are automatically set by Amplify:

- `USER_TABLE_NAME`: DynamoDB User table name
- `AWS_REGION`: AWS region
- `AWS_ACCOUNT_ID`: AWS account ID

## 📊 Supported Tickers

The following tickers are hardcoded throughout the application:

- BTC-USD, MSTR, SMLR, ASST, MARA, RIOT, COIN, HUT, CLSK, BITF, WULF, CORZ, IREN, CIFR, BTBT

## 🔔 Notification Setup

### Email (SES)

1. **Verify Sender Email**
   - Go to SES Console: https://console.aws.amazon.com/ses/
   - Verify email: `noreply@btcrotator.com`
   - Click verification link in email

2. **Move Out of Sandbox (If Needed)**
   - Request production access if sending to unverified emails
   - Fill out use case form
   - Wait for approval

### SMS (SNS)

- See section 3 above for moving out of sandbox
- Phone numbers must be in E.164 format: `+1234567890`

## 🧪 Testing Checklist

- [ ] User signup creates DynamoDB record
- [ ] Paid emails (`you@btcrotator.com`, `brother@example.com`) get `isPaid = true`
- [ ] Trial users (< 7 days) have full access
- [ ] Expired trial users (> 7 days) redirect to `/upgrade`
- [ ] Paid users have full access
- [ ] Rotation signal triggers notifications (SMS + Email)
- [ ] Backtest returns data
- [ ] Dashboard displays rotation signals
- [ ] Portfolio saves correctly
- [ ] Settings save correctly
- [ ] Mobile responsive on iPhone
- [ ] Loading spinners appear everywhere
- [ ] Favicon displays correctly

## 🐛 Troubleshooting

### Backend Not Deploying

- Check Amplify build logs
- Verify `amplify.yml` syntax
- Ensure Python 3.12 is available in build environment
- Check IAM permissions for Amplify service role

### SNS SMS Not Sending

- Verify phone number is in E.164 format
- Check if still in sandbox (must verify numbers)
- Review CloudWatch logs for Lambda function
- Check SNS spending limits

### SES Email Not Sending

- Verify sender email in SES
- Check if in sandbox mode
- Review SES sending limits
- Check CloudWatch logs

### Auth Guard Not Working

- Verify User table exists in DynamoDB
- Check user record has `signupDate` field
- Review CloudWatch logs for errors
- Ensure AppSync permissions are correct

## 📝 License

Entertainment purposes only. Not financial advice.

## 🔗 Links

- **Production**: https://btcrotator.com
- **GitHub**: https://github.com/prestonppratt/btc-rotator
- **AWS Amplify Console**: https://console.aws.amazon.com/amplify/
