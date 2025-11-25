import { DefineAuthChallengeTriggerHandler, CreateAuthChallengeTriggerHandler, VerifyAuthChallengeResponseTriggerHandler } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// AWS_REGION is automatically available in Lambda runtime
const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Define what challenge to present to the user
const defineAuthChallenge = async (event: any) => {
  // If user is not found, fail the challenge
  if (event.request.userNotFound) {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
    return event;
  }

  // If user's email is not verified, fail the challenge
  if (!event.request.userAttributes?.email_verified) {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
    return event;
  }

  // If user just started authentication (no session yet), present custom challenge
  if (event.request.session.length === 0) {
    event.response.issueTokens = false;
    event.response.challengeName = 'CUSTOM_CHALLENGE';
    return event;
  }

  // If user has completed the challenge, issue tokens
  const lastChallenge = event.request.session[event.request.session.length - 1];
  if (lastChallenge.challengeName === 'CUSTOM_CHALLENGE' && lastChallenge.challengeResult === true) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
    return event;
  }

  // Otherwise, present the challenge again
  event.response.issueTokens = false;
  event.response.challengeName = 'CUSTOM_CHALLENGE';
  return event;
};

// Create the challenge - generate OTP and send email
const createAuthChallenge = async (event: any) => {
  if (event.request.challengeName === 'CUSTOM_CHALLENGE') {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with expiration timestamp (15 minutes = 900000 ms)
    const expirationTime = Date.now() + 15 * 60 * 1000;

    // Store OTP and expiration in private challenge parameters (encrypted)
    event.response.privateChallengeParameters = {
      otp: otp,
      expirationTime: expirationTime.toString(),
    };

    // Don't send OTP in public challenge parameters (security)
    event.response.challengeMetadata = 'OTP_CHALLENGE';

    // Send email with OTP
    const email = event.request.userAttributes.email;
    const subject = 'Your BTC Rotator Verification Code';

    // Plain text body for better deliverability
    const textBody = `Your verification code is: ${otp}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this code, please ignore this email.`;

    // HTML body with JSON-LD schema for Gmail
    const body = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "http://schema.org",
            "@type": "EmailMessage",
            "potentialAction": {
              "@type": "ViewAction",
              "target": "http://localhost:3001",
              "name": "Verify Email"
            },
            "description": "Your verification code for BTC Rotator"
          }
          </script>
        </head>
        <body style="font-family: sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #000;">Verification Code</h2>
            <p>Your 6-digit verification code is:</p>
            <p style="font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">${otp}</p>
            <p>This code will expire in 15 minutes.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888;">If you didn't request this code, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    try {
      // Use SES to send email with OTP
      // Note: SES email address needs to be verified in AWS Console
      // For sandbox, you may need to verify your email in SES first
      const fromEmail = process.env.SES_FROM_EMAIL || process.env.AWS_SES_FROM_EMAIL || 'noreply@amplifyapp.com';
      const friendlyName = 'BTC Rotator';
      const source = `${friendlyName} <${fromEmail}>`;

      await sesClient.send(new SendEmailCommand({
        Source: source,
        Destination: {
          ToAddresses: [email],
        },
        ReplyToAddresses: [fromEmail],
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: body,
              Charset: 'UTF-8',
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          },
        },
      }));
      console.log(`OTP email sent to ${email}`);
    } catch (error) {
      console.error('Error sending email via SES:', error);
      // If SES fails, we could fall back to Cognito's email, but for custom auth
      // we need to send the OTP ourselves. Log the error for debugging.
      // The authentication will still proceed, but user won't get the code.
    }
  }

  return event;
};

// Verify the challenge response
const verifyAuthChallengeResponse = async (event: any) => {
  const expectedAnswer = event.request.privateChallengeParameters?.otp;
  const expirationTime = event.request.privateChallengeParameters?.expirationTime;
  const providedAnswer = event.request.challengeAnswer;

  // Check if OTP is expired (15 minutes)
  if (expirationTime && Date.now() > parseInt(expirationTime)) {
    event.response.answerCorrect = false;
    return event;
  }

  // Verify OTP matches
  if (expectedAnswer && providedAnswer === expectedAnswer) {
    event.response.answerCorrect = true;
  } else {
    event.response.answerCorrect = false;
  }

  return event;
};

// Main handler that routes based on trigger source
export const handler = async (event: any) => {
  // Route to appropriate handler based on trigger source
  if (event.triggerSource === 'DefineAuthChallenge_Authentication') {
    return await defineAuthChallenge(event);
  } else if (event.triggerSource === 'CreateAuthChallenge_Authentication') {
    return await createAuthChallenge(event);
  } else if (event.triggerSource === 'VerifyAuthChallengeResponse_Authentication') {
    return await verifyAuthChallengeResponse(event);
  }

  // Fallback - try to determine from event structure
  if (event.request && event.request.challengeName) {
    // This is CreateAuthChallenge or VerifyAuthChallengeResponse
    if (event.request.challengeAnswer !== undefined) {
      return await verifyAuthChallengeResponse(event);
    } else {
      return await createAuthChallenge(event);
    }
  } else if (event.request && event.request.session !== undefined) {
    // This is DefineAuthChallenge
    return await defineAuthChallenge(event);
  }

  // Unknown trigger type
  throw new Error(`Unknown trigger source: ${event.triggerSource || 'unknown'}`);
};

