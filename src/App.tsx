import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-black text-white flex flex-col">
        {/* Header */}
        <header className="border-b border-gray-800 bg-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <h1 className="text-2xl font-bold text-neon-green">BTC Rotator</h1>
              <nav className="hidden md:flex space-x-6">
                <button
                  onClick={() => setCurrentPage('dashboard')}
                  className={`px-3 py-2 rounded transition-colors ${
                    currentPage === 'dashboard'
                      ? 'bg-neon-green text-black'
                      : 'text-gray-400 hover:text-neon-green'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentPage('portfolio')}
                  className={`px-3 py-2 rounded transition-colors ${
                    currentPage === 'portfolio'
                      ? 'bg-neon-green text-black'
                      : 'text-gray-400 hover:text-neon-green'
                  }`}
                >
                  Portfolio
                </button>
                <button
                  onClick={() => setCurrentPage('settings')}
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
              onClick={() => setCurrentPage('dashboard')}
              className={`flex-1 h-full flex items-center justify-center ${
                currentPage === 'dashboard' ? 'text-neon-green' : 'text-gray-400'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentPage('portfolio')}
              className={`flex-1 h-full flex items-center justify-center ${
                currentPage === 'portfolio' ? 'text-neon-green' : 'text-gray-400'
              }`}
            >
              Portfolio
            </button>
            <button
              onClick={() => setCurrentPage('settings')}
              className={`flex-1 h-full flex items-center justify-center ${
                currentPage === 'settings' ? 'text-neon-green' : 'text-gray-400'
              }`}
            >
              Settings
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1">
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
