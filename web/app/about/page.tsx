"use client";

import { useLanguage } from "@/app/lib/i18n/LanguageContext";
import { Info, Database, BarChart2, AlertTriangle } from "lucide-react";

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3 mb-4">
          <Info className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          {t('about.heading')}
        </h1>
      </div>

      <div className="space-y-12">
        {/* What is this project */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t('about.what_is_title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
            <strong>{t('about.what_is_text1')}</strong> {t('about.what_is_text2')}
          </p>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            {t('about.what_is_text3')}
          </p>
        </section>

        {/* Methodology & Data */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('about.methodology_title')}
            </h2>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm">
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
              {t('about.methodology_text1')}
            </p>
            <ul className="space-y-4 text-gray-600 dark:text-gray-300 ml-4">
              <li className="flex items-start gap-3">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 flex-shrink-0" />
                <span>
                  <a href="https://opendata.rdw.nl/Voertuigen/Open-Data-RDW-Gekentekende_voertuigen/m9d7-ebf2" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                    {t('about.methodology_dataset1')}
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 flex-shrink-0" />
                <span>
                  <a href="https://opendata.rdw.nl/Keuringen/Open-Data-RDW-Keuringen/hx2c-gt7k" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                    {t('about.methodology_dataset2')}
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 flex-shrink-0" />
                <span>
                  <a href="https://opendata.rdw.nl/Keuringen/Open-Data-RDW-Geconstateerde-Gebreken/a34c-vvps" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                    {t('about.methodology_dataset3')}
                  </a>
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* How we calculate */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <BarChart2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('about.how_calc_title')}
            </h2>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {t('about.how_calc_text1')}
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                  {t('about.metric1_title')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {t('about.metric1_text')}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                  {t('about.metric2_title')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {t('about.metric2_text')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Wear & Tear vs Reliability */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('about.wear_tear_title')}
            </h2>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {t('about.wear_tear_text1')}
            </p>
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-1 border-l-4 border-yellow-400 dark:border-yellow-600 pl-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                  {t('about.wear_tear_type1')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('about.wear_tear_type1_text')}
                </p>
              </div>
              <div className="flex-1 border-l-4 border-red-500 dark:border-red-600 pl-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                  {t('about.wear_tear_type2')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('about.wear_tear_type2_text')}
                </p>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mt-4 border border-blue-100 dark:border-blue-800">
              {t('about.wear_tear_text2')}
            </p>
          </div>
        </section>

        {/* Limitations */}
        <section>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-8 border border-yellow-200 dark:border-yellow-700/50">
            <h2 className="text-xl font-bold text-yellow-900 dark:text-yellow-500 mb-4">
              {t('about.data_limits_title')}
            </h2>
            <p className="text-yellow-800 dark:text-yellow-200/80 mb-4">
              {t('about.data_limits_text1')}
            </p>
            <ul className="space-y-3 text-yellow-800 dark:text-yellow-200/80 text-sm ml-4 list-disc">
              <li>
                <strong>{t('about.limit1_title')}:</strong> {t('about.limit1_text')}
              </li>
              <li>
                <strong>{t('about.limit2_title')}:</strong> {t('about.limit2_text')}
              </li>
              <li>
                <strong>{t('about.limit3_title')}:</strong> {t('about.limit3_text')}
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
