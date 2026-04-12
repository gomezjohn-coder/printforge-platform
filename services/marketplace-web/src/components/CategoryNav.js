'use client';

import Link from 'next/link';

const CATEGORY_ICONS = {
  't-shirts': '👕',
  'hoodies': '🧥',
  'stickers': '🏷️',
  'mugs': '☕',
  'phone-cases': '📱',
  'wall-art': '🖼️',
  'tote-bags': '👜',
  'posters': '📄',
};

export default function CategoryNav({ categories = [] }) {
  // Fall back to defaults if no categories loaded
  const displayCategories = categories.length > 0
    ? categories
    : [
        { name: 'T-Shirts', slug: 't-shirts' },
        { name: 'Hoodies', slug: 'hoodies' },
        { name: 'Stickers', slug: 'stickers' },
        { name: 'Mugs', slug: 'mugs' },
        { name: 'Phone Cases', slug: 'phone-cases' },
        { name: 'Wall Art', slug: 'wall-art' },
        { name: 'Tote Bags', slug: 'tote-bags' },
        { name: 'Posters', slug: 'posters' },
      ];

  return (
    <nav className="border-b border-surface-100 bg-white">
      <div className="container-page">
        <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {displayCategories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                         text-surface-600 hover:text-brand-700 hover:bg-brand-50
                         whitespace-nowrap transition-colors shrink-0"
            >
              <span>{CATEGORY_ICONS[cat.slug] || '🎨'}</span>
              <span>{cat.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
