import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '../../amplify/data/resource';
import LoadingSpinner from '../components/LoadingSpinner';
import { useDenomination } from '../contexts/DenominationContext';

import { triggerFetchHistoricalPrices } from '../services/historicalPriceService';
import { SUPPORTED_TICKERS } from '../constants/tickers';

const client = generateClient<Schema>();

type NotificationFreq = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'off';

function Settings() {
  const { denomination, setDenomination } = useDenomination();
  const [notificationFreq, setNotificationFreq] = useState<NotificationFreq>('weekly');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [userExists, setUserExists] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const user = await getCurrentUser();
        const email = user.signInDetails?.loginId || '';
        setUserEmail(email);

        const userData = await client.models.User.get({ id: user.userId });

        if (userData.data) {
          console.log('Loaded User Data:', userData.data);
          setUserExists(true);
          setNotificationFreq((userData.data.notificationFreq as NotificationFreq) || 'weekly');
          setPhone(userData.data.phone || '');
          setFirstName(userData.data.firstName || '');
          setLastName(userData.data.lastName || '');
          if (userData.data.denomination) {
            setDenomination(userData.data.denomination as 'BTC' | 'Sats');
          }
        } else {
          console.log('No user data found for ID:', user.userId);
          setUserExists(false);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [setDenomination]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const user = await getCurrentUser();

      if (userExists) {
        await client.models.User.update({
          id: user.userId,
          notificationFreq: notificationFreq,
          phone: phone || null,
          firstName: firstName || null,
          lastName: lastName || null,
          denomination: denomination,
        });
      } else {
        await client.models.User.create({
          id: user.userId,
          email: userEmail,
          signupDate: new Date().toISOString(),
          notificationFreq: notificationFreq,
          phone: phone || null,
          firstName: firstName || null,
          lastName: lastName || null,
          denomination: denomination,
          isPaid: false,
        });
        setUserExists(true);
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    setMessage(null);
    try {
      await triggerFetchHistoricalPrices([...SUPPORTED_TICKERS], 90);
      setMessage({ type: 'success', text: 'Data refresh triggered successfully! Please wait a few minutes for data to populate.' });
    } catch (error) {
      console.error('Error refreshing data:', error);
      setMessage({ type: 'error', text: `Failed to trigger data refresh: ${(error as any).message || JSON.stringify(error)}` });
    } finally {
      setIsRefreshing(false);
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name"
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last Name"
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-primary"
              />
            </div>
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
            >
            </input>
            <p className="text-xs text-gray-400 mt-1">Enter your phone number for SMS notifications (format: +1234567890). SMS requires AWS SNS to be configured.</p>
          </div>

          <div className="pt-4 border-t border-gray-700">
            <h3 className="text-lg font-medium mb-3 text-primary">Data Management</h3>
            <p className="text-sm text-gray-400 mb-3">
              Manually trigger a refresh of historical price data from the backend. Use this if charts are empty.
            </p>
            <button
              onClick={handleRefreshData}
              disabled={isRefreshing}
              className="w-full py-2 bg-gray-700 text-white font-bold rounded hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRefreshing ? <LoadingSpinner size="sm" /> : 'Refresh Historical Data'}
            </button>
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

          {/* Debug Info */}
          <div className="mt-8 p-4 bg-gray-900 rounded text-xs font-mono text-gray-400 overflow-auto">
            <p className="font-bold text-gray-300 mb-2">Debug Info (User Data):</p>
            <p>User ID: {userEmail}</p>
            <p>Exists: {userExists ? 'Yes' : 'No'}</p>
            <p>First Name State: "{firstName}"</p>
            <p>Last Name State: "{lastName}"</p>
            <p>Phone State: "{phone}"</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
