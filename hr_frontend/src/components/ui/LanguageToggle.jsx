import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button'; // Adjusted path for better compatibility
// Removed unnecessary axios import

const LanguageToggle = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    // Determine the language to switch to
    const newLang = i18n.language.startsWith('en') ? 'ur' : 'en';
    
    // 1. Change the language. This triggers:
    //    a) Re-render of components using t()
    //    b) i18next to fetch the new translation file via HttpBackend
    //    c) The useEffect in App.jsx to set dir="rtl"
    i18n.changeLanguage(newLang);
    
    // Note: The 'i18next-lang' cookie is set automatically by LanguageDetector after i18n.changeLanguage.
  };

  const currentLang = i18n.language;
  const isEnglish = currentLang.startsWith('en');

  return (
    <div className="flex space-x-2">
      <Button
        variant={isEnglish ? "default" : "outline"}
        size="sm"
        onClick={toggleLanguage}
      >
        English
      </Button>
      <Button
        variant={!isEnglish ? "default" : "outline"}
        size="sm"
        onClick={toggleLanguage}
      >
        اردو (Urdu)
      </Button>
    </div>
  );
};

export default LanguageToggle;