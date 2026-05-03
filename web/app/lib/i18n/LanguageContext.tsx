"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations } from './translations';

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const saved_language = localStorage.getItem("language");
    if (saved_language === "en" || saved_language === "nl") {
      document.documentElement.lang = saved_language;
      setLanguage(saved_language);
      return;
    }

    const browser_language = navigator.language.startsWith('nl') ? 'nl' : 'en';
    document.documentElement.lang = browser_language;
    setLanguage(browser_language);
  }, []);

  const language_set = (lang: Language) => {
    localStorage.setItem("language", lang);
    document.documentElement.lang = lang;
    setLanguage(lang);
  };

  const t = (path: string, values?: Record<string, string | number>) => {
    const keys = path.split('.');
    let current: unknown = translations[language];

    for (const key of keys) {
      if (typeof current !== "object" || current === null || !(key in current)) {
        return path;
      }
      current = (current as Record<string, unknown>)[key];
    }

    if (typeof current !== "string") {
      return path;
    }

    if (!values) {
      return current;
    }

    return Object.entries(values).reduce(
      (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
      current
    );
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: language_set, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
