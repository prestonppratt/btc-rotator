import { useState, useRef, useEffect } from 'react';
import { signIn, confirmSignIn, signOut, signUp } from 'aws-amplify/auth';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface PasswordlessSignInProps {
  onSignIn?: () => void;
}

type LoginStep = 'email' | 'otp';

export function PasswordlessSignIn({ onSignIn }: PasswordlessSignInProps) {
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<LoginStep>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Handle OTP input changes
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(0, 1);
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);

    // Auto-advance
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
    let pass = '';
    for (let i = 0; i < 32; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // ensure at least one upper, lower, number, special
    return pass + 'A1!a';
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // 1. Attempt to sign up the user.
      // If they already exist, this throws UsernameExistsException, which we catch and ignore.
      try {
        await signUp({
          username: email,
          password: generateRandomPassword(),
          options: {
            userAttributes: {
              email: email,
            },
            autoSignIn: false, // We will manually sign them in via custom auth next
          },
        });
        console.log('User signed up successfully (auto-confirmed by preSignUp handler).');
      } catch (err: unknown) {
        const signUpErr = err as Error;
        if (signUpErr.name === 'UsernameExistsException') {
          console.log('User already exists, proceeding to sign in.');
        } else {
          throw signUpErr; // Re-throw other errors
        }
      }

      // 2. Sign in with Custom Auth (triggers emailOTP Lambda)
      const output = await signIn({
        username: email,
        options: {
          authFlowType: 'CUSTOM_WITHOUT_SRP'
        }
      });

      if (output.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE') {
        setStep('otp');
      } else if (output.isSignedIn) {
        if (onSignIn) onSignIn();
        else window.location.reload();
      }
    } catch (err: unknown) {
      const signInErr = err as Error;
      console.error('Sign in error:', signInErr);
      // If user session is stuck, sign out and retry once
      if (signInErr.name === 'UserAlreadyAuthenticatedException') {
        try {
          await signOut();
          await handleEmailSubmit(e);
          return;
        } catch (signOutErr) {
          console.error('Failed to sign out to retry:', signOutErr);
        }
      }

      setError(signInErr.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) return;

    setIsLoading(true);
    setError(null);

    try {
      const { isSignedIn } = await confirmSignIn({ challengeResponse: code });
      if (isSignedIn) {
        if (onSignIn) onSignIn();
        else window.location.reload();
      }
    } catch (err: unknown) {
      console.error('OTP error:', err);
      setError('Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-submit OTP when filled
  useEffect(() => {
    if (otpCode.every(d => d !== '')) {
      handleOtpSubmit();
    }
  }, [otpCode, handleOtpSubmit]);

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-[440px] p-8 relative shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Close Button */}
        <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <XMarkIcon className="w-6 h-6" />
        </button>

        {/* Header Icon */}
        <div className="flex justify-center mb-6">
          <img
            src="/btc-rotator-logo.jpg"
            alt="BTC Rotator Logo"
            className="w-24 h-24 rounded-xl object-cover shadow-lg"
          />
        </div>

        {step === 'email' && (
          <>
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Sign in to BTC Rotator
            </h2>
            <p className="text-center text-gray-600 mb-8">
              Enter your email to receive a 6-digit login code.
            </p>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6719] focus:border-transparent text-gray-900 placeholder-gray-500"
                required
                autoFocus
              />

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#0A84FF] text-white font-semibold py-3.5 rounded-xl hover:bg-[#0066CC] transition-colors disabled:opacity-70 shadow-sm"
              >
                {isLoading ? 'Sending Code...' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <>
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Check your email
            </h2>
            <p className="text-center text-gray-600 mb-8 px-4">
              We've sent an email to {email}. Enter the 6-digit code below:
            </p>

            <div className="flex justify-center gap-2 mb-8">
              {otpCode.map((digit, index) => (
                <input
                  key={index}
                  ref={el => otpRefs.current[index] = el}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-12 h-14 bg-white border border-gray-300 rounded-lg text-center text-2xl font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0A84FF] focus:border-transparent transition-all"
                />
              ))}
            </div>

            <div className="text-center">
              <p className="text-gray-500 text-sm">
                Didn't get the email? <button onClick={() => setStep('email')} className="text-[#0A84FF] hover:underline font-medium">Try again</button>
              </p>
            </div>
          </>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
