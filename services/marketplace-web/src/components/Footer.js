import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container-page py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-white font-semibold mb-4">Shop</h3>
            <ul className="space-y-2">
              <li><Link href="/category/t-shirts" className="text-gray-400 hover:text-white text-sm">T-Shirts</Link></li>
              <li><Link href="/category/hoodies" className="text-gray-400 hover:text-white text-sm">Hoodies</Link></li>
              <li><Link href="/category/stickers" className="text-gray-400 hover:text-white text-sm">Stickers</Link></li>
              <li><Link href="/category/phone-cases" className="text-gray-400 hover:text-white text-sm">Phone Cases</Link></li>
              <li><Link href="/category/wall-art" className="text-gray-400 hover:text-white text-sm">Wall Art</Link></li>
              <li><Link href="/category/mugs" className="text-gray-400 hover:text-white text-sm">Mugs</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">About</h3>
            <ul className="space-y-2">
              <li><Link href="#" className="text-gray-400 hover:text-white text-sm">Company</Link></li>
              <li><Link href="#" className="text-gray-400 hover:text-white text-sm">Careers</Link></li>
              <li><Link href="#" className="text-gray-400 hover:text-white text-sm">Blog</Link></li>
              <li><Link href="#" className="text-gray-400 hover:text-white text-sm">Press</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <li><Link href="#" className="text-gray-400 hover:text-white text-sm">Help Center</Link></li>
              <li><Link href="#" className="text-gray-400 hover:text-white text-sm">Returns</Link></li>
              <li><Link href="#" className="text-gray-400 hover:text-white text-sm">Shipping Info</Link></li>
              <li><Link href="#" className="text-gray-400 hover:text-white text-sm">Contact Us</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Sell Your Art</h3>
            <ul className="space-y-2">
              <li><Link href="#" className="text-gray-400 hover:text-white text-sm">Start Selling</Link></li>
              <li><Link href="#" className="text-gray-400 hover:text-white text-sm">Artist Resources</Link></li>
              <li><Link href="#" className="text-gray-400 hover:text-white text-sm">Artist Blog</Link></li>
              <li><Link href="#" className="text-gray-400 hover:text-white text-sm">Guidelines</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 py-6 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-500 text-sm">&copy; 2024 RawCanvas. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link href="#" className="text-gray-500 text-sm hover:text-gray-400">Privacy Policy</Link>
            <Link href="#" className="text-gray-500 text-sm hover:text-gray-400">Terms of Service</Link>
            <Link href="#" className="text-gray-500 text-sm hover:text-gray-400">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
