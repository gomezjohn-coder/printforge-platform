'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const SUGGESTIONS = [
  'Graphic tees', 'Stickers', 'Phone cases', 'Wall art',
  'Hoodies', 'Mugs', 'Tote bags', 'Posters',
];

export default function SearchBar({ className = '' }) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const router = useRouter();
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length > 0) {
      setFiltered(
        SUGGESTIONS.filter((s) => s.toLowerCase().includes(query.toLowerCase()))
      );
    } else {
      setFiltered(SUGGESTIONS);
    }
  }, [query]);

  function handleSubmit(e) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setShowSuggestions(false);
    }
  }

  function handleSuggestionClick(suggestion) {
    setQuery(suggestion);
    router.push(`/search?q=${encodeURIComponent(suggestion)}`);
    setShowSuggestions(false);
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Search designs, artists, products..."
          className="w-full pl-10 pr-4 py-2.5 rounded-full border border-surface-300 bg-surface-50
                     focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                     text-sm text-surface-800 placeholder:text-surface-400"
        />
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </form>

      {showSuggestions && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-surface-200
                        rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 text-xs font-medium text-surface-400 uppercase tracking-wider">
            Popular searches
          </div>
          {filtered.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              className="block w-full text-left px-3 py-2 text-sm text-surface-700
                         hover:bg-brand-50 hover:text-brand-700 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
