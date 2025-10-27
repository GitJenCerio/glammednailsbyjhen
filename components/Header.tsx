'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { href: '#home', label: 'Home' },
    { href: '#services', label: 'Services' },
    { href: '#about', label: 'About' },
    { href: '#gallery', label: 'Gallery' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md"
    >
      <nav className="px-6 md:px-12 lg:px-16 xl:px-24 flex items-center justify-between py-8 relative">
        {/* Mobile Menu Button - Left */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden flex flex-col gap-1.5 w-6"
          aria-label="Toggle menu"
        >
          <motion.span
            animate={isOpen ? { rotate: 45, y: 8 } : {}}
            className="w-full h-0.5 bg-black"
          />
          <motion.span
            animate={isOpen ? { opacity: 0 } : { opacity: 1 }}
            className="w-full h-0.5 bg-black"
          />
          <motion.span
            animate={isOpen ? { rotate: -45, y: -8 } : {}}
            className="w-full h-0.5 bg-black"
          />
        </button>

        {/* Invisible placeholder to balance for justify-between on desktop */}
        <div className="hidden md:block w-32"></div>

        {/* Center Group: Logo + Navigation - Centered */}
        <div className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
          <Link href="/" className="flex items-center px-4">
            <img 
              src="/logo.svg" 
              alt="glammednailsbyjhen logo" 
              className="h-12 md:h-16 lg:h-20 w-auto"
            />
          </Link>
          <div className="flex items-center gap-8">
            {navLinks.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-black transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile Logo - Centered */}
        <Link href="/" className="md:hidden absolute left-1/2 -translate-x-1/2 px-4">
          <img 
            src="/logo.svg" 
            alt="glammednailsbyjhen logo" 
            className="h-10 w-auto"
          />
        </Link>

        {/* Book Appointment Button - Far Right */}
        <Link
          href="#book"
          className="hidden md:block px-6 py-2.5 bg-black text-white font-medium hover:bg-black/90 transition-colors text-sm whitespace-nowrap"
        >
          Book Appointment
        </Link>

        {/* Mobile Book Button - Right */}
        <Link
          href="#book"
          className="md:hidden px-4 py-1.5 bg-black text-white font-medium hover:bg-black/90 transition-colors text-xs"
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
            className="md:hidden bg-white border-t"
          >
            <div className="px-6 py-4 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="block text-base font-medium text-gray-600 hover:text-black"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="#book"
                onClick={() => setIsOpen(false)}
                className="block w-full px-6 py-2 bg-black text-white font-medium text-center"
              >
                Book Appointment
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

