'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import type { Booking } from '@/lib/types';
import { format } from 'date-fns';

type QuoteItem = {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
};

const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type PriceSheetRow = {
  name: string;
  displayPrice: string;
  unitPrice: number | null;
};

const PRICE_SHEET_TSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSf9_fW2behj5fsi9CuLwzfikCow5WKEaXYDpKkjzZMW6gFtUzC9Ei6UWwixB0FY0mwDE83X7lugGX3/pub?output=tsv';

type QuotationModalProps = {
  booking: Booking | null;
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

  const quoteCardRef = useRef<HTMLDivElement>(null);

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

  const total = useMemo(
    () => quoteItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [quoteItems],
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
    if (!quantity || quantity <= 0) return;
    setQuoteItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity } : item)));
  };

  const handleGenerateInvoice = async () => {
    if (!quoteItems.length || !quoteCardRef.current || !booking) return;
    setGeneratingImage(true);
    try {
      const canvas = await html2canvas(quoteCardRef.current, {
        scale: 2,
        backgroundColor: '#fff7f9',
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `invoice-${booking.bookingId}-${Date.now()}.jpg`;
      link.click();

      // Save invoice to booking
      const invoiceData = {
        items: quoteItems,
        total,
        notes,
        createdAt: new Date().toISOString(),
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
      alert('Unable to generate invoice. Please try again.');
    } finally {
      setGeneratingImage(false);
    }
  };

  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl max-w-6xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-semibold">Create Quotation / Invoice</h3>
            <p className="text-sm text-slate-500 mt-1">
              {getCustomerName()} · {booking.bookingId} · {slotLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Quote Builder */}
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-slate-300 bg-white p-5 shadow-lg shadow-slate-200/50">
              <h4 className="font-semibold mb-3 text-slate-900">Add Services</h4>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search services..."
                className="w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-sm mb-3 focus:border-slate-900 focus:ring-0 shadow-sm"
              />
              {searchTerm && (
                <div className="max-h-40 overflow-auto rounded-xl border-2 border-slate-300 shadow-md">
                  {filteredSearchResults.map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between px-3 py-2 hover:bg-slate-100 cursor-pointer border-b border-slate-200 last:border-0 transition-colors"
                      onClick={() => {
                        addQuoteItemFromRow(row.name, row);
                        setSearchTerm('');
                      }}
                    >
                      <span className="text-sm">{row.name}</span>
                      <span className="text-sm font-semibold text-rose-600">
                        {row.unitPrice ? `₱${row.unitPrice.toLocaleString('en-PH')}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border-2 border-slate-300 bg-white p-5 shadow-lg shadow-slate-200/50">
              <h4 className="font-semibold mb-3 text-slate-900">Custom Item</h4>
              <div className="space-y-2">
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Service name"
                  className="w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:ring-0 shadow-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="Price"
                    className="flex-1 rounded-xl border-2 border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:ring-0 shadow-sm"
                  />
                  <input
                    type="number"
                    min="1"
                    value={customQuantity}
                    onChange={(e) => setCustomQuantity(e.target.value)}
                    placeholder="Qty"
                    className="w-20 rounded-xl border-2 border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:ring-0 shadow-sm"
                  />
                </div>
                <button
                  onClick={handleAddCustom}
                  disabled={!customLabel.trim() || !customPrice}
                  className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            {quoteItems.length > 0 && (
              <div className="rounded-2xl border-2 border-slate-300 bg-white p-5 shadow-lg shadow-slate-200/50">
                <h4 className="font-semibold mb-3 text-slate-900">Quote Items</h4>
                <div className="space-y-3 max-h-60 overflow-auto">
                  {quoteItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.description}</p>
                        <p className="text-xs text-slate-500">
                          ₱{item.unitPrice.toLocaleString('en-PH')} × {item.quantity} = ₱{(item.unitPrice * item.quantity).toLocaleString('en-PH')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 border border-slate-200 rounded">
                          <button
                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))}
                            className="w-12 text-center text-sm border-0 focus:outline-none"
                          />
                          <button
                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                            className="px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-xs text-red-600 hover:text-red-800 px-2"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
                  <p className="text-lg font-bold text-slate-900">
                    Subtotal: ₱{total.toLocaleString('en-PH')}
                  </p>
                  {depositAmount > 0 && (
                    <>
                      <p className="text-sm text-emerald-700">
                        Deposit Paid: -₱{depositAmount.toLocaleString('en-PH')}
                      </p>
                      <p className={`text-lg font-bold ${balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        Balance Due: ₱{balanceDue.toLocaleString('en-PH')}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Invoice Preview */}
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-slate-300 bg-white p-5 shadow-lg shadow-slate-200/50">
              <h4 className="font-semibold mb-3 text-slate-900">Notes</h4>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes, payment terms, etc..."
                className="w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-sm h-24 focus:border-slate-900 focus:ring-0 shadow-sm"
              />
            </div>

            <div
              ref={quoteCardRef}
              className="rounded-2xl border-2 border-slate-300 bg-gradient-to-br from-white via-[#f7f7f7] to-white p-6 shadow-xl shadow-slate-300/50"
            >
              <header className="mb-4 text-center">
                <h4 className="text-xl font-semibold">Invoice</h4>
                <p className="text-xs text-slate-500 mt-1">{format(new Date(), 'MMMM d, yyyy')}</p>
              </header>

              <div className="mb-4 text-sm">
                <p className="font-semibold">{getCustomerName()}</p>
                <p className="text-slate-500">{booking.bookingId}</p>
                {slotLabel && <p className="text-slate-500">{slotLabel}</p>}
                {booking.serviceLocation && (
                  <p className="text-slate-500">
                    {booking.serviceLocation === 'home_service' ? 'Home Service' : 'Homebased Studio'}
                  </p>
                )}
              </div>

              <div className="space-y-2 mb-4">
                {quoteItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm border-b border-slate-100 pb-2">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-slate-500">Qty: {item.quantity} × ₱{item.unitPrice.toLocaleString('en-PH')}</p>
                    </div>
                    <p className="font-semibold">₱{(item.unitPrice * item.quantity).toLocaleString('en-PH')}</p>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-slate-200 pt-3 mb-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Subtotal:</span>
                  <span className="text-lg font-semibold text-slate-900">₱{total.toLocaleString('en-PH')}</span>
                </div>
                {depositAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Deposit Paid:</span>
                    <span className="text-sm font-semibold text-emerald-700">-₱{depositAmount.toLocaleString('en-PH')}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="font-semibold">Balance Due:</span>
                  <span className={`text-2xl font-bold ${balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ₱{balanceDue.toLocaleString('en-PH')}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <p className="text-sm font-semibold text-slate-600 mb-3 text-center">Payment QR Codes</p>
                <div className="flex justify-center gap-6">
                  <div className="text-center">
                    <img src="/images/QR-Gcash.jpg" alt="GCash QR Code" className="w-40 h-40 mx-auto border border-slate-200 rounded" />
                    <p className="text-sm text-slate-600 mt-2 font-medium">GCash</p>
                  </div>
                  <div className="text-center">
                    <img src="/images/QR-PNB.jpg" alt="PNB QR Code" className="w-40 h-40 mx-auto border border-slate-200 rounded" />
                    <p className="text-sm text-slate-600 mt-2 font-medium">PNB</p>
                  </div>
                </div>
              </div>

              {notes && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Notes:</p>
                  <p className="text-xs text-slate-700 whitespace-pre-line">{notes}</p>
                </div>
              )}
            </div>

            <button
              onClick={handleGenerateInvoice}
              disabled={!quoteItems.length || generatingImage}
              className="w-full rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {generatingImage ? 'Generating...' : 'Generate & Download Invoice'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

