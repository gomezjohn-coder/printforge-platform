'use client';

import Link from 'next/link';
import { useState } from 'react';
import SearchBar from './SearchBar';
import CategoryNav from './CategoryNav';

export default function Header({ categories = [] }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      {/* Top bar */}
      <div className="bg-surface-900 text-white">
        <div className="container-page">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">PF</span>
              </div>
              <span className="text-xl font-bold tracking-tight">
                Print<span className="text-brand-400">Forge</span>
              </span>
            </Link>

            {/* Search - desktop */}
            <SearchBar className="hidden md:block flex-1 max-w-xl mx-8" />

            {/* Right nav */}
            <div className="flex items-center gap-4">
              <Link href="/search" className="md:hidden text-surface-300 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </Link>

              <Link
                href="/search"
                className="hidden sm:inline-flex text-sm text-surface-300 hover:text-white transition-colors"
              >
                Explore
              </Link>

              {/* Cart icon */}
              <button className="relative text-surface-300 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-accent-500 text-white text-[10px]
                                 font-bold rounded-full flex items-center justify-center">
                  0
                </span>
              </button>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-surface-300 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile search */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4">
              <SearchBar className="w-full" />
            </div>
          )}
        </div>
      </div>

      {/* Category nav */}
      <CategoryNav categories={categories} />
    </header>
  );
}
