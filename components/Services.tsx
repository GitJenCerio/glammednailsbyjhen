'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

const services = [
  {
    title: 'Russian Manicure (Cleaning only)',
    description:
      'A meticulous, machine-based cleaning that deeply removes dead skin and refines the cuticle area for a polished, healthy nail appearance. Perfect for those who prefer natural nails without polish. This service enhances nail health, promotes cleaner regrowth, and leaves nails looking neat and naturally glossy.',
    image: '/images/service-1.jpg',
  },
  {
    title: 'Russian Manicure w/o Extensions',
    description:
      'Achieve the perfect balance between natural and refined. This manicure includes complete Russian-style cleaning, cuticle detailing, and a flawless gel or BIAB overlay for long-lasting shine and strength — no extensions needed. It enhances the nail\'s natural shape and keeps them looking elegant for weeks.',
    image: '/images/service-2.jpg',
  },
  {
    title: 'Nail Art',
    description:
      'Turn your nails into mini masterpieces. Choose from a wide range of creative designs — from minimalist details to intricate 3D art, chrome, ombre, or hand-painted styles. Each look is carefully done to match your personality and enhance your overall aesthetic.',
    image: '/images/service-3.jpg',
  },
  {
    title: 'Russian Manicure w/ Extensions',
    description:
      'Instantly elevate your look with expertly sculpted extensions using premium-quality soft gel, hard gel, or polygel. Each set is custom-shaped and finished to complement your natural nail bed. Perfect for those who want added length, durability, and style with a natural feel..',
    image: '/images/service-4.jpg',
  },
  {
    title: 'Pedicure',
    description:
      'Indulge in a Russian-style pedicure with precise cuticle care and a long-lasting gel overlay for smooth, glossy toes. This service not only beautifies your nails but also maintains foot hygiene. Optional custom shades and nail art are available for a personalized finish.',
    image: '/images/service-5.jpg',
  },
  {
    title: 'Nail Repair',
    description:
      'Restore your nails to perfection. Whether it’s a chipped, cracked, or broken nail, this service carefully rebuilds and strengthens it to blend seamlessly with your natural or extended nails. Ideal for maintaining the longevity and beauty of your set.',
    image: '/images/service-6.jpg',
  },
];

export default function Services() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <section id="services" className="section-padding bg-white">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-0"
      >
        <div id="services" style={{ scrollMarginTop: '180px', height: 0 }} />
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-center mb-4 sm:mb-5 font-acollia px-3 sm:px-4">Our Services</h2>
        <p className="text-center text-gray-600 mb-8 sm:mb-10 md:mb-12 max-w-2xl mx-auto px-3 sm:px-4 text-sm sm:text-base">
          Professional nail care services tailored to your needs
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 px-3 sm:px-6">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
              className="group cursor-pointer"
            >
              <div
                className="relative h-64 sm:h-72 md:h-80 lg:h-96 mb-3 sm:mb-4 overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl"
                onClick={() => setSelectedImage(service.image)}
              >
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  loading="lazy"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-110 transition-transform duration-300 rounded-xl sm:rounded-2xl md:rounded-3xl"
                />
              </div>
              <h3 className="text-lg sm:text-xl md:text-2xl font-heading font-semibold mb-2">{service.title}</h3>
              <p className="text-gray-600 text-xs sm:text-sm md:text-base text-justify leading-relaxed">{service.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="relative max-w-5xl w-full h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <Image src={selectedImage} alt="Service image" fill className="object-contain rounded-lg" />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 text-white text-4xl font-bold hover:text-gray-300"
              >
                ×
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

