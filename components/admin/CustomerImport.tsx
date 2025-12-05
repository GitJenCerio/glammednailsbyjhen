'use client';

import { useState } from 'react';
import { IoCloudDownload, IoCheckmarkCircle, IoAlertCircle, IoClose } from 'react-icons/io5';

interface ImportResult {
  totalRows: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  duplicates: number;
  incomplete: number;
  errors: Array<{ row: number; error: string }>;
  duplicateGroups: Array<{
    key: string;
    customers: Array<{ name: string; email?: string; phone?: string; socialMediaName?: string; referralSource?: string; row: number }>;
  }>;
}

interface CustomerImportProps {
  onImportComplete?: () => void;
}

export function CustomerImport({ onImportComplete }: CustomerImportProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDuplicateDetails, setShowDuplicateDetails] = useState(false);
  const [sheetRange, setSheetRange] = useState(
    process.env.NEXT_PUBLIC_GOOGLE_SHEETS_RANGE || "'Form Responses 1'!A:Z"
  );
  const [oldSheetId, setOldSheetId] = useState('');

  const handleAnalyze = async () => {
    if (!oldSheetId.trim()) {
      setError('Please enter your old Google Sheet URL or ID');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetRange,
          sheetId: oldSheetId || undefined, // Use old sheet ID if provided
          dryRun: true, // Analyze only, don't import
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResult(data.result);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze data');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!oldSheetId.trim()) {
      setError('Please enter your old Google Sheet URL or ID');
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const response = await fetch('/api/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetRange,
          sheetId: oldSheetId || undefined, // Use old sheet ID if provided
          dryRun: false, // Actually import
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setResult(data.result);
      
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import customers');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Import Customers from Google Sheets</h2>
          <p className="text-sm text-slate-600 mt-1">
            Import historical customer data from your Google Sheets (March 2024 - Dec 2025)
          </p>
        </div>
      </div>

      {/* Configuration */}
      <div className="mb-6 space-y-4">
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-900 mb-2">⚠️ Importing from Old Google Sheet</p>
          <p className="text-xs text-amber-700 mb-3">
            Since you have a new Google Sheet for current responses, you need to specify your <strong>OLD Google Sheet</strong> (March 2024 - Dec 2025) below.
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Old Google Sheet URL or ID <span className="text-rose-600">*</span>
          </label>
          <input
            type="text"
            value={oldSheetId}
            onChange={(e) => setOldSheetId(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/YOUR_OLD_SHEET_ID/edit or just paste the Sheet ID"
            className="w-full rounded-xl border-2 border-slate-300 px-4 py-2.5 text-sm focus:border-slate-900 focus:ring-0"
            disabled={isImporting || isAnalyzing}
          />
          <p className="text-xs text-slate-500 mt-1">
            Paste your old Google Sheet URL or just the Sheet ID. The system will automatically extract the ID from the URL if you paste the full link.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            💡 <strong>Tip:</strong> You can paste either the full URL or just the ID (the long string between <code>/d/</code> and <code>/edit</code>)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Google Sheets Range
          </label>
          <input
            type="text"
            value={sheetRange}
            onChange={(e) => setSheetRange(e.target.value)}
            placeholder="'Form Responses 1'!A:Z"
            className="w-full rounded-xl border-2 border-slate-300 px-4 py-2.5 text-sm focus:border-slate-900 focus:ring-0"
            disabled={isImporting || isAnalyzing}
          />
          <p className="text-xs text-slate-500 mt-1">
            The range of cells to import from your Google Sheet (e.g., 'Sheet1'!A:Z or 'Form Responses 1'!A1:Z1000)
          </p>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <p className="text-sm font-medium text-blue-900 mb-2">📋 Important Notes</p>
          <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
            <li>Make sure your <strong>old Google Sheet</strong> is shared with your service account email</li>
            <li>The service account email is in your <code className="bg-blue-100 px-1 py-0.5 rounded">.env.local</code> as <code className="bg-blue-100 px-1 py-0.5 rounded">GOOGLE_SERVICE_ACCOUNT_EMAIL</code></li>
            <li>Give the service account at least "Viewer" access to the old sheet</li>
            <li>Your new Google Sheet (for current responses) remains unchanged in <code className="bg-blue-100 px-1 py-0.5 rounded">GOOGLE_SHEETS_ID</code></li>
          </ul>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
          <IoAlertCircle className="text-red-600 text-xl flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            <IoClose className="text-xl" />
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-3">
          <button
            onClick={handleAnalyze}
            disabled={isImporting || isAnalyzing}
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-slate-200 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <IoAlertCircle className="text-lg" />
                Analyze Data First
              </>
            )}
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting || isAnalyzing}
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-rose-600 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isImporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <IoCloudDownload className="text-lg" />
                Import Customers
              </>
            )}
          </button>
        </div>
        
        <div className="space-y-3">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <p className="text-sm font-medium text-blue-900 mb-2">✨ Enrich Existing Customers</p>
            <p className="text-xs text-blue-700 mb-3">
              Extract missing information (First Name, Last Name, FB/Instagram Name, Referral Source) from existing booking records for customers already in the system.
            </p>
            <button
              onClick={async () => {
                if (!confirm('This will enrich all existing customers with data from their booking records. Continue?')) {
                  return;
                }
                setIsAnalyzing(true);
                setError(null);
                try {
                  const response = await fetch('/api/customers/enrich', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ allCustomers: true }),
                  });
                  const data = await response.json();
                  if (response.ok) {
                    setError(null);
                    alert(`Success! ${data.message}\n\nEnriched: ${data.enriched} customers\nUpdated: ${data.updated} customers`);
                    if (onImportComplete) {
                      onImportComplete();
                    }
                  } else {
                    setError(data.error || 'Failed to enrich customers');
                  }
                } catch (err: any) {
                  setError(err.message || 'Failed to enrich customers');
                } finally {
                  setIsAnalyzing(false);
                }
              }}
              disabled={isImporting || isAnalyzing}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enriching...
                </>
              ) : (
                <>
                  <IoCheckmarkCircle className="text-lg" />
                  Enrich All Existing Customers
                </>
              )}
            </button>
          </div>

          <div className="space-y-3">
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
              <p className="text-sm font-medium text-amber-900 mb-2">🔧 Fix Already Imported Customers</p>
              <p className="text-xs text-amber-700 mb-3">
                If you already imported customers from old Google Sheets, this will:
                <br />• Mark customers with <strong>NO bookings</strong> as <strong>repeat clients</strong> (they're from old imported data)
                <br />• Extract missing "How did you find us" field from their booking records
              </p>
              <button
                onClick={async () => {
                  if (!confirm('This will mark customers with no bookings as repeat clients (they\'re from old imported data) and extract missing referral source from booking records. Continue?')) {
                    return;
                  }
                  setIsAnalyzing(true);
                  setError(null);
                  try {
                    const response = await fetch('/api/customers/fix-imported', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        markAsRepeat: true,
                        markOnlyNoBookings: true // Only mark customers with no bookings
                      }),
                    });
                    const data = await response.json();
                    if (response.ok) {
                      setError(null);
                      alert(`Success! ${data.message}\n\nMarked as repeat clients: ${data.markedAsRepeat} customers (with no bookings)\nFixed referral source: ${data.fixedReferralSource} customers`);
                      if (onImportComplete) {
                        onImportComplete();
                      }
                    } else {
                      setError(data.error || 'Failed to fix imported customers');
                    }
                  } catch (err: any) {
                    setError(err.message || 'Failed to fix imported customers');
                  } finally {
                    setIsAnalyzing(false);
                  }
                }}
                disabled={isImporting || isAnalyzing}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <IoCheckmarkCircle className="text-lg" />
                    Mark Customers (No Bookings) as Repeat Clients
                  </>
                )}
              </button>
            </div>

            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <p className="text-sm font-medium text-red-900 mb-2">🗑️ Remove Duplicate Customers</p>
              <p className="text-xs text-red-700 mb-3">
                Find and merge duplicate customers based on:
                <br />• Same email address
                <br />• Same phone number
                <br />• Similar names (fuzzy matching)
                <br />
                <strong>⚠️ This will merge duplicates and update all related bookings!</strong>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setIsAnalyzing(true);
                    setError(null);
                    try {
                      const response = await fetch('/api/customers/remove-duplicates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dryRun: true }),
                      });
                      const data = await response.json();
                      if (response.ok) {
                        setError(null);
                        const message = `Found ${data.duplicateGroups} duplicate groups with ${data.totalDuplicates} duplicate customers.\n\nWould you like to merge them?`;
                        if (confirm(message)) {
                          // Proceed with actual merge
                          const mergeResponse = await fetch('/api/customers/remove-duplicates', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ dryRun: false }),
                          });
                          const mergeData = await mergeResponse.json();
                          if (mergeResponse.ok) {
                            alert(`Success! ${mergeData.message}`);
                            if (onImportComplete) {
                              onImportComplete();
                            }
                          } else {
                            setError(mergeData.error || 'Failed to merge duplicates');
                          }
                        }
                      } else {
                        setError(data.error || 'Failed to analyze duplicates');
                      }
                    } catch (err: any) {
                      setError(err.message || 'Failed to remove duplicates');
                    } finally {
                      setIsAnalyzing(false);
                    }
                  }}
                  disabled={isImporting || isAnalyzing}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <IoCheckmarkCircle className="text-lg" />
                      Find & Remove Duplicates
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Display */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs text-slate-600 mb-1">Total Rows</p>
              <p className="text-2xl font-bold text-slate-900">{result.totalRows}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
              <p className="text-xs text-emerald-700 mb-1">Created</p>
              <p className="text-2xl font-bold text-emerald-900">{result.created}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <p className="text-xs text-blue-700 mb-1">Updated</p>
              <p className="text-2xl font-bold text-blue-900">{result.updated}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <p className="text-xs text-amber-700 mb-1">Duplicates</p>
              <p className="text-2xl font-bold text-amber-900">{result.duplicates}</p>
            </div>
          </div>

          {result.incomplete > 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <IoAlertCircle className="text-yellow-600 text-xl flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">
                    {result.incomplete} records with incomplete data
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    These records are missing both email and phone number. They will still be imported but may be harder to match for repeat customers.
                  </p>
                </div>
              </div>
            </div>
          )}

          {result.duplicateGroups.length > 0 && (
            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-900">
                  {result.duplicateGroups.length} duplicate groups found
                </p>
                <button
                  onClick={() => setShowDuplicateDetails(!showDuplicateDetails)}
                  className="text-sm text-slate-600 hover:text-slate-900 underline"
                >
                  {showDuplicateDetails ? 'Hide' : 'Show'} Details
                </button>
              </div>
              {showDuplicateDetails && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {result.duplicateGroups.map((group, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 border border-slate-200">
                      <p className="text-xs font-medium text-slate-600 mb-2">
                        Group {idx + 1} ({group.customers.length} entries)
                      </p>
                      <div className="space-y-1">
                        {group.customers.map((customer, cIdx) => (
                          <div key={cIdx} className="text-xs text-slate-700 pl-2 border-l-2 border-slate-300">
                            <p className="font-medium">{customer.name}</p>
                            {customer.email && <p className="text-slate-500">Email: {customer.email}</p>}
                            {customer.phone && <p className="text-slate-500">Contact: {customer.phone}</p>}
                            {customer.socialMediaName && <p className="text-slate-500">FB/IG: {customer.socialMediaName}</p>}
                            {customer.referralSource && <p className="text-slate-500">Source: {customer.referralSource}</p>}
                            <p className="text-slate-400">Row: {customer.row}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <p className="text-sm font-medium text-red-900 mb-2">
                {result.errors.length} errors occurred
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {result.errors.map((err, idx) => (
                  <p key={idx} className="text-xs text-red-700">
                    Row {err.row}: {err.error}
                  </p>
                ))}
              </div>
            </div>
          )}

          {result.processed > 0 && (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <IoCheckmarkCircle className="text-emerald-600 text-2xl flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-900">
                  Import completed successfully!
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  {result.processed} customers processed. The system automatically deduplicated customers based on email and phone number.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
        <p className="text-sm font-medium text-blue-900 mb-2">How it works:</p>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>The system automatically extracts customer information (name, email, phone) from your Google Sheet</li>
          <li>Duplicates are identified by matching email or phone number</li>
          <li>Customers with the same email/phone are merged into a single record</li>
          <li>Incomplete records (missing email and phone) are still imported but may be harder to match</li>
          <li>Repeat customers will automatically have their details filled in when booking again</li>
        </ul>
      </div>
    </div>
  );
}

