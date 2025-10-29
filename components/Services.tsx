'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

const services = [
  {
    title: 'Russian Manicure (Cleaning only)',
    description: 'A meticulous, machine-based cleaning that deeply removes dead skin and refines the cuticle area for a polished, healthy nail appearance. Perfect for those who prefer natural nails without polish. This service enhances nail health, promotes cleaner regrowth, and leaves nails looking neat and naturally glossy.',
    image: '/images/service-1.JPG',
  },
  {
    title: 'Russian Manicure w/o Extensions',
    description: 'Achieve the perfect balance between natural and refined. This manicure includes complete Russian-style cleaning, cuticle detailing, and a flawless gel or BIAB overlay for long-lasting shine and strength — no extensions needed. It enhances the nail’s natural shape and keeps them looking elegant for weeks.',
    image: '/images/service-2.JPG',
  },
  {
    title: 'Nail Art',
    description: 'Turn your nails into mini masterpieces. Choose from a wide range of creative designs — from minimalist details to intricate 3D art, chrome, ombre, or hand-painted styles. Each look is carefully done to match your personality and enhance your overall aesthetic.',
    image: '/images/service-3.JPG',
  },
  {
    title: 'Russian Manicure w/ Extensions',
    description: 'Instantly elevate your look with expertly sculpted extensions using premium-quality soft gel, hard gel, or polygel. Each set is custom-shaped and finished to complement your natural nail bed. Perfect for those who want added length, durability, and style with a natural feel..',
    image: '/images/service-4.JPG',
  },
  {
    title: 'Pedicure',
    description: 'Indulge in a Russian-style pedicure with precise cuticle care and a long-lasting gel overlay for smooth, glossy toes. This service not only beautifies your nails but also maintains foot hygiene. Optional custom shades and nail art are available for a personalized finish.',
    image: '/images/service-5.JPG',
  },
  {
    title: 'Nail Repair',
    description: 'Restore your nails to perfection. Whether it’s a chipped, cracked, or broken nail, this service carefully rebuilds and strengthens it to blend seamlessly with your natural or extended nails. Ideal for maintaining the longevity and beauty of your set.',
    image: '/images/service-6.jpg',
  },
];

export default function Services() {
  return (
    <section id="services" className="section-padding bg-white">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto"
      >
        <h2 className="text-5xl md:text-5xl text-center mb-5 font-acollia">
          Our Services
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Professional nail care services tailored to your needs
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group cursor-pointer"
            >
              <div className="relative h-80 md:h-96 mb-4 overflow-hidden rounded-2xl md:rounded-3xl">
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300 rounded-2xl md:rounded-3xl"
                />
              </div>
              <h3 className="text-xl font-heading font-semibold mb-2">
                {service.title}
              </h3>
              <p className="text-gray-600 text-sm">{service.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

