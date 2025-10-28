'use client';

import { motion } from 'framer-motion';

const pricingPlans = [
  {
    name: 'Classic Manicure',
    price: '$25',
    features: ['Nail shaping', 'Cuticle care', 'Polish application', 'Hand massage'],
  },
  {
    name: 'Gel Manicure',
    price: '$40',
    features: ['Nail shaping', 'Cuticle care', 'Gel polish', 'Hand massage', 'Lasts 2-3 weeks'],
  },
  {
    name: 'Nail Art Design',
    price: '$55',
    features: ['Gel manicure included', 'Custom design', 'Multiple colors', 'Rhinestones/decorations'],
  },
  {
    name: 'Nail Extensions',
    price: '$65',
    features: ['Full set extensions', 'Acrylic or gel', 'Polish application', 'Free touch-up within 2 weeks'],
  },
  {
    name: 'Classic Pedicure',
    price: '$40',
    features: ['Foot soak', 'Callus removal', 'Nail shaping', 'Polish application', 'Leg massage'],
  },
  {
    name: 'Gel Pedicure',
    price: '$50',
    features: ['Classic pedicure', 'Gel polish', 'Gel toe overlay', 'Lasts 3-4 weeks'],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="section-padding bg-gray-50">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto"
      >
        <h2 className="text-4xl md:text-5xl font-acollia text-center mb-4">
          Pricing
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Transparent pricing for all our services
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pricingPlans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="bg-white p-8 border-2 border-black hover:border-black/50 transition-all"
            >
              <h3 className="text-2xl font-heading font-bold mb-4">{plan.name}</h3>
              <div className="text-4xl font-bold mb-6 text-black">{plan.price}</div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-black mr-2">✓</span>
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#book"
                className="block w-full text-center px-6 py-3 bg-black text-white font-medium hover:bg-transparent hover:text-black border-2 border-black transition-all"
              >
                Book Now
              </a>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

