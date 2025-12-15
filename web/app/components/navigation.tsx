"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home,
  Award,
  Car,
  Fuel,
  Search,
  Info,
  Github,
  Menu,
  X,
  AlertTriangle
} from "lucide-react";

interface NavLink {
  href: string;
  label: string;
  icon: React.ElementType;
}

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/brands", label: "Brands", icon: Award },
  { href: "/models", label: "Models", icon: Car },
  { href: "/fuels", label: "Fuel Types", icon: Fuel },
  { href: "/defects", label: "Defects", icon: AlertTriangle },
  { href: "/lookup", label: "Lookup", icon: Search },
  { href: "/about", label: "About", icon: Info },
];

export function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

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
            <span className="hidden sm:inline">Dutch Car Reliability</span>
            <span className="sm:hidden">DCR</span>
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
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
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
                    {link.label}
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
