import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '../../amplify/data/resource';
import LoadingSpinner from '../components/LoadingSpinner';
import { useDenomination } from '../contexts/DenominationContext';

const client = generateClient<Schema>();

type NotificationFreq = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'off';

function Settings() {
  const { denomination, setDenomination } = useDenomination();
  const [notificationFreq, setNotificationFreq] = useState<NotificationFreq>('weekly');
  const [phone, setPhone] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const user = await getCurrentUser();
        const userData = await client.models.User.get({ id: user.userId });

        if (userData.data) {
          setNotificationFreq((userData.data.notificationFreq as NotificationFreq) || 'weekly');
          setPhone(userData.data.phone || '');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const user = await getCurrentUser();
      await client.models.User.update({
        id: user.userId,
        notificationFreq: notificationFreq,
        phone: phone || undefined,
      });

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-4 pb-20 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center text-primary">Settings</h1>

        <div className="space-y-6 glass-panel p-6 rounded-lg">
          <div>
            <label className="block text-sm font-medium mb-2">Display Currency</label>
            <div className="flex bg-gray-800 rounded p-1 w-full sm:w-64">
              <button
                onClick={() => setDenomination('BTC')}
                className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${denomination === 'BTC'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                BTC
              </button>
              <button
                onClick={() => setDenomination('Sats')}
                className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${denomination === 'Sats'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Sats
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Choose between Bitcoin (BTC) and Satoshis (Sats) for all charts.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notification Frequency</label>
            <select
              value={notificationFreq}
              onChange={(e) => setNotificationFreq(e.target.value as NotificationFreq)}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-primary"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
              <option value="off">Off</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-primary"
            />
            <p className="text-xs text-gray-400 mt-1">Enter your phone number for SMS notifications (format: +1234567890). SMS requires AWS SNS to be configured.</p>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-primary text-white font-bold rounded hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <LoadingSpinner size="sm" /> : 'Save Settings'}
          </button>

          {message && (
            <div className={`p-3 rounded ${message.type === 'success' ? 'bg-green-900/50 text-green-200 border border-green-800' : 'bg-red-900/50 text-red-200 border border-red-800'}`}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
