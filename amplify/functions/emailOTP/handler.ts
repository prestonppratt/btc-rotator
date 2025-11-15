import { DefineAuthChallengeTriggerHandler, CreateAuthChallengeTriggerHandler, VerifyAuthChallengeResponseTriggerHandler } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Define what challenge to present to the user
export const defineAuthChallenge: DefineAuthChallengeTriggerHandler = async (event) => {
  // If user is not confirmed, fail the challenge
  if (event.request.userNotFound || !event.request.userAttributes?.email_verified) {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
    return event;
  }

  // If user just signed up, issue tokens (they're already verified via email)
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
export const createAuthChallenge: CreateAuthChallengeTriggerHandler = async (event) => {
  if (event.request.challengeName === 'CUSTOM_CHALLENGE') {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in private challenge parameters (encrypted)
    event.response.privateChallengeParameters = {
      otp: otp,
    };
    
    // Don't send OTP in public challenge parameters (security)
    event.response.challengeMetadata = 'OTP_CHALLENGE';

    // Send email with OTP
    const email = event.request.userAttributes.email;
    const subject = 'Your Login Code';
    const body = `
      <html>
        <body>
          <h2>Your Login Code</h2>
          <p>Your 6-digit login code is: <strong>${otp}</strong></p>
          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </body>
      </html>
    `;

    try {
      await sesClient.send(new SendEmailCommand({
        Source: process.env.SES_FROM_EMAIL || 'noreply@yourdomain.com',
        Destination: {
          ToAddresses: [email],
        },
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
          },
        },
      }));
    } catch (error) {
      console.error('Error sending email:', error);
      // Don't fail authentication if email fails, but log it
    }
  }

  return event;
};

// Verify the challenge response
export const verifyAuthChallengeResponse: VerifyAuthChallengeResponseTriggerHandler = async (event) => {
  const expectedAnswer = event.request.privateChallengeParameters?.otp;
  const providedAnswer = event.request.challengeAnswer;

  if (expectedAnswer && providedAnswer === expectedAnswer) {
    event.response.answerCorrect = true;
  } else {
    event.response.answerCorrect = false;
  }

  return event;
};

