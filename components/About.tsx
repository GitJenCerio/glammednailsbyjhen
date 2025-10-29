'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function About() {
  return (
    <section id="about" className="section-padding bg-gray-50">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative h-[400px] lg:h-[500px] mx-auto lg:mx-0"
          >
            <Image
              src="/images/about.jpg"
              alt="About us"
              fill
              className="object-cover rounded-lg"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <h2 className="text-5xl md:text-5xl font-acollia mb-6">
              About Us
            </h2>
            <p className="text-gray-600 mb-4 text-lg">
              Welcome to glammednailsbyjhen, where your nail dreams become reality. 
              We specialize in creating beautiful, long-lasting manicures and pedicures 
              that reflect your unique style.
            </p>
            <p className="text-gray-600 mb-4 text-lg">
              Our experienced team uses only the highest quality products and the latest 
              techniques to ensure your nails look flawless and stay that way. From classic 
              styles to intricate nail art, we bring your vision to life.
            </p>
            <p className="text-gray-600 text-lg">
              Book your appointment today and experience the difference that professional 
              nail care can make.
            </p>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

