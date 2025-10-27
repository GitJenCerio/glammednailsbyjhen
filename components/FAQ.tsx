'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'Do you take walk-ins?',
    answer: 'We recommend booking in advance to ensure availability, but we do accept walk-ins based on schedule availability. Please call ahead to check same-day availability.',
  },
  {
    question: 'Are your products safe for sensitive skin?',
    answer: 'Yes, we use high-quality, hypoallergenic products suitable for sensitive skin. Please inform us of any allergies or skin sensitivities before your appointment, and we\'ll customize the service to your needs.',
  },
  {
    question: 'Do you offer group bookings?',
    answer: 'Absolutely! We love hosting groups and special events. Group bookings of 4 or more receive a 10% discount. Please book at least 2 weeks in advance for group appointments.',
  },
  {
    question: 'How long does a typical manicure last?',
    answer: 'A classic manicure typically lasts 5-7 days, while gel manicures last 2-3 weeks. The longevity depends on your nail growth and daily activities.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="section-padding bg-white">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto"
      >
        <h2 className="text-4xl md:text-5xl font-heading font-bold text-center mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-center text-gray-600 mb-12">
          Have questions? We have answers
        </p>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="border-2 border-black bg-white"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-lg">{faq.question}</span>
                <motion.span
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  className="text-2xl font-bold"
                >
                  +
                </motion.span>
              </button>
              <motion.div
                initial={false}
                animate={{
                  height: openIndex === index ? 'auto' : 0,
                  opacity: openIndex === index ? 1 : 0,
                }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-6 py-4 text-gray-600 border-t-2 border-black">
                  {faq.answer}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

