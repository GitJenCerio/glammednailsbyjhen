'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';

type QuoteItem = {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
};

const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const serviceMenu = [
  {
    title: 'Russian Manicure (Cleaning only)',
    duration: '60 mins',
    sheetKey: 'Russian Manicure (Deep Cleaning Only)',
    includes: ['Dry e-file cleaning', 'Cuticle detailing', 'High-shine buff'],
  },
  {
    title: 'Russian Manicure w/o Extensions',
    duration: '90 mins',
    sheetKey: 'BIAB / Gel Overlay w/ Russian Manicure Cleaning',
    includes: ['Full Russian prep', 'BIAB / gel overlay', 'Shape refinement'],
  },
  {
    title: 'Russian Manicure w/ Extensions',
    duration: '120 mins',
    sheetKey: 'Softgel Extensions w/ Russian Manicure Cleaning',
    includes: ['Prep + sculpted extensions', 'Gel polish', 'Custom shaping'],
  },
  {
    title: 'Deluxe Pedicure',
    duration: '75 mins',
    sheetKey: 'Russian Pedicure Gel Overlay',
    includes: ['Dry prep & smoothing', 'Cuticle care', 'Gel overlay'],
  },
  {
    title: 'Nail Art Add-ons',
    duration: '15-25 mins',
    sheetKey: 'Hand Paint Nail Art Detailed',
    includes: ['Chrome / cat-eye', 'Charms & 3D art', 'Hand-painted details'],
  },
  {
    title: 'Nail Rescue / Repair',
    duration: '15 mins per nail',
    sheetKey: 'Nail Extensions (per nail)',
    includes: ['Crack repair', 'Fill & reinforce', 'Blend to existing set'],
  },
];

type PriceSheetRow = {
  name: string;
  displayPrice: string;
  unitPrice: number | null;
};

const PRICE_SHEET_TSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSf9_fW2behj5fsi9CuLwzfikCow5WKEaXYDpKkjzZMW6gFtUzC9Ei6UWwixB0FY0mwDE83X7lugGX3/pub?output=tsv';

const popularSheetKeys = [
  'Softgel Extensions w/ Russian Manicure Cleaning',
  'BIAB / Gel Overlay w/ Russian Manicure Cleaning',
  'Hand Paint Nail Art Detailed',
  'Chrome Powder',
  '3D Embossed Design Medium-Large',
  'Russian Pedicure Gel Overlay',
  'Nail Extensions (per nail)',
  'Glazed/Pearl Effect',
];

export function ServicesManager() {
  const [subTab, setSubTab] = useState<'catalog' | 'quotes' | 'sheet'>('catalog');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [customLabel, setCustomLabel] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQuantity, setCustomQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [priceSheet, setPriceSheet] = useState<PriceSheetRow[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [priceMap, setPriceMap] = useState<Record<string, PriceSheetRow>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);

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
          const numeric = displayPrice
            .replace(/[₱,\s]/g, '')
            .replace(/[^\d.-]/g, '');
          const parsedNumber = Number(numeric);
          const unitPrice = Number.isFinite(parsedNumber) ? parsedNumber : null;
          const row = {
            name: nameRaw.trim(),
            displayPrice,
            unitPrice,
          };
          rows.push({
            name: row.name,
            displayPrice: row.displayPrice,
            unitPrice: row.unitPrice,
          });
          map[row.name.trim().toLowerCase()] = row;
        }
        setPriceSheet(rows);
        setPriceMap(map);
        setSheetError(null);
      })
      .catch((error) => {
        console.error('Failed to load price sheet', error);
        setSheetError('Unable to load TSV data.');
      })
      .finally(() => setSheetLoading(false));
  }, []);

  const total = useMemo(
    () => quoteItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [quoteItems],
  );

  const summaryText = useMemo(() => {
    if (!quoteItems.length) return 'No inspo items selected yet.';
    const lines = [
      'Glammed Nails by Jhen — Nails Inspo Quotation',
      '',
      ...quoteItems.map(
        (item) =>
          `• ${item.description} — ₱${item.unitPrice.toLocaleString('en-PH')} × ${item.quantity} = ₱${(
            item.unitPrice * item.quantity
          ).toLocaleString('en-PH')}`,
      ),
      '',
      `Estimated Total: ₱${total.toLocaleString('en-PH')}`,
    ];
    if (notes.trim()) {
      lines.push('', `Notes: ${notes.trim()}`);
    }
    lines.push('', 'Quote valid for 7 days and may adjust based on inspo updates.');
    return lines.join('\n');
  }, [quoteItems, notes, total]);

  const filteredSearchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const needle = searchTerm.toLowerCase();
    return priceSheet.filter((row) => row.name.toLowerCase().includes(needle)).slice(0, 12);
  }, [priceSheet, searchTerm]);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [],
  );

  const handleGenerateImage = async () => {
    if (!quoteItems.length || !quoteCardRef.current) return;
    setGeneratingImage(true);
    try {
      const canvas = await html2canvas(quoteCardRef.current, {
        scale: 2,
        backgroundColor: '#fff7f9',
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setGeneratedPreview(dataUrl);

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `nails-inspo-quotation-${Date.now()}.jpg`;
      link.click();
    } catch (error) {
      console.error('Failed to generate quotation image', error);
      alert('Unable to generate quotation image. Please try again.');
    } finally {
      setGeneratingImage(false);
    }
  };

  const addQuoteItemFromRow = (label: string, row?: PriceSheetRow | null) => {
    if (!row || row.unitPrice === null) return;
    setQuoteItems((prev) => [
      ...prev,
      { id: generateId(), description: label, unitPrice: row.unitPrice ?? 0, quantity: 1 },
    ]);
    setCopied(false);
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
    setCopied(false);
  };

  const handleDeleteItem = (id: string) => {
    setQuoteItems((prev) => prev.filter((item) => item.id !== id));
    setCopied(false);
  };

  const handleQuantityChange = (id: string, quantity: number) => {
    if (!quantity || quantity <= 0) return;
    setQuoteItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity } : item)));
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
    } catch {
      setCopied(false);
      alert('Unable to copy quote. Please try again.');
    }
  };

  const handleShareEmail = () => {
    const body = encodeURIComponent(summaryText);
    window.open(`mailto:?subject=Nails Inspo Quote&body=${body}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setSubTab('catalog')}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
            subTab === 'catalog' 
              ? 'bg-slate-900 text-white shadow-lg' 
              : 'bg-white text-slate-600 border-2 border-slate-300 shadow-md hover:shadow-lg'
          }`}
        >
          Service catalog
        </button>
        <button
          type="button"
          onClick={() => setSubTab('quotes')}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
            subTab === 'quotes' 
              ? 'bg-slate-900 text-white shadow-lg' 
              : 'bg-white text-slate-600 border-2 border-slate-300 shadow-md hover:shadow-lg'
          }`}
        >
          Nails inspo quotations
        </button>
        <button
          type="button"
          onClick={() => setSubTab('sheet')}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
            subTab === 'sheet' 
              ? 'bg-slate-900 text-white shadow-lg' 
              : 'bg-white text-slate-600 border-2 border-slate-300 shadow-md hover:shadow-lg'
          }`}
        >
          Full price sheet (TSV)
        </button>
      </div>

      {subTab === 'catalog' ? (
        <div className="space-y-8">
          <div className="rounded-3xl border-2 border-slate-300 bg-white p-6 shadow-lg shadow-slate-200/50">
            <header className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Hero services</p>
                <h2 className="text-2xl font-semibold text-slate-900">Most-booked sets & add-ons</h2>
                <p className="text-sm text-slate-500">Updates automatically whenever you edit the TSV price sheet.</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-semibold text-slate-900">{serviceMenu.length}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Highlight cards</p>
              </div>
            </header>

            <div className="grid gap-4 lg:grid-cols-2">
              {serviceMenu.map((service) => (
                <div
                  key={service.title}
                  className="rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/50 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{service.duration}</p>
                      <h3 className="text-xl font-semibold text-slate-900">{service.title}</h3>
                    </div>
                    <p className="text-lg font-bold text-rose-600">
                      {priceMap[service.sheetKey.toLowerCase()]?.displayPrice ?? 'Set price in TSV'}
                    </p>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-slate-500">
                    {service.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border-2 border-slate-300 bg-white p-6 shadow-lg shadow-slate-200/50">
            <header className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Full catalog</p>
                <h2 className="text-2xl font-semibold text-slate-900">Everything listed in the TSV</h2>
                <p className="text-sm text-slate-500">
                  Use this when replying to custom pricing questions or designing inspo quotes.
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-semibold text-slate-900">{priceSheet.length}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Line items</p>
              </div>
            </header>

            {sheetLoading ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-500">Loading TSV...</div>
            ) : sheetError ? (
              <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-md">{sheetError}</div>
            ) : (
              <div className="max-h-[500px] overflow-auto rounded-2xl border-2 border-slate-300 shadow-md">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 border-b-2 border-slate-300">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Unit price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {priceSheet.map((row, index) => (
                      <tr key={`${row.name}-${index}`} className="hover:bg-slate-100 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                        <td className="px-4 py-3 text-slate-600">{row.displayPrice || '—'}</td>
                      </tr>
                    ))}
                    {priceSheet.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-6 text-center text-slate-500">
                          No rows found in the TSV.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : subTab === 'quotes' ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-3xl border-2 border-slate-300 bg-white p-6 shadow-lg shadow-slate-200/50 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Quick add inspo items</h3>
                <p className="text-sm text-slate-500">
                  Search directly from the TSV or tap a most-used preset to add it to the current quote.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Search TSV services
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Type service name, e.g. chrome, removal, charms"
                  className="w-full rounded-2xl border-2 border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:ring-0 shadow-sm"
                />
                {searchTerm && (
                  <div className="mt-3 rounded-2xl border-2 border-slate-300 max-h-60 overflow-auto shadow-md">
                    {filteredSearchResults.length === 0 ? (
                      <p className="px-4 py-2 text-xs text-slate-500">No matches yet.</p>
                    ) : (
                      <ul className="divide-y divide-slate-200 text-sm">
                        {filteredSearchResults.map((row) => (
                          <li
                            key={row.name}
                            className="flex items-center justify-between px-4 py-2 hover:bg-slate-100 cursor-pointer transition-colors"
                            onClick={() => {
                              addQuoteItemFromRow(row.name, row);
                              setSearchTerm('');
                            }}
                          >
                            <span className="font-medium text-slate-900">{row.name}</span>
                            <span className="text-rose-600 font-semibold">
                              {row.unitPrice ? `₱${row.unitPrice.toLocaleString('en-PH')}` : 'Set price in TSV'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.3em] text-slate-400">Most used</p>
                <ul className="space-y-3">
                  {popularSheetKeys.map((key) => {
                    const row = priceMap[key.toLowerCase()];
                    return (
                      <li
                        key={key}
                        className={`rounded-2xl border-2 p-4 transition-all ${
                          row?.unitPrice 
                            ? 'border-slate-300 bg-white cursor-pointer hover:border-slate-400 hover:shadow-md shadow-sm' 
                            : 'border-slate-200 opacity-50 cursor-not-allowed bg-slate-50'
                        }`}
                        onClick={() => addQuoteItemFromRow(row?.name ?? key, row)}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-medium text-slate-900">{row?.name ?? key}</p>
                          <span className="text-sm font-semibold text-rose-600">
                            {row?.unitPrice ? `₱${row.unitPrice.toLocaleString('en-PH')}` : 'Set price in TSV'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {row?.unitPrice ? 'Tap to add to quotation' : 'Update TSV to enable'}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="rounded-3xl border-2 border-slate-300 bg-white p-6 shadow-lg shadow-slate-200/50">
              <h4 className="text-lg font-semibold text-slate-900 mb-3">Custom line item</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g. Character art on 2 nails"
                  className="w-full rounded-2xl border-2 border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:ring-0 shadow-sm"
                />
                <input
                  type="number"
                  min="0"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="Price (₱)"
                  className="w-full rounded-2xl border-2 border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:ring-0 shadow-sm"
                />
                <input
                  type="number"
                  min="1"
                  value={customQuantity}
                  onChange={(e) => setCustomQuantity(e.target.value)}
                  placeholder="Quantity"
                  className="w-full rounded-2xl border-2 border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:ring-0 shadow-sm"
                />
                <button
                  type="button"
                  onClick={handleAddCustom}
                  disabled={!customLabel.trim() || !customPrice || Number(customQuantity) <= 0}
                  className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Add to quote
                </button>
              </div>
            </div>
          </div>

            <div className="rounded-3xl border-2 border-slate-300 bg-white p-6 shadow-lg shadow-slate-200/50 lg:col-span-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Quotation builder</p>
                <h3 className="text-2xl font-semibold text-slate-900">
                  {quoteItems.length ? `${quoteItems.length} items selected` : 'No items yet'}
                </h3>
                <p className="text-sm text-slate-500">Perfect for pricing inspo photos before confirming bookings.</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Estimated total</p>
                <p className="text-3xl font-bold text-rose-600">₱{total.toLocaleString('en-PH')}</p>
              </div>
            </div>

            {quoteItems.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 shadow-sm">
                Add presets or custom lines to build a quote for your client.
              </div>
            ) : (
              <ul className="space-y-4 mb-6">
                {quoteItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-slate-300 bg-white px-4 py-4 shadow-md hover:shadow-lg transition-all"
                  >
                    <div className="max-w-full sm:max-w-[60%]">
                      <p className="font-medium text-slate-900 text-balance break-words">{item.description}</p>
                      <p className="text-xs text-slate-500">
                        ₱{item.unitPrice.toLocaleString('en-PH')} per unit · subtotal ₱
                        {(item.unitPrice * item.quantity).toLocaleString('en-PH')}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))}
                        className="w-20 rounded-2xl border border-slate-200 px-3 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add inspo references, reminders, or payment terms..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-slate-900 focus:ring-0 mb-4"
              rows={3}
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleGenerateImage}
                disabled={!quoteItems.length || generatingImage}
                className="w-full flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {generatingImage ? 'Generating…' : 'Generate quotation JPG'}
              </button>
              <button
                type="button"
                onClick={handleShareEmail}
                disabled={!quoteItems.length}
                className="w-full flex-1 rounded-full border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40"
              >
                Email / send to client
              </button>
            </div>

            <div className="mt-8 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Quotation card preview</p>
                <p className="text-sm text-slate-500">This is the artwork that gets exported as a JPG.</p>
              </div>
              <div
                ref={quoteCardRef}
                className="mx-auto w-full max-w-md rounded-[28px] border border-slate-100 bg-gradient-to-br from-white via-[#f7f7f7] to-white px-6 py-6 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.6)]"
              >
                <header className="mb-4 flex flex-col items-center gap-3 text-center">
                  <h4 className="text-2xl font-semibold text-slate-900">Client&apos;s Inspo Quotation</h4>
                  <p className="text-xs text-slate-500">{todayLabel}</p>
                </header>

                <div className="space-y-3 mb-5">
                  {quoteItems.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center">Add items to see them here.</p>
                  ) : (
                    quoteItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between rounded-2xl border border-white/70 bg-white px-3 py-2"
                      >
                        <div className="max-w-[70%]">
                          <p className="font-semibold text-slate-900 text-balance break-words">{item.description}</p>
                          <p className="text-xs text-slate-500">
                            Qty {item.quantity} · ₱{item.unitPrice.toLocaleString('en-PH')} per unit
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          ₱{(item.unitPrice * item.quantity).toLocaleString('en-PH')}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="rounded-2xl border border-white bg-white px-4 py-3 text-center">
                  <div className="text-sm font-semibold text-slate-900">
                    <span>Estimated total</span>
                    <p className="text-2xl mt-1">{`₱${total.toLocaleString('en-PH')}`}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    P500 deposit required to secure the slot. Quote valid for 7 days.
                  </p>
                </div>

                {notes.trim() && (
                  <div className="mt-4 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-1">Notes</p>
                    <p className="text-sm text-slate-900 whitespace-pre-line">{notes}</p>
                  </div>
                )}
              </div>

              {generatedPreview && (
                <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900 mb-2">
                    Latest generated JPG (downloaded automatically)
                  </p>
                  <img
                    src={generatedPreview}
                    alt="Quotation preview"
                    className="w-full rounded-2xl border border-slate-100"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Share this image via Messenger, Viber, email, or attach it to your booking confirmation.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-slate-300 bg-white p-6 shadow-lg shadow-slate-200/50">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Google Sheet TSV</p>
              <h3 className="text-2xl font-semibold text-slate-900">Detailed price sheet</h3>
              <p className="text-sm text-slate-500">Pulled directly from the shared spreadsheet link.</p>
            </div>
            <a
              href={PRICE_SHEET_TSV_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:border-slate-900"
            >
              Open sheet
            </a>
          </div>
          {sheetLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">Loading latest sheet...</div>
          ) : sheetError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{sheetError}</div>
          ) : (
            <div className="max-h-[600px] overflow-auto rounded-2xl border-2 border-slate-300 shadow-md">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 border-b-2 border-slate-300">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Unit price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {priceSheet.map((row, index) => (
                    <tr key={`${row.name}-${index}`} className="hover:bg-slate-100 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                      <td className="px-4 py-3 text-slate-600">{row.displayPrice || '—'}</td>
                    </tr>
                  ))}
                  {priceSheet.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-slate-500">
                        No rows found in the TSV.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

