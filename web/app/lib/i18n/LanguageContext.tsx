"use client";

import React, { createContext, useContext, useCallback, useEffect, useSyncExternalStore } from 'react';
import { Language, translations } from './translations';

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = "language";

// A tiny external store backs the language preference so it can be read during
// render via useSyncExternalStore instead of being synced in through a mount
// effect (which would trip react-hooks/set-state-in-effect). The server
// snapshot is always 'en', keeping the first client render identical to the
// server markup so hydration never mismatches; React then swaps to the real
// stored/browser preference after hydration.
const language_listeners = new Set<() => void>();

function language_read(): Language {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === "en" || saved === "nl") return saved;
  return navigator.language.startsWith("nl") ? "nl" : "en";
}

function language_subscribe(listener: () => void) {
  language_listeners.add(listener);
  return () => {
    language_listeners.delete(listener);
  };
}

function language_store_set(lang: Language) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }
  language_listeners.forEach((listener) => listener());
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore<Language>(
    language_subscribe,
    language_read,
    () => "en"
  );

  // Mirror the active language onto the document element. This is a DOM side
  // effect only (no setState), so it does not trigger a cascading re-render.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const language_set = useCallback((lang: Language) => {
    language_store_set(lang);
  }, []);

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
