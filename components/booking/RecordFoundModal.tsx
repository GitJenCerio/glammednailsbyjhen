'use client';

import { motion } from 'framer-motion';
import { IoCheckmarkCircleOutline, IoClose } from 'react-icons/io5';

type RecordFoundModalProps = {
  open: boolean;
  customerName: string;
  onClose: () => void;
  onProceed: () => void;
};

export function RecordFoundModal({ open, customerName, onClose, onProceed }: RecordFoundModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-100 border-2 border-slate-300 rounded-lg max-w-md w-full p-4 sm:p-6 md:p-8 shadow-xl shadow-slate-900/20 my-4 max-h-[90vh] overflow-y-auto relative"
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 sm:p-2 rounded-full hover:bg-slate-200 active:bg-slate-300 transition-colors touch-manipulation z-10"
          aria-label="Close"
          type="button"
        >
          <IoClose className="w-5 h-5 sm:w-6 sm:h-6 text-slate-700" />
        </button>

        <div className="flex items-start gap-4 mb-4 sm:mb-6">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <IoCheckmarkCircleOutline className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-xl sm:text-2xl font-heading font-semibold mb-2 pr-8 sm:pr-10">
              Record Found
            </h3>
            <p className="text-sm sm:text-base text-slate-600 mb-4">
              Welcome back, <strong>{customerName}</strong>!
            </p>
          </div>
        </div>

        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mb-4 sm:mb-6">
          <p className="text-xs sm:text-sm text-emerald-900 leading-relaxed">
            Your details are confirmed. You can now proceed to the booking form.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onProceed();
            }}
            className="w-full px-4 py-3 sm:py-2 bg-black text-white font-medium border-2 border-white shadow-[0_0_0_2px_#000000] hover:bg-white hover:text-black hover:border hover:border-black hover:shadow-[0_0_0_2px_#ffffff,0_0_0_3px_#000000] active:scale-[0.98] transition-all duration-300 touch-manipulation text-sm sm:text-base"
          >
            Proceed to Booking Form
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="w-full px-4 py-3 sm:py-2 bg-slate-200 text-slate-800 font-medium border-2 border-slate-300 rounded-lg hover:bg-slate-300 active:scale-[0.98] transition-all duration-300 touch-manipulation text-sm sm:text-base"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

