'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

const services = [
  {
    title: 'Classic Manicure',
    description: 'Traditional nail care with polish of your choice.',
    image: '/images/service-1.jpg',
  },
  {
    title: 'Gel Manicure',
    description: 'Long-lasting color with UV gel technology.',
    image: '/images/service-2.jpg',
  },
  {
    title: 'Nail Art',
    description: 'Custom designs and creative nail artistry.',
    image: '/images/service-3.jpg',
  },
  {
    title: 'Nail Extensions',
    description: 'Acrylic or gel extensions for length and strength.',
    image: '/images/service-4.jpg',
  },
  {
    title: 'Pedicure',
    description: 'Relaxing foot care and polish.',
    image: '/images/service-5.jpg',
  },
  {
    title: 'Nail Repair',
    description: 'Fix broken or damaged nails.',
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
        <h2 className="text-4xl md:text-5xl font-heading font-bold text-center mb-4">
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
              <div className="relative h-64 mb-4 overflow-hidden">
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
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

