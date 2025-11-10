import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
// Frontend-only MVP - auth will be added later
import Dashboard from './components/Dashboard';
import Portfolio from './pages/Portfolio';
import Settings from './pages/Settings';
import Upgrade from './pages/Upgrade';
import Disclaimer from './pages/Disclaimer';
import Footer from './components/Footer';
import { useAuthGuard } from './hooks/useAuthGuard';

type Page = 'dashboard' | 'portfolio' | 'settings';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuthGuard();
  // Frontend-only MVP - auth guard disabled

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-neon-green text-xl">Loading...</div>
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
    } else if (location.pathname === '/portfolio') {
      setCurrentPage('portfolio');
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
      <header className="border-b border-gray-800 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="text-2xl font-bold text-neon-green hover:text-neon-green-dark">
              BTC Rotator
            </Link>
            <nav className="hidden md:flex space-x-6">
              <button
                onClick={() => handleNav('dashboard', '/dashboard')}
                className={`px-3 py-2 rounded transition-colors ${
                  currentPage === 'dashboard'
                    ? 'bg-neon-green text-black'
                    : 'text-gray-400 hover:text-neon-green'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => handleNav('portfolio', '/portfolio')}
                className={`px-3 py-2 rounded transition-colors ${
                  currentPage === 'portfolio'
                    ? 'bg-neon-green text-black'
                    : 'text-gray-400 hover:text-neon-green'
                }`}
              >
                Portfolio
              </button>
              <button
                onClick={() => handleNav('settings', '/settings')}
                className={`px-3 py-2 rounded transition-colors ${
                  currentPage === 'settings'
                    ? 'bg-neon-green text-black'
                    : 'text-gray-400 hover:text-neon-green'
                }`}
              >
                Settings
              </button>
            </nav>
            <div className="hidden md:block text-xs text-gray-500">
              Entertainment only • Not advice • At your own risk
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 z-50">
        <div className="flex justify-around items-center h-16">
          <button
            onClick={() => handleNav('dashboard', '/dashboard')}
            className={`flex-1 h-full flex items-center justify-center ${
              currentPage === 'dashboard' ? 'text-neon-green' : 'text-gray-400'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => handleNav('portfolio', '/portfolio')}
            className={`flex-1 h-full flex items-center justify-center ${
              currentPage === 'portfolio' ? 'text-neon-green' : 'text-gray-400'
            }`}
          >
            Portfolio
          </button>
          <button
            onClick={() => handleNav('settings', '/settings')}
            className={`flex-1 h-full flex items-center justify-center ${
              currentPage === 'settings' ? 'text-neon-green' : 'text-gray-400'
            }`}
          >
            Settings
          </button>
        </div>
      </nav>
    </>
  );
}

function App() {

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-black text-white flex flex-col">
        <Navigation />
        {/* Main Content */}
        <main className="flex-1 pb-16 md:pb-0">
          <ProtectedLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/upgrade" element={<Upgrade />} />
              <Route path="/disclaimer" element={<Disclaimer />} />
            </Routes>
          </ProtectedLayout>
        </main>
        {/* Footer */}
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
