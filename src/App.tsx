import { useState, useEffect } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import Dashboard from './components/Dashboard';
import { SUPPORTED_TICKERS } from './constants/tickers';

function App() {
  return (
    <Authenticator
      loginMechanisms={['email', 'phone_number']}
      signUpAttributes={['email', 'phone_number']}
    >
      {({ signOut, user }) => (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
          <header className="bg-gray-900 border-b border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-btc-orange">BTC Rotator</h1>
                  <p className="text-sm text-gray-400">Bitcoin Ticker Rotation Tool</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-300">
                    {user?.signInDetails?.loginId || user?.username}
                  </span>
                  <button
                    onClick={signOut}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Dashboard />
          </main>
        </div>
      )}
    </Authenticator>
  );
}

export default App;

