import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const NetworkStatus = () => {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border border-red-600">
        <WifiOff className="h-5 w-5" />
        <span className="font-medium text-sm">
          {t('you_are_offline', 'You are currently offline. Using cached data.')}
        </span>
      </div>
    </div>
  );
};

export default NetworkStatus;