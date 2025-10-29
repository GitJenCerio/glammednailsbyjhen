'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

// Build images 1..41, skipping 27 (file is misspelled as galley-27.JPG)
const galleryImages = Array.from({ length: 41 }, (_, i) => i + 1)
  .filter((n) => n !== 27)
  .map((n) => ({ src: `/images/gallery-${n}.JPG` }));

export default function Gallery() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Deterministic, varied heights so adjacent items rarely match
  const getTileHeight = (index: number) => {
    const baseHeights = [180, 210, 240, 270, 300, 330, 360, 390];
    const base = baseHeights[(index * 7 + 3) % baseHeights.length];
    const jitter = ((index * 13) % 40) - 20; // -20..19px
    return Math.max(160, base + jitter);
  };

  return (
    <section id="gallery" className="section-padding bg-white">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto"
      >
        <h2 className="text-4xl md:text-5xl font-acollia text-center mb-4">
          Gallery
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Browse our latest work and get inspired
        </p>

        <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
          {galleryImages.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.2) }}
              className={`mb-4 break-inside-avoid overflow-hidden rounded-2xl md:rounded-3xl cursor-pointer group`}
              style={{ height: `${getTileHeight(index)}px` }}
              onClick={() => setSelectedImage(item.src)}
            >
              <img
                src={item.src}
                alt={`Gallery image ${index + 1}`}
                className="w-full h-full object-cover rounded-2xl md:rounded-3xl group-hover:opacity-95 transition"
                loading="lazy"
                decoding="async"
                fetchPriority={index < 6 ? "high" : "low"}
              />
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
              <Image
                src={selectedImage}
                alt="Gallery image"
                fill
                className="object-contain rounded-lg"
              />
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

