import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export function useAuthGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    // Don't check auth on upgrade page
    if (location.pathname === '/upgrade') {
      setIsLoading(false);
      return;
    }

    const checkUserStatus = async () => {
      try {
        const user = await getCurrentUser();
        
        // Fetch user data from DynamoDB
        try {
          const userData = await client.models.User.get({ id: user.userId });
          
          if (userData.data) {
            const isPaid = userData.data.isPaid || false;
            const signupDateStr = userData.data.signupDate;
            
            if (!isPaid && signupDateStr) {
              // Parse signup date
              const signupDate = new Date(signupDateStr);
              const now = new Date();
              const daysSinceSignup = Math.floor(
                (now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24)
              );
              
              // If more than 7 days and not paid, redirect to upgrade
              if (daysSinceSignup > 7) {
                setShouldRedirect(true);
                navigate('/upgrade', { replace: true });
                return;
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          // If we can't fetch user data, allow access (fail open)
        }
      } catch (error) {
        console.error('Error checking user status:', error);
        // If user is not authenticated, Authenticator will handle it
      } finally {
        setIsLoading(false);
      }
    };

    checkUserStatus();
  }, [navigate, location.pathname]);

  return { isLoading, shouldRedirect };
}

