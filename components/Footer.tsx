'use client';

import Image from 'next/image';
import { IoLogoFacebook, IoLogoInstagram } from 'react-icons/io5';

export default function Footer() {
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
    <footer id="book" className="bg-gray-100 section-padding">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 sm:gap-10 md:gap-12 mb-6 sm:mb-8">
          {/* About Section */}
          <div>
            <div className="mb-3 sm:mb-4">
              <Image
                src="/logo.png"
                alt="glammednailsbyjhen logo"
                width={250}
                height={80}
                className="h-10 sm:h-12 md:h-14 w-auto"
              />
            </div>
            <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
              Premium nail care services for the modern you.
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.facebook.com/profile.php?id=61557672954391"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 flex items-center justify-center bg-black text-white hover:bg-gray-800 transition-colors"
                aria-label="Facebook"
              >
                <IoLogoFacebook className="w-6 h-6" />
              </a>
              <a
                href="https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.instagram.com%2Fglammednailsbyjhen%3Ffbclid%3DIwZXh0bgNhZW0CMTAAYnJpZBExUVJjV0JXVnNLYnpsdVNpOAEe7V_AYSjBBWAeSBSjEy5ad1uUCD2-JT7VaVQ_kP0JsiWT3XsJGVNpIkVqJdg_aem_kMXTSKx6sl-wvzX_7Vkx_w&h=AT2dHEZvvdytAseyFnshV8WoD_n5v52BjKgnk_ZBmpn7pIYF1FTtiB6w_0yal1XrIVFtspjytrc2Dz4tAb3dF4mH5WfuSSj0KiOXGXRUwiGpuLhnCWI6g2cbElzd9SclqSoa"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 flex items-center justify-center bg-black text-white hover:bg-gray-800 transition-colors"
                aria-label="Instagram"
              >
                <IoLogoInstagram className="w-6 h-6" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading font-semibold text-base sm:text-lg md:text-xl mb-3 sm:mb-4">Quick Links</h4>
            <ul className="space-y-1.5 sm:space-y-2 text-gray-600 text-sm sm:text-base">
              <li>
                <a 
                  href="#home" 
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToId('#home');
                  }}
                  className="hover:text-black transition-colors cursor-pointer"
                >
                  Home
                </a>
              </li>
              <li>
                <a 
                  href="#services" 
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToId('#services');
                  }}
                  className="hover:text-black transition-colors cursor-pointer"
                >
                  Services
                </a>
              </li>
              <li>
                <a 
                  href="#about" 
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToId('#about');
                  }}
                  className="hover:text-black transition-colors cursor-pointer"
                >
                  About
                </a>
              </li>
              <li>
                <a 
                  href="#gallery" 
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToId('#gallery');
                  }}
                  className="hover:text-black transition-colors cursor-pointer"
                >
                  Gallery
                </a>
              </li>
              <li>
                <a 
                  href="#pricing" 
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToId('#pricing');
                  }}
                  className="hover:text-black transition-colors cursor-pointer"
                >
                  Pricing
                </a>
              </li>
              <li>
                <a 
                  href="#faq" 
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToId('#faq');
                  }}
                  className="hover:text-black transition-colors cursor-pointer"
                >
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-heading font-semibold text-base sm:text-lg md:text-xl mb-3 sm:mb-4">Contact Us</h4>
            <div className="text-gray-600 space-y-1.5 sm:space-y-2 text-sm sm:text-base">
              <p>Manila, Philippines</p>
              <p className="mt-3 sm:mt-4">
                <a href="tel:+639451781774" className="hover:text-black transition-colors">
                  +639451781774
                </a>
              </p>
              <p>
                <a href="mailto:glammednailsbyjhen@gmail.com" className="hover:text-black transition-colors break-words">
                  glammednailsbyjhen@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t-2 border-black pt-6 sm:pt-8 text-center text-gray-600">
          <span className="text-xs sm:text-sm text-gray-600 block mb-2 sm:mb-3">© {new Date().getFullYear()} glammednailsbyjhen</span>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            <a href="/privacy-policy" className="text-gray-500 hover:text-black text-xs sm:text-sm">Privacy Policy</a>
            <a href="/cookies-policy" className="text-gray-500 hover:text-black text-xs sm:text-sm">Cookies Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

