'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-pink-500 to-rose-500',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
];

function getGradient(id) {
  if (!id) return GRADIENTS[0];
  const hash = typeof id === 'string'
    ? id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    : 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

const PRODUCT_TYPES = ['t-shirt', 'hoodie', 'sticker', 'mug', 'phone-case', 'wall-art', 'tote-bag', 'poster'];

export default function ProductPage({ params }) {
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/products/${params.slug}`);
        if (!res.ok) throw new Error('Product not found');
        const json = await res.json();
        setProduct(json.data);
        setRelatedProducts(json.data.relatedProducts || []);
        setSelectedType(json.data.productType);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.slug]);

  function handleAddToCart() {
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  }

  if (loading) {
    return (
      <div className="container-page py-20">
        <div className="animate-pulse">
          <div className="grid md:grid-cols-2 gap-10">
            <div className="aspect-square bg-surface-200 rounded-xl" />
            <div className="space-y-4">
              <div className="h-8 bg-surface-200 rounded w-3/4" />
              <div className="h-4 bg-surface-200 rounded w-1/2" />
              <div className="h-10 bg-surface-200 rounded w-1/3 mt-6" />
              <div className="h-20 bg-surface-200 rounded mt-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-bold text-surface-900 mb-2">Product Not Found</h1>
        <p className="text-surface-500 mb-6">{error || 'This product could not be found.'}</p>
        <Link href="/" className="btn-primary">Back to Home</Link>
      </div>
    );
  }

  const gradient = getGradient(product.id);
  const price = parseFloat(product.price).toFixed(2);

  return (
    <div className="container-page py-8 md:py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-surface-400 mb-6">
        <Link href="/" className="hover:text-brand-600">Home</Link>
        <span>/</span>
        {product.category && (
          <>
            <Link href={`/category/${product.category.slug}`} className="hover:text-brand-600">
              {product.category.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-surface-600">{product.title}</span>
      </nav>

      {/* Product detail */}
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Image */}
        <div className={`aspect-square rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center relative overflow-hidden`}>
          <span className="text-white/60 text-8xl font-black uppercase select-none">
            {product.title?.[0] || 'P'}
          </span>
          <span className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-sm text-sm font-medium text-surface-700 rounded-full capitalize">
            {product.productType?.replace('-', ' ')}
          </span>
        </div>

        {/* Info */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-surface-900 mb-2">
            {product.title}
          </h1>

          {product.artist && (
            <Link
              href={`/artist/${product.artist.slug}`}
              className="inline-flex items-center gap-2 text-surface-500 hover:text-brand-600 transition-colors mb-4"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{product.artist.name?.[0]}</span>
              </div>
              <span className="text-sm font-medium">by {product.artist.name}</span>
            </Link>
          )}

          <div className="text-3xl font-black text-surface-900 mt-4">
            ${price}
          </div>

          <p className="text-sm text-surface-500 mt-1">Free shipping on orders over $35</p>

          {/* Product type selector */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-surface-700 mb-2">Available on:</h3>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors
                    ${selectedType === type
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                    }`}
                >
                  {type.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Add to cart */}
          <button
            onClick={handleAddToCart}
            className={`w-full mt-6 py-3.5 rounded-xl font-bold text-lg transition-all
              ${addedToCart
                ? 'bg-emerald-500 text-white'
                : 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800'
              }`}
          >
            {addedToCart ? 'Added to Cart!' : 'Add to Cart'}
          </button>

          {/* Description */}
          <div className="mt-8 border-t border-surface-100 pt-6">
            <h3 className="text-sm font-semibold text-surface-700 mb-2">Description</h3>
            <p className="text-sm text-surface-500 leading-relaxed">
              {product.description || `A beautifully crafted ${product.productType?.replace('-', ' ')} featuring "${product.title}" by ${product.artist?.name || 'an independent artist'}. Printed on premium materials with vibrant, long-lasting colors.`}
            </p>
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-surface-700 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/search?q=${encodeURIComponent(tag)}`}
                    className="px-2 py-1 bg-surface-100 text-surface-500 text-xs rounded-md hover:bg-surface-200 transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Artist info */}
          {product.artist && (
            <div className="mt-6 border-t border-surface-100 pt-6">
              <Link
                href={`/artist/${product.artist.slug}`}
                className="flex items-center gap-3 group"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shrink-0">
                  <span className="text-white text-lg font-bold">{product.artist.name?.[0]}</span>
                </div>
                <div>
                  <div className="font-semibold text-surface-900 group-hover:text-brand-600 transition-colors">
                    {product.artist.name}
                  </div>
                  <div className="text-sm text-surface-500 line-clamp-1">
                    {product.artist.bio || 'Independent artist on PrintForge'}
                  </div>
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold text-surface-900 mb-6">More by {product.artist?.name}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {relatedProducts.map((rp) => (
              <ProductCard key={rp.id} product={rp} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
