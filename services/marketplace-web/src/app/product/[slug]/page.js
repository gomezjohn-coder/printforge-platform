'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import ProductCard from '@/components/ProductCard';
import { getProductImageLarge } from '@/lib/productImages';

const productTypes = ['T-Shirt', 'Hoodie', 'Sticker', 'Mug', 'Phone Case', 'Wall Art', 'Tote Bag', 'Poster'];
const sizes = ['S', 'M', 'L', 'XL', '2XL'];
const clothingTypes = ['t-shirt', 'hoodie', 'tote bag'];

export default function ProductPage({ params }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState('t-shirt');
  const [selectedSize, setSelectedSize] = useState('M');
  const [addedToCart, setAddedToCart] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/products/${params.slug}`);
        if (!res.ok) throw new Error('Product not found');
        const json = await res.json();
        const data = json.data || json;
        setProduct(data);
        if (data.productType) {
          setSelectedType(data.productType);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [params.slug]);

  const handleAddToCart = () => {
    addItem(product, selectedType, selectedSize);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const isClothingType = clothingTypes.includes(selectedType.toLowerCase());

  if (loading) {
    return (
      <div className="container-page py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-gray-200 rounded-lg aspect-square animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4" />
            <div className="h-10 bg-gray-200 rounded animate-pulse w-1/3 mt-4" />
            <div className="grid grid-cols-4 gap-2 mt-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
            <div className="h-12 bg-gray-200 rounded-lg animate-pulse mt-6" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Product not found</h1>
        <p className="text-gray-600 mb-6">The product you&apos;re looking for doesn&apos;t exist or has been removed.</p>
        <Link href="/" className="text-brand-500 hover:text-brand-600 font-semibold">
          &larr; Back to Home
        </Link>
      </div>
    );
  }

  const artistName = product.artist?.name || 'Unknown Artist';
  const artistSlug = product.artist?.slug || 'artist';
  const categoryName = product.category?.name || 'Products';
  const categorySlug = product.category?.slug || 'all';

  return (
    <div className="container-page py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-gray-700">Home</Link>
        <span>/</span>
        <Link href={`/category/${categorySlug}`} className="hover:text-gray-700">
          {categoryName}
        </Link>
        <span>/</span>
        <span className="text-gray-900">{product.title}</span>
      </nav>

      {/* Product Detail */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Left: Product Image */}
        <div>
          <img
            src={getProductImageLarge(product)}
            alt={product.title}
            className="w-full rounded-2xl shadow-sm"
          />
        </div>

        {/* Right: Product Info */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{product.title}</h1>
          <p className="text-gray-600 mt-2">
            by{' '}
            <Link href={`/artist/${artistSlug}`} className="text-brand-500 hover:text-brand-600 font-medium">
              {artistName}
            </Link>
          </p>

          <p className="text-3xl font-bold text-gray-900 mt-4">
            ${typeof product.price === 'number' ? product.price.toFixed(2) : '29.99'}
          </p>
          <p className="text-sm text-green-600 mt-1">Free shipping on orders over $35</p>

          {/* Product Type Selector */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Product Type</h3>
            <div className="grid grid-cols-4 gap-2">
              {productTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type.toLowerCase().replace(' ', '-'))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedType === type.toLowerCase().replace(' ', '-')
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Size Selector (clothing only) */}
          {isClothingType && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Size</h3>
              <div className="flex gap-2">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      selectedSize === size
                        ? 'border-gray-900 text-gray-900 bg-gray-50'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add to Cart */}
          <button
            onClick={handleAddToCart}
            className={`w-full py-3.5 rounded-xl font-semibold text-white mt-6 transition-all ${
              addedToCart
                ? 'bg-green-500'
                : 'bg-brand-500 hover:bg-brand-600 active:scale-[0.98]'
            }`}
          >
            {addedToCart ? '✓ Added to Cart!' : 'Add to Cart'}
          </button>

          {/* Description */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">About this design</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              {product.description ||
                `Original ${artistName} design printed on premium products. Every purchase directly supports the artist. Printed on demand and shipped worldwide.`}
            </p>
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/search?q=${encodeURIComponent(tag)}`}
                    className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full hover:bg-gray-200 transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* More by this artist */}
      {product.relatedProducts && product.relatedProducts.length > 0 && (
        <div className="mt-16 pt-8 border-t border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">More by {artistName}</h2>
            <Link href={`/artist/${artistSlug}`} className="text-sm text-brand-500 hover:text-brand-600 font-medium">
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {product.relatedProducts.map((related) => (
              <ProductCard key={related.id || related.slug} product={related} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
