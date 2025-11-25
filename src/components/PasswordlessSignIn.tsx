import { useState, useRef, useEffect } from 'react';
import { signIn, confirmSignIn, signOut, signUp, confirmSignUp, type SignUpOutput } from 'aws-amplify/auth';
import { XMarkIcon, EnvelopeIcon, UserPlusIcon } from '@heroicons/react/24/outline';

interface PasswordlessSignInProps {
  onSignIn?: () => void;
}

type LoginStep = 'email' | 'otp' | 'password' | 'signup' | 'confirm_signup';

export function PasswordlessSignIn({ onSignIn }: PasswordlessSignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const output = await signIn({
        username: email,
        options: {
          authFlowType: 'CUSTOM_WITHOUT_SRP'
        }
      });

      if (output.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE') {
        setStep('otp');
      } else if (output.isSignedIn) {
        window.location.reload();
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      if (err.name === 'UserAlreadyAuthenticatedException') {
        await signOut();
        handleEmailSubmit(e); // Retry
        return;
      }
      // If user not found or other error, we might want to suggest sign up, but for now just show error
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const output = await signIn({
        username: email,
        password: password,
      });

      if (output.isSignedIn) {
        if (onSignIn) onSignIn();
        else window.location.reload();
      }
    } catch (err: any) {
      console.error('Password sign in error:', err);
      setError('Incorrect email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const output = await signUp({
        username: email,
        password: password,
        options: {
          userAttributes: {
            email,
          },
          autoSignIn: true,
        },
      });

      if (output.nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        setStep('confirm_signup');
        setOtpCode(['', '', '', '', '', '']); // Reset OTP for confirmation
      } else if (output.isSignUpComplete) {
        if (onSignIn) onSignIn();
        else window.location.reload();
      }
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message || 'Failed to create account.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSignUpSubmit = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) return;

    setIsLoading(true);
    setError(null);

    try {
      const output = await confirmSignUp({
        username: email,
        confirmationCode: code
      });

      if (output.isSignUpComplete) {
        // Auto sign in should handle it, but if not we can try to sign in
        try {
          const signInOutput = await signIn({ username: email, password });
          if (signInOutput.isSignedIn) {
            if (onSignIn) onSignIn();
            else window.location.reload();
            return;
          }
        } catch (signInErr) {
          console.error('Auto sign in failed:', signInErr);
          // Fallback to password login screen
          setStep('password');
          setError('Account created! Please sign in.');
        }
      }
    } catch (err: any) {
      console.error('Confirmation error:', err);
      setError('Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (step === 'confirm_signup') {
      await handleConfirmSignUpSubmit();
      return;
    }

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
    } catch (err: any) {
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
  }, [otpCode]);

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
              First time here? <button onClick={() => setStep('signup')} className="text-[#FF6719] hover:underline font-medium">Create account</button>
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
                className="w-full bg-[#FF6719] text-white font-bold py-3 rounded-lg hover:bg-[#E5560E] transition-colors disabled:opacity-70"
              >
                {isLoading ? 'Loading...' : 'Continue'}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>

            <button
              onClick={() => setStep('password')}
              className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Sign in with password
            </button>
          </>
        )}

        {step === 'password' && (
          <>
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
              Sign in with password
            </h2>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6719] focus:border-transparent text-gray-900 placeholder-gray-500"
                required
                autoFocus
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6719] focus:border-transparent text-gray-900 placeholder-gray-500"
                required
                autoFocus
              />

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#FF6719] text-white font-bold py-3 rounded-lg hover:bg-[#E5560E] transition-colors disabled:opacity-70"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>

              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full text-gray-500 text-sm hover:text-gray-700 mt-4"
              >
                ← Back to email login
              </button>
            </form>
          </>
        )}

        {step === 'signup' && (
          <>
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
              Create Account
            </h2>

            <form onSubmit={handleSignUpSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6719] focus:border-transparent text-gray-900 placeholder-gray-500"
                required
                autoFocus
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6719] focus:border-transparent text-gray-900 placeholder-gray-500"
                required
                minLength={8}
              />

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#FF6719] text-white font-bold py-3 rounded-lg hover:bg-[#E5560E] transition-colors disabled:opacity-70"
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </button>

              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full text-gray-500 text-sm hover:text-gray-700 mt-4"
              >
                ← Back to sign in
              </button>
            </form>
          </>
        )}

        {(step === 'otp' || step === 'confirm_signup') && (
          <>
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
              {step === 'confirm_signup' ? 'Verify your email' : 'Check your email to continue'}
            </h2>
            <p className="text-center text-gray-600 mb-8 px-4">
              We've sent an email to {email}. {step === 'confirm_signup' ? 'Enter the verification code below:' : 'Click the magic link or enter the code below:'}
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
                  className="w-12 h-14 bg-white border border-gray-300 rounded-lg text-center text-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF6719] focus:border-transparent"
                />
              ))}
            </div>

            <div className="text-center">
              <p className="text-gray-500 text-sm">
                Didn't get the email? <button onClick={() => setStep('email')} className="text-[#FF6719] hover:underline font-medium">Try again</button>
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
