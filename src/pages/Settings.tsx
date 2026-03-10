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
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
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
          const data = userData.data;
          setUserExists(true);
          if (data.firstName) setFirstName(data.firstName);
          if (data.lastName) setLastName(data.lastName);
          if (data.phone) setPhone(data.phone);
          if (data.notificationFreq) setNotificationFreq(data.notificationFreq as NotificationFreq);
          if (data.denomination) setDenomination(data.denomination as 'BTC' | 'Sats');
        } else {
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
      console.log('Saving for user:', user.userId);

      let result;
      if (userExists) {
        result = await client.models.User.update({
          id: user.userId,
          notificationFreq: notificationFreq,
          phone: phone || null,
          firstName: firstName || null,
          lastName: lastName || null,
          denomination: denomination,
        });
      } else {
        // Create user record
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
        <h1 className="text-3xl font-bold mb-6 text-center text-white tracking-tight">Settings</h1>

        <div className="space-y-6 bg-[#1C1C1E] border border-gray-800 p-6 rounded-xl shadow-premium">
          <div>
            <label className="block text-sm font-medium mb-2">Display Currency</label>
            <div className="flex bg-[#2C2C2E] border border-gray-700 rounded-lg p-1 w-full sm:w-64">
              <button
                onClick={() => setDenomination('BTC')}
                className={`flex-1 py-1.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${denomination === 'BTC'
                  ? 'bg-[#3A3A3C] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                BTC
              </button>
              <button
                onClick={() => setDenomination('Sats')}
                className={`flex-1 py-1.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${denomination === 'Sats'
                  ? 'bg-[#3A3A3C] text-white shadow-sm'
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
                className="w-full px-4 py-2 border border-gray-700 bg-[#2C2C2E] rounded-md focus:outline-none focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF] text-white transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last Name"
                className="w-full px-4 py-2 border border-gray-700 bg-[#2C2C2E] rounded-md focus:outline-none focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF] text-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notification Frequency</label>
            <select
              value={notificationFreq}
              onChange={(e) => setNotificationFreq(e.target.value as NotificationFreq)}
              className="w-full px-4 py-2 border border-gray-700 bg-[#2C2C2E] rounded-md focus:outline-none focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF] text-white transition-all"
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
              className="w-full px-4 py-2 border border-gray-700 bg-[#2C2C2E] rounded-md focus:outline-none focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF] text-white transition-all"
            >
            </input>
            <p className="text-xs text-gray-400 mt-1">Enter your phone number for SMS notifications (format: +1234567890). SMS requires AWS SNS to be configured.</p>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3.5 bg-[#0A84FF] text-white font-semibold rounded-xl hover:bg-[#0066CC] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
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
