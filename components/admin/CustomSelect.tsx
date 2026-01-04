'use client';

import { useState, useRef, useEffect } from 'react';
import { getNailTechColorClasses } from '@/lib/utils';

type Option = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  allNailTechIds?: string[];
};

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  allNailTechIds,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full sm:w-auto min-w-[200px] rounded-lg border-2 border-slate-300 bg-white px-3 py-2 pr-8 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 flex items-center justify-between ${
          isOpen ? 'ring-2 ring-slate-400' : ''
        }`}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.map((option) => {
            const isSelected = option.value === value;
            const isNailTechOption = option.value !== '' && allNailTechIds?.includes(option.value);
            
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-black text-white'
                    : 'bg-white text-slate-900 hover:bg-slate-100'
                } ${option.value === options[0]?.value ? 'rounded-t-lg' : ''} ${
                  option.value === options[options.length - 1]?.value ? 'rounded-b-lg' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{option.label}</span>
                  {isSelected && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

