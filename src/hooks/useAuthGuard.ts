import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
const IS_LOCALHOST =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export function useAuthGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      setIsLoading(true);
      setShouldRedirect(false);

      try {
        const user = await getCurrentUser();
        const result = await client.models.User.get({ id: user.userId });
        let userData = result.data;

        // Provision a user record on first login so trial logic has a consistent baseline.
        if (!userData) {
          const created = await client.models.User.create({
            id: user.userId,
            email: user.signInDetails?.loginId || user.username || user.userId,
            signupDate: new Date().toISOString(),
            notificationFreq: 'weekly',
            isPaid: false,
          });
          userData = created.data ?? null;
        }

        if (!mounted || !userData?.signupDate) {
          return;
        }

        // Paywall disabled: always route away from upgrade screen.
        if (IS_LOCALHOST || location.pathname === '/upgrade') {
          navigate('/dashboard', { replace: true });
        }
      } catch {
        // App-level auth gate handles unauthenticated users.
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [navigate, location.pathname]);

  return { isLoading, shouldRedirect };
}
