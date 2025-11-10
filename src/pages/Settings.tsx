import { useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

type NotificationFreq = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'off';

// Frontend-only MVP - backend will be added later
function Settings() {
  const [notificationFreq, setNotificationFreq] = useState<NotificationFreq>('weekly');
  const [phone, setPhone] = useState<string>('+1 (555) 000-0000'); // Stub
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    
    // Stub for MVP - backend will be added later
    setTimeout(() => {
      setIsSaving(false);
      setMessage({ type: 'success', text: 'Settings saved! (Backend coming soon)' });
    }, 500);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Settings</h1>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Notification Frequency</label>
            <select
              value={notificationFreq}
              onChange={(e) => setNotificationFreq(e.target.value as NotificationFreq)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-neon-green"
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
              type="text"
              value={phone}
              readOnly
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Phone number is read-only</p>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-neon-green text-black font-bold rounded hover:bg-neon-green-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <LoadingSpinner size="sm" /> : 'Save Settings'}
          </button>

          {message && (
            <div className={`p-3 rounded ${message.type === 'success' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
