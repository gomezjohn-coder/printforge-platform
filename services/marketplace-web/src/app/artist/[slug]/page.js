'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';

const API_BASE = '';

const BANNER_GRADIENTS = [
  'from-brand-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-orange-400 to-red-500',
  'from-pink-500 to-rose-600',
];

function getBannerGradient(name) {
  if (!name) return BANNER_GRADIENTS[0];
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return BANNER_GRADIENTS[hash % BANNER_GRADIENTS.length];
}

export default function ArtistPage({ params }) {
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/artists/${params.slug}`);
        if (!res.ok) throw new Error('Artist not found');
        const json = await res.json();
        setArtist(json.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.slug]);

  if (loading) {
    return (
      <div className="container-page py-20">
        <div className="animate-pulse">
          <div className="h-48 bg-surface-200 rounded-xl mb-8" />
          <div className="h-8 bg-surface-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-surface-200 rounded w-2/3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-10">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square bg-surface-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-bold text-surface-900 mb-2">Artist Not Found</h1>
        <p className="text-surface-500 mb-6">{error || 'This artist profile could not be found.'}</p>
        <Link href="/" className="btn-primary">Back to Home</Link>
      </div>
    );
  }

  const gradient = getBannerGradient(artist.name);
  const products = artist.products || [];

  return (
    <div>
      {/* Banner */}
      <div className={`h-48 md:h-56 bg-gradient-to-r ${gradient}`} />

      <div className="container-page -mt-16 relative z-10">
        {/* Avatar + info */}
        <div className="flex flex-col sm:flex-row items-start gap-5 mb-8">
          <div className={`w-28 h-28 rounded-2xl bg-gradient-to-br ${gradient}
                           border-4 border-white shadow-lg flex items-center justify-center shrink-0`}>
            <span className="text-white text-4xl font-bold">{artist.name?.[0] || '?'}</span>
          </div>
          <div className="pt-2 sm:pt-8">
            <h1 className="text-2xl md:text-3xl font-bold text-surface-900">{artist.name}</h1>
            {artist.location && (
              <p className="text-sm text-surface-500 mt-0.5 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {artist.location}
              </p>
            )}
            <p className="text-surface-600 mt-2 max-w-xl">
              {artist.bio || 'Independent artist on RawCanvas.'}
            </p>
            <div className="flex items-center gap-6 mt-3 text-sm text-surface-400">
              <span><strong className="text-surface-700">{artist.totalSales?.toLocaleString() || 0}</strong> sales</span>
              <span><strong className="text-surface-700">{products.length}</strong> designs</span>
              {artist.joinedAt && (
                <span>Joined {new Date(artist.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              )}
            </div>
          </div>
        </div>

        {/* Products grid */}
        <div className="border-t border-surface-100 pt-8">
          <h2 className="text-xl font-bold text-surface-900 mb-6">
            Designs by {artist.name} ({products.length})
          </h2>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={{ ...product, artist: { name: artist.name, slug: artist.slug } }} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-surface-400">
              <p className="text-lg">No designs yet.</p>
              <p className="text-sm mt-1">Check back soon for new work from this artist.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
