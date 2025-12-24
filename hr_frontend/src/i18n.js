import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend'; // KEEP THIS IMPORT

i18n
  // 1. Load translations over HTTP
  .use(HttpBackend)
  // 2. Detect user language
  .use(LanguageDetector)
  // 3. Pass instance to React
  .use(initReactI18next)
  .init({
    // --- Core Settings ---
    fallbackLng: 'en',
    supportedLngs: ['en', 'ur'],
    
    // Set 'ns' (namespace) to 'translation' to match your file name
    defaultNS: 'translation', 
    
    // --- Language Detection Configuration ---
    detection: {
        order: ['cookie', 'localStorage', 'navigator'],
        caches: ['cookie'],
        lookupCookie: 'i18next-lang', // This cookie name is used in LanguageToggle.jsx
    },
    
    // --- Backend Configuration ---
    backend: {
      // This is the path the HTTP request will target: 
      // e.g., /locales/ur/translation.json
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    interpolation: {
      escapeValue: false, 
    },
    
    react: {
      useSuspense: false,
    }
  });

export default i18n;