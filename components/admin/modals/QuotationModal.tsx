'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import html2canvas from 'html2canvas';
import type { Booking, BookingWithSlot } from '@/lib/types';
import { format } from 'date-fns';

type QuoteItem = {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
};

const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Squeeze-in fee amount (can be configured)
const SQUEEZE_IN_FEE = 500; // Default squeeze-in fee amount

type PriceSheetRow = {
  name: string;
  displayPrice: string;
  unitPrice: number | null;
};

const PRICE_SHEET_TSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSf9_fW2behj5fsi9CuLwzfikCow5WKEaXYDpKkjzZMW6gFtUzC9Ei6UWwixB0FY0mwDE83X7lugGX3/pub?output=tsv';

type QuotationModalProps = {
  booking: Booking | BookingWithSlot | null;
  slotLabel?: string;
  onClose: () => void;
  onSendInvoice?: (bookingId: string, invoiceData: { items: QuoteItem[]; total: number; notes: string }) => Promise<void>;
};

export function QuotationModal({ booking, slotLabel, onClose, onSendInvoice }: QuotationModalProps) {
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [customLabel, setCustomLabel] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQuantity, setCustomQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [priceSheet, setPriceSheet] = useState<PriceSheetRow[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [priceMap, setPriceMap] = useState<Record<string, PriceSheetRow>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const quoteCardRef = useRef<HTMLDivElement>(null);
  const lastBookingIdRef = useRef<string | null>(null);

  // Check if booking has a slot with squeeze-in fee
  const hasSqueezeFee = useMemo(() => {
    if (!booking) return false;
    const bookingWithSlot = booking as BookingWithSlot;
    return bookingWithSlot.slot?.slotType === 'with_squeeze_fee';
  }, [booking]);

  // Load existing invoice data when booking changes
  useEffect(() => {
    if (!booking) {
      setQuoteItems([]);
      setNotes('');
      lastBookingIdRef.current = null;
      return;
    }

    // Only process if this is a new booking (booking ID changed)
    if (lastBookingIdRef.current === booking.id) {
      return;
    }

    lastBookingIdRef.current = booking.id;
    
    // Load existing invoice if it exists
    if (booking.invoice) {
      // Convert invoice items to quote items (add IDs if missing)
      const loadedItems = booking.invoice.items.map((item, index) => ({
        id: item.id || generateId(),
        description: item.description,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      }));
      setQuoteItems(loadedItems);
      setNotes(booking.invoice.notes || '');
    } else {
      // Clear items when booking changes (squeeze-in fee is handled separately, not as a quote item)
      setQuoteItems([]);
      setNotes('');
    }
  }, [booking]); // Run when booking changes

  useEffect(() => {
    if (!PRICE_SHEET_TSV_URL) return;
    setSheetLoading(true);
    fetch(PRICE_SHEET_TSV_URL)
      .then((res) => res.text())
      .then((text) => {
        const rows: PriceSheetRow[] = [];
        const map: Record<string, PriceSheetRow> = {};
        const lines = text.split(/\r?\n/);
        for (const rawLine of lines) {
          if (!rawLine) continue;
          const trimmed = rawLine.trim();
          if (!trimmed || trimmed.startsWith('____')) continue;
          const [nameRaw, priceRaw] = trimmed.split('\t');
          if (!nameRaw) continue;
          if (nameRaw.toLowerCase().includes('name') && priceRaw?.toLowerCase().includes('unit')) continue;
          const displayPrice = (priceRaw ?? '').trim() || '—';
          const numeric = displayPrice.replace(/[₱,\s]/g, '').replace(/[^\d.-]/g, '');
          const parsedNumber = Number(numeric);
          const unitPrice = Number.isFinite(parsedNumber) ? parsedNumber : null;
          const row = { name: nameRaw.trim(), displayPrice, unitPrice };
          rows.push(row);
          map[row.name.trim().toLowerCase()] = row;
        }
        setPriceSheet(rows);
        setPriceMap(map);
      })
      .catch((error) => {
        console.error('Failed to load price sheet', error);
      })
      .finally(() => setSheetLoading(false));
  }, []);

  const servicesTotal = useMemo(
    () => quoteItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [quoteItems],
  );

  const total = useMemo(
    () => servicesTotal + (hasSqueezeFee ? SQUEEZE_IN_FEE : 0),
    [servicesTotal, hasSqueezeFee],
  );

  const depositAmount = booking?.depositAmount || 0;
  const balanceDue = total - depositAmount;

  const filteredSearchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const needle = searchTerm.toLowerCase();
    return priceSheet.filter((row) => row.name.toLowerCase().includes(needle)).slice(0, 12);
  }, [priceSheet, searchTerm]);

  const getCustomerName = () => {
    if (!booking?.customerData) return 'Customer';
    const name = booking.customerData['Name'] || booking.customerData['name'] || booking.customerData['Full Name'] || booking.customerData['fullName'] || '';
    const surname = booking.customerData['Surname'] || booking.customerData['surname'] || booking.customerData['Last Name'] || booking.customerData['lastName'] || '';
    return `${name}${name && surname ? ' ' : ''}${surname}`.trim() || 'Customer';
  };


  const addQuoteItemFromRow = (label: string, row?: PriceSheetRow | null) => {
    if (!row || row.unitPrice === null) return;
    setQuoteItems((prev) => [
      ...prev,
      { id: generateId(), description: label, unitPrice: row.unitPrice ?? 0, quantity: 1 },
    ]);
  };

  const handleAddCustom = () => {
    if (!customLabel.trim()) return;
    const priceValue = Number(customPrice);
    if (!priceValue || priceValue <= 0) return;
    const qtyValue = Number(customQuantity) || 1;
    setQuoteItems((prev) => [
      ...prev,
      {
        id: generateId(),
        description: customLabel.trim(),
        unitPrice: priceValue,
        quantity: qtyValue,
      },
    ]);
    setCustomLabel('');
    setCustomPrice('');
    setCustomQuantity('1');
  };

  const handleDeleteItem = (id: string) => {
    setQuoteItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleQuantityChange = (id: string, quantity: number) => {
    // While typing, only apply updates for valid positive numbers.
    // This lets the user temporarily clear the field without losing the item.
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    setQuoteItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity } : item)));
  };

  const handleQuantityBlur = (id: string, value: string) => {
    const parsed = Number(value);
    // On blur, if quantity is 0/negative/blank/invalid, remove the item from the quote.
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setQuoteItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleGenerateInvoice = async () => {
    if ((!quoteItems.length && !hasSqueezeFee) || !booking) {
      alert('Unable to generate invoice. Please add at least one item or enable squeeze-in fee.');
      return;
    }
    
    // Get element reference - use a function to always get fresh reference
    const getElement = () => quoteCardRef.current;
    
    // Try multiple times to get the element (in case of timing issues)
    let element = getElement();
    let attempts = 0;
    while (!element && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 50));
      element = getElement();
      attempts++;
    }
    
    if (!element) {
      console.error('Invoice element not found after', attempts, 'attempts');
      alert('Unable to generate invoice. Invoice element not found. Please refresh the page and try again.');
      return;
    }
    
    // Store original styles before making any changes
    const originalElementDisplay = (element as HTMLElement).style.display;
    const originalElementVisibility = (element as HTMLElement).style.visibility;
    const originalElementOpacity = (element as HTMLElement).style.opacity;
    const originalElementPosition = (element as HTMLElement).style.position;
    const originalElementZIndex = (element as HTMLElement).style.zIndex;
    const originalElementTop = (element as HTMLElement).style.top;
    const originalElementLeft = (element as HTMLElement).style.left;
    
    // Ensure element is visible and accessible
    (element as HTMLElement).style.display = 'block';
    (element as HTMLElement).style.visibility = 'visible';
    (element as HTMLElement).style.opacity = '1';
    
    setGeneratingImage(true);
    
    // Wait for React to finish re-rendering and ensure element is still accessible
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Get fresh element reference after re-render - try multiple times
    element = getElement();
    attempts = 0;
    while ((!element || !element.isConnected) && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 50));
      element = getElement();
      attempts++;
    }
    
    if (!element || !element.isConnected) {
      console.error('Invoice element became unavailable after re-render');
      // Restore styles before returning
      const lastElement = quoteCardRef.current;
      if (lastElement) {
        (lastElement as HTMLElement).style.display = originalElementDisplay || '';
        (lastElement as HTMLElement).style.visibility = originalElementVisibility || '';
        (lastElement as HTMLElement).style.opacity = originalElementOpacity || '';
        (lastElement as HTMLElement).style.position = originalElementPosition || '';
        (lastElement as HTMLElement).style.zIndex = originalElementZIndex || '';
      }
      setGeneratingImage(false);
      alert('Unable to generate invoice. Invoice element became unavailable. Please refresh the page and try again.');
      return;
    }
    
    // Ensure element is still properly visible
    (element as HTMLElement).style.display = 'block';
    (element as HTMLElement).style.visibility = 'visible';
    (element as HTMLElement).style.opacity = '1';
    
    try {
      // Preload QR code images to ensure they're fully loaded
      if (!element || !element.querySelectorAll) {
        throw new Error('Invoice element is not accessible');
      }
      const qrImages = element.querySelectorAll('img');
      await Promise.all(
        Array.from(qrImages).map((img) => {
          if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
          return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(img), 3000);
            img.onload = () => {
              clearTimeout(timeout);
              resolve(img);
            };
            img.onerror = () => {
              clearTimeout(timeout);
              // Don't reject, just resolve even if image fails to load
              resolve(img);
            };
          });
        })
      );
      
      // Get fresh element reference again before proceeding
      element = getElement();
      if (!element || !element.parentElement || !element.isConnected) {
        throw new Error('Invoice element became unavailable. Please try again.');
      }
      
      // Scroll the invoice card to the top to ensure it's fully visible
      try {
        element.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'nearest' });
      } catch (e) {
        console.warn('Could not scroll element into view:', e);
      }
      
      // Detect mobile device for longer wait time
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                       (typeof window !== 'undefined' && window.innerWidth <= 768);
      
      // Mobile-specific wait time: increased from 600ms to 1000ms on mobile devices
      // to allow images to fully render
      const waitTime = isMobile ? 1000 : 600;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Get fresh element reference again after scroll
      element = getElement();
      if (!element || !element.isConnected) {
        throw new Error('Invoice element became unavailable after scroll. Please try again.');
      }
      
      // Move invoice card off-screen during capture so temporary style changes
      // (like enlarged QR images) are not visible to the user on mobile/tablet
      const captureElement = element as HTMLElement;
      captureElement.style.position = 'fixed';
      captureElement.style.top = '-10000px';
      captureElement.style.left = '-10000px';
      captureElement.style.zIndex = '-1';
      
      // Pre-capture QR code preparation: Force QR images to render at natural size
      const qrContainers = element.querySelectorAll('[data-qr-container]');
      if (qrContainers.length === 0) {
        throw new Error('QR code containers not found');
      }
      
      // Pre-capture QR code preparation: Force images to natural size and remove overflow
      qrContainers.forEach((container) => {
        const containerEl = container as HTMLElement;
        const img = containerEl.querySelector('img') as HTMLImageElement;
        if (img) {
          // Force image to natural size
          img.style.width = 'auto';
          img.style.height = 'auto';
          img.style.maxWidth = 'none';
          img.style.maxHeight = 'none';
          img.style.objectFit = 'contain';
          // Temporarily remove overflow-hidden from containers
          containerEl.style.overflow = 'visible';
        }
      });
      
      // Wait for layout updates (longer on mobile)
      await new Promise(resolve => setTimeout(resolve, isMobile ? 200 : 100));
      
      // Temporarily store original styles to restore later
      const originalStyles: { 
        element: Partial<CSSStyleDeclaration>; 
        parents: Array<{ el: HTMLElement; styles: Partial<CSSStyleDeclaration> }>;
        qrContainers: Array<{ el: HTMLElement; styles: Partial<CSSStyleDeclaration> }>;
        qrImages: Array<{ el: HTMLImageElement; styles: Partial<CSSStyleDeclaration> }>;
      } = {
        element: {},
        parents: [],
        qrContainers: [],
        qrImages: []
      };
      
      // Temporarily modify element and parent styles for capture
      const tempElement = element as HTMLElement;
      originalStyles.element = {
        overflow: tempElement.style.overflow,
        maxHeight: tempElement.style.maxHeight,
      };
      tempElement.style.overflow = 'visible';
      tempElement.style.maxHeight = 'none';
      
      // Store and modify QR container styles - track all styles for proper restoration
      qrContainers.forEach((container) => {
        const containerEl = container as HTMLElement;
        originalStyles.qrContainers.push({
          el: containerEl,
          styles: {
            overflow: containerEl.style.overflow,
            overflowX: containerEl.style.overflowX,
            overflowY: containerEl.style.overflowY,
            height: containerEl.style.height,
            minHeight: containerEl.style.minHeight,
            maxHeight: containerEl.style.maxHeight,
            padding: containerEl.style.padding,
            paddingTop: containerEl.style.paddingTop,
            paddingBottom: containerEl.style.paddingBottom,
            paddingLeft: containerEl.style.paddingLeft,
            paddingRight: containerEl.style.paddingRight,
          }
        });
        containerEl.style.overflow = 'visible';
        containerEl.style.overflowX = 'visible';
        containerEl.style.overflowY = 'visible';
        containerEl.style.height = 'auto';
        containerEl.style.minHeight = 'auto';
        containerEl.style.maxHeight = 'none';
        
        const img = container.querySelector('img') as HTMLImageElement;
        if (img) {
          originalStyles.qrImages.push({
            el: img,
            styles: {
              width: img.style.width,
              height: img.style.height,
              maxWidth: img.style.maxWidth,
              maxHeight: img.style.maxHeight,
              objectFit: img.style.objectFit,
              objectPosition: img.style.objectPosition,
              display: img.style.display,
            }
          });
        }
      });
      
      // Remove overflow from all parents
      let parent = tempElement.parentElement;
      while (parent && parent !== document.body) {
        const computedStyle = window.getComputedStyle(parent);
        if (computedStyle.overflow !== 'visible' || computedStyle.overflowY !== 'visible' || computedStyle.maxHeight !== 'none') {
          originalStyles.parents.push({
            el: parent,
            styles: {
              overflow: parent.style.overflow,
              overflowY: parent.style.overflowY,
              maxHeight: parent.style.maxHeight,
            }
          });
          parent.style.overflow = 'visible';
          parent.style.overflowY = 'visible';
          parent.style.maxHeight = 'none';
        }
        parent = parent.parentElement;
      }
      
      // Get fresh element reference right before html2canvas
      element = getElement();
      if (!element || !element.isConnected) {
        throw new Error('Invoice element became unavailable before capture. Please try again.');
      }
      
      let canvas;
      try {
        // Use requestAnimationFrame to prevent blocking
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        
        canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#fff7f9',
          logging: false,
          useCORS: true,
          allowTaint: false,
          scrollX: 0,
          scrollY: 0,
          removeContainer: true, // Remove temporary container after capture
          onclone: (clonedDoc, clonedElement) => {
            // clonedElement is the cloned version of our element
            if (clonedElement) {
              const clonedCard = clonedElement as HTMLElement;
              clonedCard.style.overflow = 'visible';
              clonedCard.style.maxHeight = 'none';
              clonedCard.style.height = 'auto';
              clonedCard.style.paddingBottom = '40px'; // Slight extra bottom padding to prevent QR code clipping
              // Make the generated invoice narrower and more compact
              clonedCard.style.width = '380px';
              clonedCard.style.minWidth = '360px';
              clonedCard.style.maxWidth = '380px';
              clonedCard.style.margin = '0 auto';
              
              // Center the QR row in the cloned document
              const clonedQrRow = clonedCard.querySelector('[data-qr-row]') as HTMLElement | null;
              if (clonedQrRow) {
                clonedQrRow.style.justifyContent = 'center';
              }
              
              // Enhanced onclone callback: Fix QR code containers in cloned document
              const clonedQrContainers = clonedCard.querySelectorAll('[data-qr-container]');
              clonedQrContainers.forEach((container) => {
                const containerEl = container as HTMLElement;
                // Remove overflow constraints from QR containers
                containerEl.style.overflow = 'visible';
                containerEl.style.overflowX = 'visible';
                containerEl.style.overflowY = 'visible';
                containerEl.style.height = 'auto';
                containerEl.style.minHeight = 'auto';
                containerEl.style.maxHeight = 'none';
                // Set explicit padding and dimensions
                containerEl.style.padding = '8px';
                
                const img = containerEl.querySelector('img') as HTMLImageElement;
                if (img) {
                  // Calculate proper image dimensions based on natural size and aspect ratio
                  // Images should already be loaded from pre-capture preparation
                  if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
                    const aspectRatio = img.naturalWidth / img.naturalHeight;
                    const containerWidth = containerEl.offsetWidth || containerEl.clientWidth || 160;
                    const containerHeight = containerEl.offsetHeight || containerEl.clientHeight || 208;
                    const padding = 16; // Account for padding (8px on each side)
                    const availableWidth = Math.max(containerWidth - padding, 100);
                    const availableHeight = Math.max(containerHeight - padding, 100);
                    
                    // Calculate dimensions that fit within container while maintaining aspect ratio
                    // Ensures images fit within containers without clipping
                    let imgWidth = availableWidth;
                    let imgHeight = availableWidth / aspectRatio;
                    
                    if (imgHeight > availableHeight) {
                      imgHeight = availableHeight;
                      imgWidth = availableHeight * aspectRatio;
                    }
                    
                    // Ensure minimum size
                    if (imgWidth < 50) {
                      imgWidth = 50;
                      imgHeight = 50 / aspectRatio;
                    }
                    if (imgHeight < 50) {
                      imgHeight = 50;
                      imgWidth = 50 * aspectRatio;
                    }
                    
                    // Set explicit dimensions
                    img.style.width = `${imgWidth}px`;
                    img.style.height = `${imgHeight}px`;
                    img.style.maxWidth = `${imgWidth}px`;
                    img.style.maxHeight = `${imgHeight}px`;
                    img.style.objectFit = 'contain';
                    img.style.display = 'block';
                    img.style.objectPosition = 'center';
                  } else {
                    // Fallback if natural dimensions are not available
                    // Use container dimensions as fallback
                    const containerWidth = containerEl.offsetWidth || containerEl.clientWidth || 160;
                    const containerHeight = containerEl.offsetHeight || containerEl.clientHeight || 208;
                    const padding = 16;
                    const availableWidth = Math.max(containerWidth - padding, 100);
                    const availableHeight = Math.max(containerHeight - padding, 100);
                    
                    img.style.width = `${availableWidth}px`;
                    img.style.height = `${availableHeight}px`;
                    img.style.maxWidth = `${availableWidth}px`;
                    img.style.maxHeight = `${availableHeight}px`;
                    img.style.objectFit = 'contain';
                    img.style.display = 'block';
                    img.style.objectPosition = 'center';
                  }
                }
              });
              
              // Remove all constraints from parents in cloned doc
              let parent = clonedCard.parentElement;
              while (parent && parent !== clonedDoc.body) {
                parent.style.overflow = 'visible';
                parent.style.overflowY = 'visible';
                parent.style.maxHeight = 'none';
                parent.style.height = 'auto';
                parent = parent.parentElement;
              }
              
              // Ensure body and html don't clip
              if (clonedDoc.body) {
                clonedDoc.body.style.overflow = 'visible';
                clonedDoc.body.style.maxHeight = 'none';
              }
              if (clonedDoc.documentElement) {
                clonedDoc.documentElement.style.overflow = 'visible';
                clonedDoc.documentElement.style.maxHeight = 'none';
              }
            }
          },
        });
      } catch (error) {
        // Restore original styles even on error - handle all tracked styles
        if (originalStyles.element.overflow !== undefined) {
          tempElement.style.overflow = originalStyles.element.overflow || '';
        }
        if (originalStyles.element.maxHeight !== undefined) {
          tempElement.style.maxHeight = originalStyles.element.maxHeight || '';
        }
        originalStyles.parents.forEach(({ el, styles }) => {
          if (styles.overflow !== undefined) el.style.overflow = styles.overflow || '';
          if (styles.overflowY !== undefined) el.style.overflowY = styles.overflowY || '';
          if (styles.maxHeight !== undefined) el.style.maxHeight = styles.maxHeight || '';
        });
        originalStyles.qrContainers.forEach(({ el, styles }) => {
          if (styles.overflow !== undefined) el.style.overflow = styles.overflow || '';
          if (styles.overflowX !== undefined) el.style.overflowX = styles.overflowX || '';
          if (styles.overflowY !== undefined) el.style.overflowY = styles.overflowY || '';
          if (styles.height !== undefined) el.style.height = styles.height || '';
          if (styles.minHeight !== undefined) el.style.minHeight = styles.minHeight || '';
          if (styles.maxHeight !== undefined) el.style.maxHeight = styles.maxHeight || '';
          if (styles.padding !== undefined) el.style.padding = styles.padding || '';
          if (styles.paddingTop !== undefined) el.style.paddingTop = styles.paddingTop || '';
          if (styles.paddingBottom !== undefined) el.style.paddingBottom = styles.paddingBottom || '';
          if (styles.paddingLeft !== undefined) el.style.paddingLeft = styles.paddingLeft || '';
          if (styles.paddingRight !== undefined) el.style.paddingRight = styles.paddingRight || '';
        });
        originalStyles.qrImages.forEach(({ el, styles }) => {
          if (styles.width !== undefined) el.style.width = styles.width || '';
          if (styles.height !== undefined) el.style.height = styles.height || '';
          if (styles.maxWidth !== undefined) el.style.maxWidth = styles.maxWidth || '';
          if (styles.maxHeight !== undefined) el.style.maxHeight = styles.maxHeight || '';
          if (styles.objectFit !== undefined) el.style.objectFit = styles.objectFit || '';
          if (styles.objectPosition !== undefined) el.style.objectPosition = styles.objectPosition || '';
          if (styles.display !== undefined) el.style.display = styles.display || '';
        });
        throw error;
      }
      
        // Restore original styles after successful capture - restore all tracked styles
        if (originalStyles.element.overflow !== undefined) {
          tempElement.style.overflow = originalStyles.element.overflow || '';
        }
        if (originalStyles.element.maxHeight !== undefined) {
          tempElement.style.maxHeight = originalStyles.element.maxHeight || '';
        }
        originalStyles.parents.forEach(({ el, styles }) => {
          if (styles.overflow !== undefined) el.style.overflow = styles.overflow || '';
          if (styles.overflowY !== undefined) el.style.overflowY = styles.overflowY || '';
          if (styles.maxHeight !== undefined) el.style.maxHeight = styles.maxHeight || '';
        });
        originalStyles.qrContainers.forEach(({ el, styles }) => {
          if (styles.overflow !== undefined) el.style.overflow = styles.overflow || '';
          if (styles.overflowX !== undefined) el.style.overflowX = styles.overflowX || '';
          if (styles.overflowY !== undefined) el.style.overflowY = styles.overflowY || '';
          if (styles.height !== undefined) el.style.height = styles.height || '';
          if (styles.minHeight !== undefined) el.style.minHeight = styles.minHeight || '';
          if (styles.maxHeight !== undefined) el.style.maxHeight = styles.maxHeight || '';
          if (styles.padding !== undefined) el.style.padding = styles.padding || '';
          if (styles.paddingTop !== undefined) el.style.paddingTop = styles.paddingTop || '';
          if (styles.paddingBottom !== undefined) el.style.paddingBottom = styles.paddingBottom || '';
          if (styles.paddingLeft !== undefined) el.style.paddingLeft = styles.paddingLeft || '';
          if (styles.paddingRight !== undefined) el.style.paddingRight = styles.paddingRight || '';
        });
        originalStyles.qrImages.forEach(({ el, styles }) => {
          if (styles.width !== undefined) el.style.width = styles.width || '';
          if (styles.height !== undefined) el.style.height = styles.height || '';
          if (styles.maxWidth !== undefined) el.style.maxWidth = styles.maxWidth || '';
          if (styles.maxHeight !== undefined) el.style.maxHeight = styles.maxHeight || '';
          if (styles.objectFit !== undefined) el.style.objectFit = styles.objectFit || '';
          if (styles.objectPosition !== undefined) el.style.objectPosition = styles.objectPosition || '';
          if (styles.display !== undefined) el.style.display = styles.display || '';
        });
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `invoice-${booking.bookingId}-${Date.now()}.jpg`;
      link.click();

      // Show success state and auto-close modal after 0.5s
      setShowSuccess(true);
      setTimeout(() => {
        onClose();
      }, 500);

      // Recalculate total to ensure it's correct before saving
      const recalculatedServicesTotal = quoteItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const recalculatedTotal = recalculatedServicesTotal + (hasSqueezeFee ? SQUEEZE_IN_FEE : 0);
      
      // Save invoice to booking (squeeze-in fee is included in total, not as a separate item)
      const invoiceData = {
        items: quoteItems,
        total: recalculatedTotal, // Use recalculated total to ensure accuracy
        notes,
        squeezeInFee: hasSqueezeFee ? SQUEEZE_IN_FEE : undefined, // Store squeeze-in fee separately for reference
        createdAt: booking.invoice?.createdAt || new Date().toISOString(), // Preserve original creation date if editing
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_invoice',
          invoice: invoiceData,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save invoice');
      }

      if (onSendInvoice) {
        await onSendInvoice(booking.id, invoiceData);
      }
    } catch (error) {
      console.error('Failed to generate invoice', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', errorMessage);
      
      // Restore styles in error case - ensure all styles are restored
      const errorElement = getElement();
      if (errorElement) {
        const tempErrorElement = errorElement as HTMLElement;
        // Restore element styles
        tempErrorElement.style.display = originalElementDisplay || '';
        tempErrorElement.style.visibility = originalElementVisibility || '';
        tempErrorElement.style.opacity = originalElementOpacity || '';
        tempErrorElement.style.position = originalElementPosition || '';
        tempErrorElement.style.zIndex = originalElementZIndex || '';
        
        // Restore QR container and image styles if they were modified
        const qrContainers = errorElement.querySelectorAll('[data-qr-container]');
        qrContainers.forEach((container) => {
          const containerEl = container as HTMLElement;
          containerEl.style.overflow = '';
          containerEl.style.overflowX = '';
          containerEl.style.overflowY = '';
          containerEl.style.height = '';
          containerEl.style.minHeight = '';
          containerEl.style.maxHeight = '';
          
          const img = containerEl.querySelector('img') as HTMLImageElement;
          if (img) {
            img.style.width = '';
            img.style.height = '';
            img.style.maxWidth = '';
            img.style.maxHeight = '';
            img.style.objectFit = '';
            img.style.objectPosition = '';
            img.style.display = '';
          }
        });
      }
      
      // Use a non-blocking error notification instead of alert
      setTimeout(() => {
        alert(`Unable to generate invoice: ${errorMessage}. Please try again.`);
      }, 100);
    } finally {
      // Restore original element styles using fresh reference
      const finalElement = getElement();
      if (finalElement) {
        (finalElement as HTMLElement).style.display = originalElementDisplay || '';
        (finalElement as HTMLElement).style.visibility = originalElementVisibility || '';
        (finalElement as HTMLElement).style.opacity = originalElementOpacity || '';
        (finalElement as HTMLElement).style.position = originalElementPosition || '';
        (finalElement as HTMLElement).style.zIndex = originalElementZIndex || '';
      }
      // Only reset generatingImage if we're not showing success (success will close modal)
      if (!showSuccess) {
      setGeneratingImage(false);
      }
    }
  };

  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Success Notification */}
      {showSuccess && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100000] bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4"
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Invoice Generated Successfully!</h3>
            <p className="text-slate-600 mb-6">The invoice has been downloaded and saved.</p>
            <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 0.5, ease: 'linear' }}
                className="h-full bg-emerald-600"
              />
            </div>
          </div>
        </motion.div>
      )}
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: showSuccess ? 0.3 : 1 }}
        className="bg-white rounded-none sm:rounded-2xl w-full max-w-full sm:max-w-6xl p-4 sm:p-6 shadow-xl max-h-[100vh] sm:max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-semibold leading-tight">
              {booking.invoice ? 'Edit Invoice' : 'Create Invoice'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-snug">
              {getCustomerName()} · {booking.bookingId} · {slotLabel}
            </p>
            {booking.invoice && (
              <p className="text-xs text-slate-400 mt-1">
                Last updated: {format(new Date(booking.invoice.updatedAt), 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          {/* Left: Quote Builder */}
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-slate-300 bg-white p-4 sm:p-5 md:p-4 shadow-lg shadow-slate-200/50">
              <h4 className="font-semibold mb-2 text-slate-900 text-sm sm:text-base">Add Services</h4>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search services..."
                className="w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-xs sm:text-sm mb-2 focus:border-slate-900 focus:ring-0 shadow-sm"
              />
              {searchTerm && (
                <div className="max-h-36 overflow-auto rounded-xl border-2 border-slate-300 shadow-md">
                  {filteredSearchResults.map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between px-3 py-2 hover:bg-slate-100 cursor-pointer border-b border-slate-200 last:border-0 transition-colors"
                      onClick={() => {
                        addQuoteItemFromRow(row.name, row);
                        setSearchTerm('');
                      }}
                    >
                      <span className="text-xs sm:text-sm leading-snug">{row.name}</span>
                      <span className="text-xs sm:text-sm font-semibold text-rose-600">
                        {row.unitPrice ? `₱${row.unitPrice.toLocaleString('en-PH')}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border-2 border-slate-300 bg-white p-4 sm:p-5 md:p-4 shadow-lg shadow-slate-200/50">
              <h4 className="font-semibold mb-2 text-slate-900 text-sm sm:text-base">Custom Item</h4>
              <div className="space-y-2">
                {/* Service name, price, quantity: responsive row (no horizontal scroll) */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="Service name"
                    className="sm:flex-[2] rounded-xl border-2 border-slate-300 px-3 py-2 text-xs sm:text-sm focus:border-slate-900 focus:ring-0 shadow-sm"
                  />
                  <div className="flex gap-2 sm:flex-1">
                    <input
                      type="number"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder="Price"
                      className="flex-1 rounded-xl border-2 border-slate-300 px-3 py-2 text-xs sm:text-sm focus:border-slate-900 focus:ring-0 shadow-sm"
                    />
                    <input
                      type="number"
                      min="1"
                      value={customQuantity}
                      onChange={(e) => setCustomQuantity(e.target.value)}
                      placeholder="Qty"
                      className="w-20 rounded-xl border-2 border-slate-300 px-3 py-2 text-xs sm:text-sm focus:border-slate-900 focus:ring-0 shadow-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddCustom}
                  disabled={!customLabel.trim() || !customPrice}
                  className="w-full rounded-full bg-slate-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-slate-300 bg-white p-4 sm:p-5 md:p-4 shadow-lg shadow-slate-200/50">
              <h4 className="font-semibold mb-2 text-slate-900 text-sm sm:text-base">Notes</h4>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes or instructions..."
                rows={3}
                className="w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-xs sm:text-sm focus:border-slate-900 focus:ring-0 shadow-sm resize-none"
              />
            </div>

          </div>

          {/* Right: Quote Items (top) + Invoice Preview */}
          <div className="space-y-4">
            {quoteItems.length > 0 && (
              <div className="rounded-2xl border-2 border-slate-300 bg-white p-4 sm:p-5 md:p-4 shadow-lg shadow-slate-200/50">
                <h4 className="font-semibold mb-2 text-slate-900 text-sm sm:text-base md:text-sm">Quote Items</h4>
                <div className="space-y-2 max-h-56 overflow-auto">
                  {quoteItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm"
                    >
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm font-medium leading-snug">{item.description}</p>
                        <p className="text-[11px] sm:text-xs text-slate-500 leading-tight">
                          ₱{item.unitPrice.toLocaleString('en-PH')} × {item.quantity} = ₱
                          {(item.unitPrice * item.quantity).toLocaleString('en-PH')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 border border-slate-200 rounded">
                          <button
                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="px-2 py-1 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            inputMode="numeric"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))}
                            onBlur={(e) => handleQuantityBlur(item.id, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-7 text-center text-xs sm:text-sm border-0 focus:outline-none"
                          />
                          <button
                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                            className="px-2 py-1 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-red-600 hover:text-red-800"
                          aria-label="Delete item"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200 space-y-0.5">
                  <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                    Services Subtotal: ₱{servicesTotal.toLocaleString('en-PH')}
                  </p>
                  {hasSqueezeFee && (
                    <p className="text-xs sm:text-sm font-semibold text-purple-700 leading-snug">
                      Squeeze-in Fee: ₱{SQUEEZE_IN_FEE.toLocaleString('en-PH')}
                    </p>
                  )}
                  <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                    Total: ₱{total.toLocaleString('en-PH')}
                  </p>
                  {depositAmount > 0 && (
                    <p className="text-xs sm:text-sm font-semibold text-emerald-700 leading-snug">
                      Deposit Paid: -₱{depositAmount.toLocaleString('en-PH')}
                    </p>
                  )}
                  <p
                    className={`text-xs sm:text-sm font-semibold ${
                      balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'
                    } leading-snug`}
                  >
                    Balance Due: ₱{balanceDue.toLocaleString('en-PH')}
                  </p>
                </div>
              </div>
            )}

            <div
              ref={quoteCardRef}
              data-invoice-card
              className="rounded-2xl border-2 border-slate-300 bg-gradient-to-br from-white via-[#f7f7f7] to-white p-4 sm:p-5 shadow-xl shadow-slate-300/50 overflow-visible max-w-sm mx-auto"
              style={{ boxSizing: 'border-box' }}
            >
              <header className="mb-2 text-center">
                <h4 className="text-lg sm:text-xl font-semibold leading-tight">Invoice</h4>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-snug">
                  {format(new Date(), 'MMMM d, yyyy')}
                </p>
              </header>

              <div className="mb-2 text-xs sm:text-sm space-y-0.5 leading-snug">
                <p className="font-semibold text-xs sm:text-sm leading-snug">{getCustomerName()}</p>
                <p className="text-[11px] sm:text-xs text-slate-500 leading-tight">{booking.bookingId}</p>
                {slotLabel && (
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-tight">{slotLabel}</p>
                )}
                {booking.serviceLocation && (
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-tight">
                    {booking.serviceLocation === 'home_service' ? 'Home Service' : 'Homebased Studio'}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 mb-3">
                {quoteItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between text-xs sm:text-sm border-b border-slate-100 pb-1"
                  >
                    <div>
                      <p className="font-medium text-xs sm:text-sm leading-snug">{item.description}</p>
                      <p className="text-[11px] sm:text-xs text-slate-500 leading-tight">
                        Qty: {item.quantity} × ₱{item.unitPrice.toLocaleString('en-PH')}
                      </p>
                    </div>
                    <p className="font-semibold text-xs sm:text-sm">
                      ₱{(item.unitPrice * item.quantity).toLocaleString('en-PH')}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-slate-200 pt-2 mb-2 space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-xs sm:text-sm leading-snug">Services Subtotal:</span>
                  <span className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                    ₱{servicesTotal.toLocaleString('en-PH')}
                  </span>
                </div>
                {hasSqueezeFee && (
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-xs sm:text-sm text-purple-700 leading-snug">
                      Squeeze-in Fee:
                    </span>
                    <span className="text-sm sm:text-base font-semibold text-purple-700 leading-snug">
                      ₱{SQUEEZE_IN_FEE.toLocaleString('en-PH')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="font-semibold text-xs sm:text-sm leading-snug">Total:</span>
                  <span className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                    ₱{total.toLocaleString('en-PH')}
                  </span>
                </div>
                {depositAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] sm:text-xs text-slate-600 leading-tight">Deposit Paid:</span>
                    <span className="text-[11px] sm:text-xs font-semibold text-emerald-700 leading-tight">
                      -₱{depositAmount.toLocaleString('en-PH')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="font-semibold text-xs sm:text-sm leading-snug">Balance Due:</span>
                  <span
                    className={`text-lg sm:text-xl font-bold ${
                      balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'
                    } leading-snug`}
                  >
                    ₱{balanceDue.toLocaleString('en-PH')}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2 pb-4">
                <p className="text-[11px] sm:text-xs font-semibold text-slate-600 mb-2 text-center leading-snug">
                  Payment QR Codes
                </p>
                <div
                  data-qr-row
                  className="flex justify-start sm:justify-center gap-2 sm:gap-3 flex-nowrap overflow-x-auto py-1 -mx-1 px-1"
                >
                  <div className="text-center flex-shrink-0">
                    <div
                      data-qr-container
                      className="w-32 h-44 sm:w-40 sm:h-52 md:w-48 md:h-60 mx-auto border-2 border-slate-300 rounded-lg overflow-visible flex items-center justify-center bg-white shadow-sm p-2"
                    >
                      <Image 
                        src="/images/QR-Gcash.jpg" 
                        alt="GCash QR Code" 
                        width={160} 
                        height={200} 
                        className="w-full h-full object-contain" 
                        style={{ display: 'block', objectFit: 'contain' }}
                        unoptimized
                      />
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 mt-1 font-medium leading-snug">GCash</p>
                  </div>
                  <div className="text-center flex-shrink-0">
                    <div
                      data-qr-container
                      className="w-32 h-44 sm:w-40 sm:h-52 md:w-48 md:h-60 mx-auto border-2 border-slate-300 rounded-lg overflow-visible flex items-center justify-center bg-white shadow-sm p-2"
                    >
                      <Image 
                        src="/images/QR-PNB.jpg" 
                        alt="PNB QR Code" 
                        width={160} 
                        height={200} 
                        className="w-full h-full object-contain" 
                        style={{ display: 'block', objectFit: 'contain' }}
                        unoptimized
                      />
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 mt-1 font-medium leading-snug">PNB</p>
                  </div>
                </div>
              </div>

              {/* Notes removed from invoice view */}
              
            </div>

            <div className="space-y-2">
              <button
                onClick={handleGenerateInvoice}
                disabled={(!quoteItems.length && !hasSqueezeFee) || generatingImage}
                className="w-full rounded-full bg-rose-600 px-4 py-2.5 text-sm sm:text-base font-semibold text-white disabled:opacity-40 hover:bg-rose-700 transition-colors"
              >
                {booking.invoice ? 'Update & Download Invoice' : 'Generate & Download Invoice'}
              </button>
              {booking.invoice && (
                <button
                  onClick={async () => {
                    // Save quotation without generating/downloading image
                    if ((!quoteItems.length && !hasSqueezeFee) || !booking) {
                      alert('Please add at least one item or enable squeeze-in fee.');
                      return;
                    }
                    
                    // Recalculate total to ensure it's correct
                    const recalculatedServicesTotal = quoteItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
                    const recalculatedTotal = recalculatedServicesTotal + (hasSqueezeFee ? SQUEEZE_IN_FEE : 0);
                    
                    const invoiceData = {
                      items: quoteItems,
                      total: recalculatedTotal, // Use recalculated total
                      notes,
                      squeezeInFee: hasSqueezeFee ? SQUEEZE_IN_FEE : undefined,
                      createdAt: booking.invoice?.createdAt || new Date().toISOString(), // Preserve original creation date or use current date
                      updatedAt: new Date().toISOString(),
                    };

                    try {
                      const res = await fetch(`/api/bookings/${booking.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'save_invoice',
                          invoice: invoiceData,
                        }),
                      });

                      if (!res.ok) {
                        throw new Error('Failed to save invoice');
                      }

                      if (onSendInvoice) {
                        await onSendInvoice(booking.id, invoiceData);
                      }
                      
                      // Show success and close
                      setShowSuccess(true);
                      setTimeout(() => {
                        onClose();
                      }, 500);
                    } catch (error) {
                      console.error('Failed to save invoice', error);
                      alert('Failed to save invoice. Please try again.');
                    }
                  }}
                  disabled={(!quoteItems.length && !hasSqueezeFee) || generatingImage}
                  className="w-full rounded-full bg-slate-600 px-4 py-2.5 text-sm sm:text-base font-semibold text-white disabled:opacity-40 hover:bg-slate-700 transition-colors"
                >
                  Save Quotation (No Download)
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

