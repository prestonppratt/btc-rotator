import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import Dashboard from './components/Dashboard';
import Portfolio from './pages/Portfolio';
import Settings from './pages/Settings';
import Upgrade from './pages/Upgrade';
import Disclaimer from './pages/Disclaimer';
import Footer from './components/Footer';
import { useAuthGuard } from './hooks/useAuthGuard';

type Page = 'dashboard' | 'portfolio' | 'settings';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, shouldRedirect } = useAuthGuard();
  const location = useLocation();

  // Don't apply guard on upgrade page
  if (location.pathname === '/upgrade') {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner w-12 h-12 border-4"></div>
          <div className="text-white text-xl">Loading...</div>
        </div>
      </div>
    );
  }

  if (shouldRedirect) {
    return <Navigate to="/upgrade" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const location = useLocation();

  // Update current page based on route
  useEffect(() => {
    if (location.pathname === '/dashboard' || location.pathname === '/') {
      setCurrentPage('dashboard');
    } else if (location.pathname === '/portfolio') {
      setCurrentPage('portfolio');
    } else if (location.pathname === '/settings') {
      setCurrentPage('settings');
    }
  }, [location]);

  return (
    <Authenticator
      loginMechanisms={['email', 'phone_number']}
      signUpAttributes={['email', 'phone_number']}
      components={{
        Header() {
          return (
            <div className="text-right mb-4">
              <p className="text-xs text-gray-500">
                Entertainment only • Not advice • At your own risk
              </p>
            </div>
          );
        },
      }}
    >
      {({ signOut, user }) => (
        <ProtectedLayout>
          {location.pathname === '/upgrade' ? (
            <>
              <Upgrade />
              <Footer />
            </>
          ) : (
            <div className="min-h-screen bg-black flex flex-col">
              <header className="bg-gray-900 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-btc-orange">BTC Rotator</h1>
                      <p className="text-xs sm:text-sm text-gray-400">Bitcoin Ticker Rotation Tool</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                      <span className="text-xs text-gray-500 hidden md:block">
                        Entertainment only • Not advice • At your own risk
                      </span>
                      <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
                        <span className="text-xs sm:text-sm text-gray-300 truncate max-w-[150px] sm:max-w-none">
                          {user?.signInDetails?.loginId || user?.username}
                        </span>
                        <button
                          onClick={signOut}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm rounded-lg transition-colors whitespace-nowrap"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </header>

              {/* Navigation */}
              <nav className="bg-gray-800 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
                  <div className="flex space-x-1 overflow-x-auto">
                    <button
                      onClick={() => {
                        setCurrentPage('dashboard');
                        window.history.pushState({}, '', '/dashboard');
                      }}
                      className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                        currentPage === 'dashboard'
                          ? 'bg-gray-900 text-btc-orange border-b-2 border-btc-orange'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                    >
                      Dashboard
                    </button>
                    <button
                      onClick={() => {
                        setCurrentPage('portfolio');
                        window.history.pushState({}, '', '/portfolio');
                      }}
                      className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                        currentPage === 'portfolio'
                          ? 'bg-gray-900 text-btc-orange border-b-2 border-btc-orange'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                    >
                      Portfolio
                    </button>
                    <button
                      onClick={() => {
                        setCurrentPage('settings');
                        window.history.pushState({}, '', '/settings');
                      }}
                      className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                        currentPage === 'settings'
                          ? 'bg-gray-900 text-btc-orange border-b-2 border-btc-orange'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                    >
                      Settings
                    </button>
                  </div>
                </div>
              </nav>

              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/portfolio" element={<Portfolio />} />
                  <Route
                    path="/settings"
                    element={
                      <Settings
                        userPhone={
                          user?.signInDetails?.loginId?.includes('+')
                            ? user.signInDetails.loginId
                            : undefined
                        }
                      />
                    }
                  />
                </Routes>
              </main>
              <Footer />
            </div>
          )}
        </ProtectedLayout>
      )}
    </Authenticator>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/upgrade" element={<><Upgrade /><Footer /></>} />
        <Route path="/disclaimer" element={<><Disclaimer /><Footer /></>} />
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

