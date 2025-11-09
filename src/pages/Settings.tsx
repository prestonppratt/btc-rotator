import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import type { Schema } from '../../amplify/data/resource';
import LoadingSpinner from '../components/LoadingSpinner';

const client = generateClient<Schema>();

type NotificationFreq = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'off';

interface SettingsProps {
  userPhone?: string;
}

function Settings({ userPhone }: SettingsProps) {
  const [notificationFreq, setNotificationFreq] = useState<NotificationFreq>('weekly');
  const [phoneNumber, setPhoneNumber] = useState<string>(userPhone || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        // Get current user
        const user = await getCurrentUser();
        
        // Get phone from user attributes
        try {
          const attributes = await fetchUserAttributes();
          if (attributes.phone_number) {
            setPhoneNumber(attributes.phone_number);
          }
        } catch (err) {
          console.warn('Could not fetch phone number:', err);
        }
        
        // TODO: Fetch User model from DynamoDB
        // This would get the current user's settings
        // Example:
        // const userData = await client.models.User.get({ id: user.userId });
        // if (userData.data) {
        //   setNotificationFreq(userData.data.notificationFreq as NotificationFreq);
        // }
      } catch (error) {
        console.error('Error loading settings:', error);
        setMessage({ type: 'error', text: 'Failed to load settings.' });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Get current user
      const user = await getCurrentUser();

      // TODO: Update User model in DynamoDB
      // This would update the current user's notificationFreq
      // Example:
      // await client.models.User.update({
      //   id: user.userId,
      //   notificationFreq: notificationFreq,
      // });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <div className="flex flex-col items-center gap-4 py-8">
            <LoadingSpinner size="lg" />
            <p className="text-gray-400">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4">
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-lg">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Settings</h2>

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
          className="space-y-6"
        >
          <div className="space-y-2">
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-300"
            >
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              value={phoneNumber}
              readOnly
              className="w-full px-4 py-2 bg-gray-700 text-gray-400 rounded-lg border border-gray-600 focus:outline-none cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              Phone number is read-only. Update it in your account settings.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="notificationFreq"
              className="block text-sm font-medium text-gray-300"
            >
              Notification Frequency
            </label>
            <select
              id="notificationFreq"
              value={notificationFreq}
              onChange={(e) => setNotificationFreq(e.target.value as NotificationFreq)}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-btc-orange focus:border-transparent"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="off">Off</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              How often you want to receive notifications about rotation opportunities.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full mt-6 px-6 py-3 bg-btc-orange hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <LoadingSpinner size="sm" className="border-white border-t-white" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Settings;

