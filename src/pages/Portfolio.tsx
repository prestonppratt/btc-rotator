import { useState } from 'react';
import { SUPPORTED_TICKERS, TICKER_NAMES } from '../constants/tickers';
import LoadingSpinner from '../components/LoadingSpinner';

// Frontend-only MVP - backend will be added later
function Portfolio() {
  const [holdings, setHoldings] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    
    // Stub for MVP - backend will be added later
    setTimeout(() => {
      setIsSaving(false);
      setMessage({ type: 'success', text: 'Portfolio saved! (Backend coming soon)' });
    }, 500);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Portfolio</h1>
        
        <div className="space-y-4 mb-6">
          {SUPPORTED_TICKERS.map((ticker) => (
            <div key={ticker} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <label className="text-sm font-medium w-24 sm:w-32">{TICKER_NAMES[ticker] || ticker}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={holdings[ticker] || ''}
                onChange={(e) => setHoldings({ ...holdings, [ticker]: parseFloat(e.target.value) || 0 })}
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-neon-green"
                placeholder="0.00"
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3 bg-neon-green text-black font-bold rounded hover:bg-neon-green-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <LoadingSpinner size="sm" /> : 'Save Portfolio'}
        </button>

        {message && (
          <div className={`mt-4 p-3 rounded ${message.type === 'success' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}

export default Portfolio;
