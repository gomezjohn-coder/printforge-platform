'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';

const NAV_ITEMS = [
  {
    label: 'Explore',
    dropdown: [
      { label: 'For You', href: '/search?q=for+you' },
      { label: 'Retro Gaming', href: '/search?q=retro+gaming' },
      { label: 'Music', href: '/search?q=music' },
      { label: 'Funny T-Shirts', href: '/search?q=funny+t-shirts' },
      { label: 'Earth Day', href: '/search?q=earth+day' },
      { label: 'Pop Culture', href: '/search?q=pop+culture' },
      { label: 'Fresh Finds', href: '/search?q=fresh+finds' },
      { label: 'Fan Art', href: '/search?q=fan+art' },
    ],
  },
  {
    label: 'Clothing',
    dropdown: [
      { label: 'All Clothing', href: '/category/clothing' },
      { label: 'T-Shirts', href: '/category/t-shirts' },
      { label: 'Hoodies & Sweatshirts', href: '/category/hoodies-sweatshirts' },
      { label: 'Hats', href: '/category/hats' },
      { label: 'Socks', href: '/category/socks' },
      { label: 'Dresses', href: '/search?q=dresses' },
      { label: 'Tank Tops', href: '/search?q=tank+tops' },
    ],
  },
  {
    label: 'Stickers',
    dropdown: [
      { label: 'All Stickers', href: '/category/stickers' },
      { label: 'Holographic', href: '/search?q=holographic+stickers' },
      { label: 'Funny', href: '/search?q=funny+stickers' },
      { label: 'Car', href: '/search?q=car+stickers' },
      { label: 'Bumper', href: '/search?q=bumper+stickers' },
      { label: 'Water Bottle', href: '/search?q=water+bottle+stickers' },
      { label: 'Cool', href: '/search?q=cool+stickers' },
      { label: 'Anime', href: '/search?q=anime+stickers' },
      { label: 'Laptop', href: '/search?q=laptop+stickers' },
    ],
  },
  {
    label: 'Phone Cases',
    href: '/category/phone-cases',
  },
  {
    label: 'Wall Art',
    dropdown: [
      { label: 'All Wall Art', href: '/category/wall-art' },
      { label: 'Posters', href: '/search?q=posters' },
      { label: 'Art Prints', href: '/search?q=art+prints' },
      { label: 'Canvas Prints', href: '/search?q=canvas+prints' },
      { label: 'Framed Prints', href: '/search?q=framed+prints' },
      { label: 'Tapestries', href: '/search?q=tapestries' },
    ],
  },
  {
    label: 'Home & Living',
    dropdown: [
      { label: 'All Home & Living', href: '/category/home-living' },
      { label: 'Mugs', href: '/search?q=mugs' },
      { label: 'Throw Pillows', href: '/search?q=throw+pillows' },
      { label: 'Blankets', href: '/search?q=blankets' },
      { label: 'Coasters', href: '/search?q=coasters' },
      { label: 'Jigsaw Puzzles', href: '/search?q=jigsaw+puzzles' },
      { label: 'Clocks', href: '/search?q=clocks' },
    ],
  },
  {
    label: 'Kids & Babies',
    dropdown: [
      { label: 'All Kids', href: '/category/kids-babies' },
      { label: 'Kids T-Shirts', href: '/search?q=kids+t-shirts' },
      { label: 'Baby One-Pieces', href: '/search?q=baby+one-pieces' },
      { label: 'Kids Hoodies', href: '/search?q=kids+hoodies' },
    ],
  },
  {
    label: 'Accessories',
    dropdown: [
      { label: 'All Accessories', href: '/category/accessories' },
      { label: 'Hats', href: '/search?q=hats' },
      { label: 'Socks', href: '/search?q=socks' },
      { label: 'Pins', href: '/search?q=pins' },
      { label: 'Backpacks', href: '/search?q=backpacks' },
      { label: 'Tote Bags', href: '/search?q=tote+bags' },
      { label: 'Makeup Bags', href: '/search?q=makeup+bags' },
    ],
  },
  {
    label: 'Stationery',
    dropdown: [
      { label: 'All Stationery', href: '/category/stationery' },
      { label: 'Greeting Cards', href: '/search?q=greeting+cards' },
      { label: 'Notebooks', href: '/search?q=notebooks' },
      { label: 'Mouse Pads', href: '/search?q=mouse+pads' },
      { label: 'Postcards', href: '/search?q=postcards' },
      { label: 'Journals', href: '/search?q=journals' },
    ],
  },
  {
    label: 'Gifts',
    href: '/search?q=gifts',
  },
];

export default function Header() {
  const router = useRouter();
  const { totalItems, setIsOpen } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState(null);
  const closeTimeout = useRef(null);
  const navRef = useRef(null);

  useEffect(() => {
    return () => {
      if (closeTimeout.current) clearTimeout(closeTimeout.current);
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileOpen(false);
    }
  };

  const handleMouseEnter = (index) => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
    setActiveMenu(index);
  };

  const handleMouseLeave = () => {
    closeTimeout.current = setTimeout(() => {
      setActiveMenu(null);
    }, 150);
  };

  const toggleMobileAccordion = (index) => {
    setMobileAccordion(mobileAccordion === index ? null : index);
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      {/* TOP BAR */}
      <div className="h-16 container-page flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">RC</span>
          </div>
          <span className="text-xl font-bold text-gray-900 hidden sm:block">RawCanvas</span>
        </Link>

        {/* Desktop Search */}
        <form
          onSubmit={handleSearch}
          className="hidden md:flex flex-1 max-w-2xl mx-4"
        >
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search designs, themes, or products..."
              className="w-full h-10 pl-10 pr-4 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </form>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Cart Button */}
          <button
            onClick={() => setIsOpen(true)}
            className="relative p-2 text-gray-700 hover:text-brand-500 transition-colors"
            aria-label="Open cart"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </button>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-gray-700 hover:text-brand-500 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* DESKTOP NAV */}
      <nav
        ref={navRef}
        className="hidden md:block border-t border-gray-100"
        onMouseLeave={handleMouseLeave}
      >
        <div className="container-page">
          <ul className="flex items-center gap-0">
            {NAV_ITEMS.map((item, index) => (
              <li
                key={item.label}
                className="relative"
                onMouseEnter={() => item.dropdown && handleMouseEnter(index)}
              >
                {item.dropdown ? (
                  <button
                    className={`px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                      activeMenu === index
                        ? 'text-brand-500'
                        : 'text-gray-700 hover:text-brand-500'
                    }`}
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className="px-3 py-3 text-sm font-medium text-gray-700 hover:text-brand-500 transition-colors whitespace-nowrap inline-block"
                  >
                    {item.label}
                  </Link>
                )}

                {/* Dropdown */}
                {item.dropdown && activeMenu === index && (
                  <div
                    className="absolute top-full left-0 bg-white shadow-lg rounded-b-lg border border-gray-100 min-w-[200px] py-2 z-50"
                    onMouseEnter={() => handleMouseEnter(index)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {item.dropdown.map((subItem) => (
                      <Link
                        key={subItem.label}
                        href={subItem.href}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand-500 transition-colors"
                      >
                        {subItem.label}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white max-h-[calc(100vh-4rem)] overflow-y-auto">
          {/* Mobile Search */}
          <form onSubmit={handleSearch} className="p-4 border-b border-gray-100">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search designs, themes, or products..."
                className="w-full h-10 pl-10 pr-4 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </form>

          {/* Mobile Nav Items */}
          <ul className="py-2">
            {NAV_ITEMS.map((item, index) => (
              <li key={item.label} className="border-b border-gray-50 last:border-b-0">
                {item.dropdown ? (
                  <>
                    <button
                      onClick={() => toggleMobileAccordion(index)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:text-brand-500 transition-colors"
                    >
                      {item.label}
                      <svg
                        className={`w-4 h-4 transition-transform ${
                          mobileAccordion === index ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {mobileAccordion === index && (
                      <ul className="bg-gray-50 py-1">
                        {item.dropdown.map((subItem) => (
                          <li key={subItem.label}>
                            <Link
                              href={subItem.href}
                              onClick={() => setMobileOpen(false)}
                              className="block pl-8 pr-4 py-2 text-sm text-gray-600 hover:text-brand-500 transition-colors"
                            >
                              {subItem.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-3 text-sm font-medium text-gray-700 hover:text-brand-500 transition-colors"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
