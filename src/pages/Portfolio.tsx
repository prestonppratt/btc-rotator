import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { SUPPORTED_TICKERS, TICKER_NAMES } from '../constants/tickers';
import LoadingSpinner from '../components/LoadingSpinner';

const client = generateClient<Schema>();

interface Holding {
  ticker: string;
  shares: number;
}

function Portfolio() {
  const [holdings, setHoldings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Initialize holdings with all tickers set to 0
  useEffect(() => {
    const initialHoldings: Record<string, number> = {};
    SUPPORTED_TICKERS.forEach((ticker) => {
      initialHoldings[ticker] = 0;
    });
    setHoldings(initialHoldings);
    
    // TODO: Load existing portfolio from User model
    // This would fetch the current user's portfolio from DynamoDB
  }, []);

  const handleInputChange = (ticker: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setHoldings((prev) => ({
      ...prev,
      [ticker]: numValue,
    }));
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Convert holdings to Holding[] format
      const portfolio: Holding[] = SUPPORTED_TICKERS
        .filter((ticker) => holdings[ticker] > 0)
        .map((ticker) => ({
          ticker,
          shares: holdings[ticker],
        }));

      // TODO: Save to User model in DynamoDB
      // This would update the current user's portfolio field
      // Example:
      // await client.models.User.update({
      //   id: currentUserId,
      //   portfolio: portfolio,
      // });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      setMessage({ type: 'success', text: 'Portfolio saved successfully!' });
    } catch (error) {
      console.error('Error saving portfolio:', error);
      setMessage({ type: 'error', text: 'Failed to save portfolio. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4">
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-lg">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">My Portfolio</h2>
        
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-900/50 text-green-300 border border-green-700'
                : 'bg-red-900/50 text-red-300 border border-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4"
        >
          {SUPPORTED_TICKERS.map((ticker) => (
            <div key={ticker} className="space-y-2">
              <label
                htmlFor={ticker}
                className="block text-sm font-medium text-gray-300"
              >
                {ticker} - {TICKER_NAMES[ticker as keyof typeof TICKER_NAMES]}
              </label>
              <input
                type="number"
                id={ticker}
                min="0"
                step="0.0001"
                value={holdings[ticker] || 0}
                onChange={(e) => handleInputChange(ticker, e.target.value)}
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 text-white text-sm sm:text-base rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-btc-orange focus:border-transparent"
                placeholder="0.0000"
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={saving}
            className="w-full mt-6 px-6 py-3 bg-btc-orange hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <LoadingSpinner size="sm" className="border-white border-t-white" />}
            {saving ? 'Saving...' : 'Save Portfolio'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Portfolio;

