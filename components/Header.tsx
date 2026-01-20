'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { IoMenu, IoClose } from 'react-icons/io5';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { href: '#home', label: 'Home', isRoute: false },
    { href: '#services', label: 'Services', isRoute: false },
    { href: '#about', label: 'About', isRoute: false },
    { href: '#gallery', label: 'Gallery', isRoute: false },
    { href: '#pricing', label: 'Pricing', isRoute: false },
    { href: '#faq', label: 'FAQ', isRoute: false },
    { href: '/booking', label: 'Booking Calendar', isRoute: true },
  ];

  const scrollToId = (hash: string) => {
    if (!hash || !hash.startsWith('#')) return;
    const id = hash.slice(1);
    
    // If we're not on the home page, navigate there first
    if (window.location.pathname !== '/') {
      window.location.href = `/${hash}`;
      return;
    }
    
    const el = document.getElementById(id);
    if (!el) return;
    // Header offset (tune if needed)
    const HEADER_OFFSET = 80;
    const y = el.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md w-full max-w-full"
    >
      <nav className="pl-2 pr-2 sm:pl-3 sm:pr-3 md:px-6 lg:px-8 xl:px-12 2xl:px-16 flex items-center justify-between py-4 sm:py-6 md:py-8 relative min-h-[70px] sm:min-h-[80px] md:min-h-[90px] overflow-x-hidden gap-1 sm:gap-2 w-full max-w-full">
        {/* Mobile Menu Button - Left */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 z-50 flex-shrink-0 bg-transparent hover:bg-gray-100 rounded-lg transition-colors relative"
          aria-label="Toggle menu"
        >
          {isOpen ? (
            <IoClose className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
          ) : (
            <IoMenu className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
          )}
        </button>

        {/* Invisible placeholder to balance for justify-between on desktop */}
        <div className="hidden lg:block w-24 flex-shrink-0"></div>

        {/* Center Group: Logo + Navigation - Centered */}
        <div className="hidden lg:flex items-center gap-2 lg:gap-3 xl:gap-4 absolute left-1/2 -translate-x-1/2 max-w-[70vw]">
          <Link href="/" className="flex items-center flex-shrink-0">
            <Image 
              src="/logo.png" 
              alt="glammednailsbyjhen logo" 
              width={200}
              height={64}
              className="h-10 md:h-12 lg:h-12 xl:h-14 w-auto max-w-[120px] md:max-w-[140px] lg:max-w-[150px] xl:max-w-[180px]"
              priority
            />
          </Link>
          <div className="hidden lg:flex items-center gap-2 xl:gap-3 2xl:gap-4">
            {navLinks.map((link) => (
              link.isRoute ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs lg:text-sm font-medium text-gray-600 hover:text-black transition-colors cursor-pointer whitespace-nowrap"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToId(link.href);
                  }}
                  className="text-xs lg:text-sm font-medium text-gray-600 hover:text-black transition-colors cursor-pointer whitespace-nowrap"
                >
                  {link.label}
                </a>
              )
            ))}
          </div>
        </div>

        {/* Mobile Logo - Centered */}
        <Link href="/" className="lg:hidden absolute left-1/2 -translate-x-1/2 flex items-center justify-center max-w-[40vw] sm:max-w-[35vw]">
          <Image 
            src="/logo.png" 
            alt="glammednailsbyjhen logo" 
            width={200}
            height={56}
            className="h-10 sm:h-12 md:h-14 w-auto max-w-full"
            priority
          />
        </Link>

        {/* Book Appointment Button - Far Right */}
        <Link
          href="/booking"
          className="hidden lg:block px-3 lg:px-4 xl:px-5 py-2 lg:py-2.5 bg-black text-white font-medium border-2 border-white shadow-[0_0_0_2px_#000000] hover:bg-white hover:text-black hover:border hover:border-black hover:shadow-[0_0_0_2px_#ffffff,0_0_0_3px_#000000] transition-all duration-300 text-xs lg:text-sm whitespace-nowrap flex-shrink-0"
        >
          Book Now
        </Link>

        {/* Mobile Book Button - Right */}
        <Link
          href="/booking"
          className="lg:hidden px-1.5 py-1 sm:px-2 sm:py-1.5 bg-black text-white font-medium border border-white shadow-none hover:bg-white hover:text-black hover:border hover:border-black transition-all duration-300 text-[9px] sm:text-[10px] whitespace-nowrap flex-shrink-0 z-10 relative"
        >
          Book
        </Link>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden absolute left-2 sm:left-4 top-full mt-0 bg-white border-t border-gray-200 rounded-b-xl shadow-2xl z-[100] max-w-[90vw] sm:max-w-xs w-[280px] sm:w-64 overflow-hidden"
          >
            <div className="px-2 py-4 space-y-3">
              {navLinks.map((link) => (
                link.isRoute ? (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="block text-base font-medium text-gray-600 hover:text-black cursor-pointer px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      setIsOpen(false);
                      setTimeout(() => {
                        scrollToId(link.href);
                      }, 150);
                    }}
                    className="block text-base font-medium text-gray-600 hover:text-black cursor-pointer px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {link.label}
                  </a>
                )
              ))}
              <Link
                href="/booking"
                onClick={() => setIsOpen(false)}
                className="block w-full px-4 py-2 bg-black text-white font-medium text-center border-2 border-white rounded-lg shadow-[0_0_0_2px_#000000] hover:bg-white hover:text-black hover:border hover:border-black hover:shadow-[0_0_0_2px_#ffffff,0_0_0_3px_#000000] transition-all duration-300 mt-2"
              >
                Book Now
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

