import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Frontend-only MVP - backend will be added later
export function useAuthGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [shouldRedirect, useState] = useState(false);

  useEffect(() => {
    // Stub for MVP - no auth checking yet
    setIsLoading(false);
  }, [navigate, location.pathname]);

  return { isLoading, shouldRedirect };
}
