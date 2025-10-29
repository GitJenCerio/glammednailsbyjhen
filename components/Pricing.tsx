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
              <div className="mb-6">
                <div className="text-4xl font-bold text-black">{(plan as any).price}</div>
                {(plan as any).addOnPrice && (
                  <div className="text-sm text-gray-500 mt-1">
                    <div className="font-medium">Add-ons:</div>
                    {Array.isArray((plan as any).addOnPrice) ? (
                      <ul className="mt-1 space-y-0.5">
                        {(plan as any).addOnPrice.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-1">{(plan as any).addOnPrice}</div>
                    )}
                  </div>
                )}
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-black mr-2">✓</span>
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="text-xs text-red-500 opacity-80 mb-4">
                <p className="mb-1">• All nail services come with 5 days warranty.</p>
                <p>• P500 advance deposit upon booking is required to secure the slot; non-refundable, but deductible from the total payment.</p>
              </div>
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

