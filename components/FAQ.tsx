'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string | string[];
}

interface FAQSection {
  title: string;
  items: FAQItem[];
}

const faqSections: FAQSection[] = [
  {
    title: 'Appointments & Booking',
    items: [
      {
        question: 'Do you accept walk-ins?',
        answer: 'My studio operates strictly by appointment only to give each client the proper time and care they deserve.'
      },
      {
        question: 'Do you accept same-day bookings?',
        answer: 'Yes, same-day bookings are accepted depending on availability. Please note that a squeeze-in fee may apply for rush appointments.'
      },
      {
        question: 'How do I book an appointment?',
        answer: 'You can book through my official booking form, social media page, or by messaging directly. Once your slot is confirmed, you’ll receive the details and preparation reminders.'
      },
      {
        question: 'Is there a deposit required?',
        answer: 'Yes, a ₱500 deposit is required to secure your appointment. This will be deducted from your total bill during your visit. Deposits are non-refundable but may be transferred if you reschedule within the allowed timeframe.'
      },
      {
        question: 'What if I’m late?',
        answer: [
          '15 minutes late = ₱200 late fee',
          '30 minutes late = Appointment cancelled and deposit forfeited'
        ]
      },
      {
        question: 'Can I reschedule?',
        answer: [
          'Yes, rescheduling is allowed up to 3 days before your appointment. A ₱200 rescheduling fee applies and must be settled before confirming your new slot.',
          'Failure to reschedule within the timeframe will result in deposit forfeiture.'
        ]
      },
    ]
  },
  {
    title: 'Russian Manicure & Services',
    items: [
      {
        question: 'Does the Russian Manicure hurt?',
        answer: 'No, it should never hurt. It’s a gentle, detailed process. If you ever feel discomfort, please let your nail tech know right away so adjustments can be made.'
      },
      {
        question: 'What makes the Russian Manicure special?',
        answer: 'It uses a precise e-file technique to clean and refine the cuticles safely, giving a super clean and long-lasting result. It’s perfect for those who want flawless, natural-looking nails.'
      },
      {
        question: 'Can men book a Russian Manicure?',
        answer: 'Yes! It’s ideal for men who prefer a clean, well-groomed look. Clear or natural builder gel can also be added for extra strength and shine.'
      },
      {
        question: 'Can I book both manicure and pedicure in one session?',
        answer: 'Yes! You can book both — just inform your nail tech in advance so the schedule can be properly adjusted.'
      },
    ]
  },
  {
    title: 'Studio Rules & Comfort',
    items: [
      {
        question: 'Can I bring a companion?',
        answer: 'Yes, one companion per client is allowed to maintain a peaceful atmosphere. Please inform them about the procedure length, as sessions can take time. A relaxed environment helps ensure your nails turn out perfectly!'
      },
      {
        question: 'Can I bring my child?',
        answer: 'Yes, you may bring your child as long as they can stay calm and behave during the session. There’s a TV available in the studio so your child can watch while we do your nails.'
      },
      {
        question: 'Do you have pets?',
        answer: [
          'Yes 🐶 I have two friendly dogs — a Shih Tzu and a Mini Pinscher. They may greet you when you arrive but will settle down soon after.',
          'If you have dog allergies or asthma, I recommend booking a home service instead for your safety and comfort.'
        ]
      },
      {
        question: 'Is there parking available?',
        answer: 'There’s no dedicated parking space, but street parking is available near the studio. Please plan accordingly.'
      },
    ]
  },
  {
    title: 'During Your Session',
    items: [
      {
        question: 'What should I do during the procedure?',
        answer: 'Once your session starts, please keep your hands steady and relaxed. Avoid touching anything that may cause dust or hair to stick to your nails.'
      },
      {
        question: 'Can I use my phone?',
        answer: 'You may use your phone in between steps, but please minimize movement once the polishing or intricate detailing begins.'
      },
      {
        question: 'Can I take breaks?',
        answer: 'Of course! You can request a water, CR, or stretch break anytime. Your comfort always comes first.'
      },
      {
        question: 'What if I feel burning during gel curing?',
        answer: 'A mild warm sensation is normal, but if it feels hot, gently pull your hand out of the lamp and let your nail tech know.'
      },
      {
        question: 'Can I send an inspo photo before my appointment?',
        answer: 'Yes, please do! Sending your nail design inspiration in advance helps your nail tech prepare materials and plan the design ahead — especially for intricate nail art.'
      },
    ]
  },
  {
    title: 'Payments & Fees',
    items: [
      {
        question: 'How much are your services?',
        answer: 'Prices depend on your chosen service and design complexity. A full price list is available on the Services page or by message upon request.'
      },
      {
        question: 'What payment methods do you accept?',
        answer: 'I accept Cash, GCash, and PNB transfers.'
      },
      {
        question: 'Is the deposit deductible from the total?',
        answer: 'Yes, your ₱500 deposit will be deducted from your final total on the day of your appointment.'
      },
    ]
  },
  {
    title: 'Aftercare & Nail Maintenance',
    items: [
      {
        question: 'How long will my nails last?',
        answer: 'With proper care, your gel or builder nails can last 3–5 weeks, depending on your daily activities.'
      },
      {
        question: 'What’s the best way to care for my nails?',
        answer: [
          'Moisturize cuticles regularly with cuticle oil.',
          'Avoid using your nails as tools.',
          'Wear gloves when washing dishes or cleaning.',
          'Schedule a refill or removal once your nails grow out.'
        ]
      },
      {
        question: 'Can I remove my gel or extensions at home?',
        answer: 'It’s not recommended. DIY removal can cause damage to your natural nails. Book a professional removal for safe and proper care.'
      },
    ]
  },
  {
    title: 'Studio Information & Amenities',
    items: [
      {
        question: 'Location',
        answer: '701-B Carola, Sampaloc, Manila\n(Google Map Pin: Granma Laundry Shoppe)'
      },
      {
        question: 'Studio Hours',
        answer: 'By appointment only — please confirm your slot before visiting.'
      },
      {
        question: 'Amenities & Reminders',
        answer: [
          'Feel free to ask for water, charger, or a CR break anytime.',
          'Wi-Fi and TV available for your comfort.',
          'Please relax and enjoy your session — quality takes time.',
          'Your comfort and satisfaction are always my top priority! ✨'
        ]
      },
    ]
  },
];

export default function FAQ() {
  const [openSectionIdx, setOpenSectionIdx] = useState<number | null>(null);
  const [openItemIdx, setOpenItemIdx] = useState<number | null>(null);
  // Collapsed/expanded for each section
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});

  const toggleFAQ = (sectionIdx: number, itemIdx: number) => {
    if (openSectionIdx === sectionIdx && openItemIdx === itemIdx) {
      setOpenSectionIdx(null);
      setOpenItemIdx(null);
    } else {
      setOpenSectionIdx(sectionIdx);
      setOpenItemIdx(itemIdx);
    }
  };

  const toggleSection = (sectionIdx: number) => {
    setExpandedSections((prev) => ({ ...prev, [sectionIdx]: !prev[sectionIdx] }));
  };

  return (
    <section id="faq" className="section-padding bg-white">
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8"
      >
        <div id="faq" style={{ scrollMarginTop: '180px', height: 0 }} />
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-acollia text-center mb-3 sm:mb-4 px-3 sm:px-4">Frequently Asked Questions</h2>
        <p className="text-center text-gray-600 mb-8 sm:mb-10 md:mb-12 text-sm sm:text-base px-3 sm:px-4">Have questions? We have answers</p>
        <div className="space-y-6 sm:space-y-8">
          {faqSections.map((section, sectionIdx) => {
            const expanded = expandedSections[sectionIdx];
            const itemsToShow = expanded ? section.items : section.items.slice(0, 2);
            return (
              <div key={section.title}>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold border-l-4 border-black pl-2 sm:pl-3 mb-3 sm:mb-4">{section.title}</h3>
                <div className="space-y-3 sm:space-y-4">
                  {itemsToShow.map((faq, itemIdx) => (
                    <motion.div
                      key={faq.question}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: Math.min(itemIdx * 0.03, 0.2) }}
                      className="border-2 border-black bg-white"
                    >
                      <button
                        onClick={() => toggleFAQ(sectionIdx, itemIdx)}
                        className="w-full px-4 sm:px-5 md:px-6 py-3 sm:py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-semibold text-sm sm:text-base md:text-lg pr-2">{faq.question}</span>
                        <motion.span
                          animate={{ rotate: openSectionIdx === sectionIdx && openItemIdx === itemIdx ? 180 : 0 }}
                          className="text-xl sm:text-2xl font-bold flex-shrink-0"
                        >
                          +
                        </motion.span>
                      </button>
                      <motion.div
                        initial={false}
                        animate={{
                          height: openSectionIdx === sectionIdx && openItemIdx === itemIdx ? 'auto' : 0,
                          opacity: openSectionIdx === sectionIdx && openItemIdx === itemIdx ? 1 : 0,
                        }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 sm:px-5 md:px-6 py-3 sm:py-4 text-gray-600 border-t-2 border-black text-sm sm:text-base leading-relaxed">
                          {Array.isArray(faq.answer) ? (
                            <ul className="list-disc list-inside space-y-1 sm:space-y-1.5">
                              {faq.answer.map((line, i) => (
                                <li key={i}>{line}</li>
                              ))}
                            </ul>
                          ) : (
                            <span>{faq.answer}</span>
                          )}
                        </div>
                      </motion.div>
                    </motion.div>
                  ))}

                  {section.items.length > 2 && (
                    <div className="flex justify-center mt-2 sm:mt-3">
                      <button
                        className="px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 rounded-full font-semibold text-xs sm:text-sm md:text-base bg-gray-200 text-gray-700 focus:outline-none hover:bg-gray-300 transition-colors"
                        onClick={() => toggleSection(sectionIdx)}
                        type="button"
                      >
                        {expanded ? 'Show less' : 'Show more'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}

