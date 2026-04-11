"use client";

import { useLanguage } from "@/app/lib/i18n/LanguageContext";

export function FooterContent() {
  const { t } = useLanguage();

  return (
    <>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('footer.data_from')}{" "}
        <a
          href="https://opendata.rdw.nl/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          RDW Open Data
        </a>
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-500">
        {t('footer.not_affiliated')}
      </p>
    </>
  );
}
