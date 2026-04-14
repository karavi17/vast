'use client';

import React, { createContext, useContext, useState } from 'react';

type Language = 'RANDOM' | 'HINDI' | 'ENGLISH' | 'TAMIL' | 'TELUGU' | 'KANNADA' | 'MALAYALAM' | 'BENGALI' | 'PUNJABI' | 'MARATHI';

const SUPPORTED_LANGUAGES: Language[] = ['RANDOM', 'HINDI', 'ENGLISH', 'TAMIL', 'TELUGU', 'KANNADA', 'MALAYALAM', 'BENGALI', 'PUNJABI', 'MARATHI'];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'RANDOM';
    const savedLang = window.localStorage.getItem('app-language') as Language | null;
    if (savedLang && SUPPORTED_LANGUAGES.includes(savedLang)) return savedLang;
    return 'RANDOM';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('app-language', lang);
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
