'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

// Fallback pricing data
const defaultPricingPlans = [
  {
    name: 'Classic Manicure',
    price: '$25',
    addOnPrice: '$10+',
    features: ['Nail shaping', 'Cuticle care', 'Polish application', 'Hand massage'],
  },
  {
    name: 'Gel Manicure',
    price: '$40',
    addOnPrice: '$10+',
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
    addOnPrice: '$15+',
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

// Configure this URL to point to your Google Sheet CSV export
// Format: https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQvjSeJtqzg0f4q0D2w4ihCFW6WwStYXpcJMHF7wVfo2iMbrIxuAL4ECPvYCupDsEq-fSuaN_hzI95z/pub?output=csv'; // Add your Google Sheet CSV URL here

export default function Pricing() {
  const [pricingPlans, setPricingPlans] = useState(defaultPricingPlans);

  useEffect(() => {
    // Function to parse CSV data
    const parseCSV = (text: string) => {
      const lines = text.split('\n');
      const plans = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Simple CSV parsing (handles quoted values)
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim()); // Add last value
        
        // Backward compatible columns:
        // 3 columns: Name, Price, Features
        // 4+ columns: Name, Base Price, Add-on Price, Features
        if (values.length >= 3) {
          if (values.length >= 4) {
            const [name, basePrice, addOnPrice, featuresStr] = values;
            const features = featuresStr ? featuresStr.split(';').map(f => f.trim()).filter(f => f) : [];
            const addOnRaw = (addOnPrice || '').trim();
            let addOnParsed: any = undefined;
            if (addOnRaw) {
              const parts = addOnRaw.split(/[;,]/).map(p => p.trim()).filter(p => p);
              addOnParsed = parts.length > 1 ? parts : parts[0];
            }
            plans.push({
              name: name.trim(),
              price: basePrice.trim(),
              addOnPrice: addOnParsed,
              features: features,
            });
          } else {
            const [name, price, featuresStr] = values;
            const features = featuresStr ? featuresStr.split(';').map(f => f.trim()).filter(f => f) : [];
            plans.push({
              name: name.trim(),
              price: price.trim(),
              features: features,
            });
          }
        }
      }
      
      return plans;
    };

    // Fetch data from Google Sheets if URL is provided
    if (GOOGLE_SHEET_CSV_URL) {
      fetch(GOOGLE_SHEET_CSV_URL)
        .then(response => response.text())
        .then(data => {
          const plans = parseCSV(data);
          if (plans.length > 0) {
            setPricingPlans(plans);
          }
        })
        .catch(error => {
          console.error('Error fetching pricing data:', error);
        });
    }
  }, []);

  return (
    <section id="pricing" className="section-padding bg-gray-50">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8"
      >
        <div id="pricing" style={{ scrollMarginTop: '180px', height: 0 }} />
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-acollia text-center mb-3 sm:mb-4 px-3 sm:px-4">
          Pricing
        </h2>
        <p className="text-center text-gray-600 mb-8 sm:mb-10 md:mb-12 max-w-2xl mx-auto px-3 sm:px-4 text-sm sm:text-base">
          Transparent pricing for all our services
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {pricingPlans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
              className="bg-white p-4 sm:p-5 md:p-6 border-2 border-black hover:border-black/50 transition-all rounded-lg flex flex-col shadow-lg shadow-black/15"
            >
              <h3 className="text-lg sm:text-xl md:text-2xl font-heading font-bold mb-1 sm:mb-1.5">{plan.name}</h3>
              <div className="mb-1.5 sm:mb-2">
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-black">{(plan as any).price}</div>
                {(plan as any).addOnPrice && (
                  <div className="text-xs text-gray-500 mt-1">
                    <div className="font-medium">Add-ons:</div>
                    {Array.isArray((plan as any).addOnPrice) ? (
                      <ul className="mt-0.5 space-y-0">
                        {(plan as any).addOnPrice.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-0.5">{(plan as any).addOnPrice}</div>
                    )}
                  </div>
                )}
              </div>
              <ul className="space-y-1 mb-1.5 sm:mb-2">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start min-h-[1.5rem]">
                    <span className="text-black mr-1.5 sm:mr-2 flex-shrink-0 mt-0.5">✓</span>
                    <span className="text-gray-600 text-xs sm:text-sm md:text-base leading-normal">{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="text-xs sm:text-sm mb-2 sm:mb-3">
                <p className="mb-0 text-black text-center leading-tight sm:leading-snug">• All nail services come with 5 days warranty.</p>
                <p className="text-[10px] sm:text-xs text-red-600 text-center leading-tight sm:leading-snug">• P500 advance deposit upon booking is required to secure the slot; non-refundable, but deductible from the total payment.</p>
              </div>
              <a
                href="/booking"
                className="block w-full text-center px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 bg-black text-white font-medium border-2 border-white shadow-[0_0_0_2px_#000000] hover:bg-white hover:text-black hover:border hover:border-black hover:shadow-[0_0_0_2px_#ffffff,0_0_0_3px_#000000] transition-all duration-300 mt-auto text-xs sm:text-sm md:text-base whitespace-nowrap"
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

