"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home,
  Car,
  Fuel,
  Search,
  Info,
  Github,
  Menu,
  X,
  AlertTriangle,
  BarChart3
} from "lucide-react";
import { useLanguage } from "@/app/lib/i18n/LanguageContext";

interface NavLink {
  href: string;
  labelKey: string;
  icon: React.ElementType;
}

const NAV_LINKS: NavLink[] = [
  { href: "/", labelKey: "nav.home", icon: Home },
  { href: "/statistics", labelKey: "nav.statistics", icon: BarChart3 },
  { href: "/fuels", labelKey: "nav.fuels", icon: Fuel },
  { href: "/defects", labelKey: "nav.defects", icon: AlertTriangle },
  { href: "/lookup", labelKey: "nav.lookup", icon: Search },
  { href: "/about", labelKey: "nav.about", icon: Info },
];

export function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <nav className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white hover:opacity-80 transition-opacity"
          >
            <Car className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">apkstat.nl</span>
            <span className="sm:hidden">APKS</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${isActive
                      ? "bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mr-2">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${
                  language === 'en'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
                aria-label="Switch to English"
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('nl')}
                className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${
                  language === 'nl'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
                aria-label="Switch to Dutch"
              >
                NL
              </button>
            </div>

            <a
              href="https://github.com/jjgroenendijk/cars-reliability"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
              aria-label="View Source Code"
            >
              <Github className="h-5 w-5" />
            </a>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex flex-col space-y-1">
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-md text-base font-medium transition-colors
                      ${isActive
                        ? "bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                      }
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    {t(link.labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
