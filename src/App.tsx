import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import { signOut, getCurrentUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import '@aws-amplify/ui-react/styles.css';
import { PasswordlessSignIn } from './components/PasswordlessSignIn';
import Dashboard from './components/Dashboard';
import Portfolio from './pages/Portfolio';
import Quant from './pages/Quant';
import Settings from './pages/Settings';
import RecommendationHistory from './pages/RecommendationHistory';
import Upgrade from './pages/Upgrade';
import Disclaimer from './pages/Disclaimer';
import Footer from './components/Footer';
import { useAuthGuard } from './hooks/useAuthGuard';
import { MurmurationBackground } from './components/MurmurationBackground';
import { FaWhatsapp } from 'react-icons/fa';
import { SiSubstack } from 'react-icons/si';
import { DenominationProvider } from './contexts/DenominationContext';


type Page = 'dashboard' | 'stack' | 'quant' | 'recommendations' | 'settings';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuthGuard();
  // Frontend-only MVP - auth guard disabled

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }

  return <>{children}</>;
}

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  useEffect(() => {
    if (location.pathname === '/dashboard' || location.pathname === '/') {
      setCurrentPage('dashboard');
    } else if (location.pathname === '/stack') {
      setCurrentPage('stack');
    } else if (location.pathname === '/quant') {
      setCurrentPage('quant');
    } else if (location.pathname === '/recommendations') {
      setCurrentPage('recommendations');
    } else if (location.pathname === '/settings') {
      setCurrentPage('settings');
    }
  }, [location.pathname]);

  const handleNav = (page: Page, path: string) => {
    setCurrentPage(page);
    navigate(path);
  };

  return (
    <>
      {/* Header */}
      <header className="glass-nav sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="text-xl font-bold text-white tracking-tight flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span>₿</span> BTC Rotator
            </Link>
            <nav className="hidden md:flex space-x-1">
              <button
                onClick={() => handleNav('dashboard', '/dashboard')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${currentPage === 'dashboard'
                  ? 'bg-[#2C2C2E] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                Command Deck
              </button>
              <button
                onClick={() => handleNav('stack', '/stack')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${currentPage === 'stack'
                  ? 'bg-[#2C2C2E] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                Stack
              </button>
              <button
                onClick={() => handleNav('quant', '/quant')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${currentPage === 'quant'
                  ? 'bg-[#2C2C2E] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                Quant
              </button>
              <a
                href="https://www.peerrotator.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-gray-400 hover:text-white hover:bg-white/5"
              >
                <SiSubstack className="w-4 h-4 mr-2" />
                <span>Peer Rotator</span>
              </a>
              <a
                href="https://chat.whatsapp.com/J485np70u9NBCGbE6rjRKe"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-gray-400 hover:text-white hover:bg-white/5"
              >
                <FaWhatsapp className="w-4 h-4 mr-2" />
                <span>WhatsApp</span>
              </a>
              <button
                onClick={() => handleNav('settings', '/settings')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${currentPage === 'settings'
                  ? 'bg-[#2C2C2E] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                Settings
              </button>
              <button
                onClick={() => handleNav('recommendations', '/recommendations')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${currentPage === 'recommendations'
                  ? 'bg-[#2C2C2E] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                History
              </button>
            </nav>
            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={async () => {
                  try {
                    await signOut();
                  } catch (error) {
                    console.error('Error signing out:', error);
                  }
                }}
                className="px-3 py-1.5 text-sm font-medium text-gray-400 hover:text-white transition-colors bg-white/5 rounded-md hover:bg-[#FF3B30]/20 hover:text-[#FF3B30]"
              >
                Sign Out
              </button>
              <div className="text-xs text-gray-500">
                Entertainment only • Not advice
              </div>
            </div>
          </div>
        </div>
      </header >

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-nav z-50 pb-safe">
        <div className="flex justify-around items-center h-16">
          <button
            onClick={() => handleNav('dashboard', '/dashboard')}
            className={`flex-1 h-full flex flex-col items-center justify-center transition-colors text-xs font-medium ${currentPage === 'dashboard' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            Command Deck
          </button>
          <button
            onClick={() => handleNav('stack', '/stack')}
            className={`flex-1 h-full flex flex-col items-center justify-center transition-colors text-xs font-medium ${currentPage === 'stack' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            Stack
          </button>
          <button
            onClick={() => handleNav('quant', '/quant')}
            className={`flex-1 h-full flex flex-col items-center justify-center transition-colors text-xs font-medium ${currentPage === 'quant' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            Quant
          </button>
          <button
            onClick={() => handleNav('recommendations', '/recommendations')}
            className={`flex-1 h-full flex flex-col items-center justify-center transition-colors text-xs font-medium ${currentPage === 'recommendations' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            History
          </button>
          <button
            onClick={() => handleNav('settings', '/settings')}
            className={`flex-1 h-full flex flex-col items-center justify-center transition-colors text-xs font-medium ${currentPage === 'settings' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            Settings
          </button>
          <button
            onClick={async () => {
              try {
                await signOut();
              } catch (error) {
                console.error('Error signing out:', error);
              }
            }}
            className="flex-1 h-full flex flex-col items-center justify-center text-xs font-medium text-gray-500 hover:text-[#FF3B30]"
          >
            Sign Out
          </button>
        </div>
      </nav >
    </>
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      <div className="min-h-screen text-white flex flex-col relative">
        <MurmurationBackground />
        <div className="relative z-20 flex flex-col min-h-screen">
          <Navigation />
          {/* Main Content */}
          <main className="flex-1 pb-16 md:pb-0">
            <ProtectedLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/stack" element={<Portfolio />} />
                <Route path="/quant" element={<Quant />} />
                <Route path="/recommendations" element={<RecommendationHistory />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/upgrade" element={<Upgrade />} />
                <Route path="/disclaimer" element={<Disclaimer />} />
              </Routes>
            </ProtectedLayout>
          </main>
          {/* Footer */}
          <Footer />
        </div>
      </div>
    </BrowserRouter>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check if auth is disabled via environment variable
  // @ts-ignore - Vite env vars
  const authDisabled = import.meta.env.VITE_DISABLE_AUTH === 'true';

  useEffect(() => {
    // If auth is disabled, skip authentication check
    if (authDisabled) {
      setIsAuthenticated(true);
      return;
    }

    // Check if user is already authenticated
    getCurrentUser()
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false));

    // Listen for auth events
    const listener = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          setIsAuthenticated(true);
          break;
        case 'signedOut':
          setIsAuthenticated(false);
          break;
      }
    });

    return () => listener();
  }, [authDisabled]);

  // Show loading while checking auth status
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }

  // If not authenticated and auth is enabled, show passwordless sign-in
  if (!isAuthenticated && !authDisabled) {
    return (
      <div className="relative min-h-screen bg-[#0A0A0A]">
        <MurmurationBackground />
        <div className="relative z-20">
          <PasswordlessSignIn onSignIn={() => setIsAuthenticated(true)} />
        </div>
      </div>
    );
  }

  return (
    <DenominationProvider>
      <AppContent />
    </DenominationProvider>
  );
}

export default App;
