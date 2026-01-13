'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function About() {
  return (
    <section id="about" className="section-padding bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "0px" }}
            transition={{ duration: 0.5 }}
            className="relative h-[300px] sm:h-[350px] md:h-[400px] lg:h-[500px] w-full mx-auto lg:mx-0 overflow-hidden rounded-lg"
          >
            <Image
              src="/images/about.jpg"
              alt="About us"
              fill
              loading="lazy"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover rounded-lg"
              quality={90}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "0px" }}
            transition={{ duration: 0.5 }}
            className="text-center lg:text-left px-3 sm:px-0"
          >
            <div id="about" style={{ scrollMarginTop: '180px', height: 0 }} />
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-acollia mb-4 sm:mb-6">
              About Us
            </h2>
            <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base md:text-lg text-justify leading-relaxed">
              Welcome to glammednailsbyjhen, where your nail dreams become reality. 
              We specialize in creating beautiful, long-lasting manicures and pedicures 
              that reflect your unique style.
            </p>
            <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base md:text-lg text-justify leading-relaxed">
              Our experienced team uses only the highest quality products and the latest 
              techniques to ensure your nails look flawless and stay that way. From classic 
              styles to intricate nail art, we bring your vision to life.
            </p>
            <p className="text-gray-600 text-sm sm:text-base md:text-lg text-justify leading-relaxed">
              Book your appointment today and experience the difference that professional 
              nail care can make.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

