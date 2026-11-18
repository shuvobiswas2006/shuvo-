import React, { useMemo, useState } from 'react';
import {
  Banknote,
  Download,
  MessageCircle,
  Play,
  Printer,
  Search,
  X,
} from 'lucide-react';
import {
  apiRequest,
  downloadCSV,
  formatBDT,
  formatBengaliMonth,
  getWhatsAppUrl,
} from '../api';
import type { CoachingSettings, FeeRow } from '../types';

interface FeesModuleProps {
  month: string;
  onMonthChange: (m: string) => void;
  fees: FeeRow[];
  settings: CoachingSettings | null;
  onRefresh: () => void;
}

export const FeesModule: React.FC<FeesModuleProps> = ({
  month,
  onMonthChange,
  fees,
  settings,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [payingRow, setPayingRow] = useState<FeeRow | null>(null);
  const [receiptRow, setReceiptRow] = useState<FeeRow | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [note, setNote] = useState('');
  const [sendReceiptSms, setSendReceiptSms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [simDay, setSimDay] = useState(String(new Date().getDate()));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fees.filter((f) => {
      const matchStatus = statusFilter === 'all' || f.status === statusFilter;
      const matchQ =
        !q ||
        f.studentName.toLowerCase().includes(q) ||
        f.rollNo.toLowerCase().includes(q) ||
        f.batchName.toLowerCase().includes(q);
      return matchStatus && matchQ;
    });
  }, [fees, search, statusFilter]);

  const totals = useMemo(() => {
    return fees.reduce(
      (acc, f) => {
        acc.expected += f.netPayable;
        acc.collected += f.paidAmount;
        acc.due += f.remainingDue;
        acc.fines += f.fineAmount;
        return acc;
      },
      { expected: 0, collected: 0, due: 0, fines: 0 }
    );
  }, [fees]);

  const openCashModal = (row: FeeRow) => {
    setPayingRow(row);
    setCashAmount(String(row.remainingDue));
    setDiscountAmount(String(row.discountAmount || 0));
    setNote(row.note || '');
    setSendReceiptSms(true);
  };

  const handleCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingRow) return;
    setSubmitting(true);
    setFeedback('');
    try {
      await apiRequest(`/api/fees/${payingRow.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(cashAmount),
          discountAmount: Number(discountAmount),
          note,
          sendReceiptSms,
        }),
      });
      setFeedback(
        `${payingRow.studentName}-এর ${formatBDT(Number(cashAmount))} নগদ ক্যাশ ফি গ্রহণ সম্পন্ন হয়েছে।`
      );
      setPayingRow(null);
      onRefresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'পেমেন্ট ব্যর্থ হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunRuleCheck = async () => {
    setSubmitting(true);
    setFeedback('');
    try {
      const res = await apiRequest<{
        evaluatedDay: number;
        remindersSent: number;
        finesApplied: number;
        totalFineAdded: number;
      }>('/api/automation/run', {
        method: 'POST',
        body: JSON.stringify({ month, simulatedDay: Number(simDay) }),
      });
      setFeedback(
        `${res.evaluatedDay} তারিখের নিয়ম অনুযায়ী ${res.remindersSent}টি রিমাইন্ডার SMS এবং ${res.finesApplied}টি জরিমানা (মোট ${formatBDT(res.totalFineAdded)}) প্রক্রিয়া সম্পন্ন হয়েছে।`
      );
      onRefresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'ব্যর্থ হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    downloadCSV(
      `cash-fees-${month}.csv`,
      ['রোল', 'শিক্ষার্থী', 'ব্যাচ', 'মাস', 'মূল ফি', 'জরিমানা', 'ছাড়', 'ক্যাশ জমা', 'বকেয়া', 'রসিদ', 'অবস্থা'],
      filtered.map((f) => [
        f.rollNo,
        f.studentName,
        f.batchName,
        f.month,
        f.baseFee,
        f.fineAmount,
        f.discountAmount,
        f.paidAmount,
        f.remainingDue,
        f.receiptNo || '-',
        f.status === 'paid' ? 'পরিশোধিত' : f.status === 'overdue' ? 'জরিমানাযুক্ত' : 'বকেয়া',
      ])
    );
  };

  return (
    <div className="space-y-5">
      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">মোট প্রাপ্য ফি ({formatBengaliMonth(month)})</div>
          <div className="text-xl font-bold text-slate-900 font-mono-num mt-1">
            {formatBDT(totals.expected)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">নগদ ক্যাশ আদায়</div>
          <div className="text-xl font-bold text-emerald-700 font-mono-num mt-1">
            {formatBDT(totals.collected)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">মোট বকেয়া</div>
          <div className="text-xl font-bold text-amber-700 font-mono-num mt-1">
            {formatBDT(totals.due)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">১৫ তারিখের জরিমানা যুক্ত</div>
          <div className="text-xl font-bold text-red-700 font-mono-num mt-1">
            {formatBDT(totals.fines)}
          </div>
        </div>
      </div>

      {/* Filter & Automation Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="month"
              value={month}
              onChange={(e) => onMonthChange(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-num"
            />
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="নাম বা রোল..."
                className="pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg w-48"
              />
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'pending', 'overdue', 'paid'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'all'
                    ? 'সকল'
                    : st === 'paid'
                      ? 'পরিশোধিত'
                      : st === 'overdue'
                        ? 'জরিমানাযুক্ত'
                        : 'বকেয়া'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-800 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV ডাউনলোড</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-800 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>ফি তালিকা প্রিন্ট</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-600">
            <strong>পেমেন্ট নীতি:</strong> শুধুমাত্র নগদ ক্যাশ গ্রহণযোগ্য · {settings?.reminderDayOfMonth || 10} তারিখে বকেয়া SMS · {settings?.fineDayOfMonth || 15} তারিখে {formatBDT(settings?.lateFineAmount || 200)} জরিমানা স্বয়ংক্রিয়ভাবে যোগ হয়।
          </div>
          <div className="flex items-center gap-2">
            <select
              value={simDay}
              onChange={(e) => setSimDay(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1 text-xs font-mono-num"
            >
              <option value="10">১০ তারিখ চেক</option>
              <option value="15">১৫ তারিখ চেক</option>
              <option value="18">১৮ তারিখ চেক</option>
            </select>
            <button
              type="button"
              disabled={submitting}
              onClick={handleRunRuleCheck}
              className="inline-flex items-center gap-1 px-3 py-1 bg-teal-800 hover:bg-teal-900 text-white font-semibold rounded-md cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3 h-3" />
              <span>নিয়ম চেক চালান</span>
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-900 flex items-center justify-between no-print">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="cursor-pointer p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Printable Fee Ledger */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden print-container">
        <div className="hidden print:block p-6 border-b border-slate-300">
          <h2 className="text-xl font-bold">{settings?.instituteName}</h2>
          <p className="text-sm text-slate-600">
            মাসিক ক্যাশ ফি ও বকেয়া রিপোর্ট — {formatBengaliMonth(month)}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">রোল</th>
                <th className="py-3 px-4">শিক্ষার্থী ও ব্যাচ</th>
                <th className="py-3 px-3 text-right">মাসিক ফি</th>
                <th className="py-3 px-3 text-right">জরিমানা</th>
                <th className="py-3 px-3 text-right">ক্যাশ জমা</th>
                <th className="py-3 px-3 text-right">বকেয়া</th>
                <th className="py-3 px-3">অবস্থা / SMS</th>
                <th className="py-3 px-4 text-right no-print">ক্যাশ অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono-num font-semibold text-slate-800">
                    {f.rollNo}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{f.studentName}</div>
                    <div className="text-xs text-slate-500">{f.batchName}</div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num text-slate-800">
                    {formatBDT(f.baseFee)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num text-red-700">
                    {f.fineAmount > 0 ? `+${formatBDT(f.fineAmount)}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num font-semibold text-emerald-700">
                    {formatBDT(f.paidAmount)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num font-semibold text-slate-900">
                    {formatBDT(f.remainingDue)}
                  </td>
                  <td className="py-3 px-3 text-xs">
                    {f.status === 'paid' ? (
                      <div className="text-emerald-700 font-semibold">
                        ক্যাশ পরিশোধিত
                        <div className="text-[11px] font-mono-num text-slate-500 font-normal">
                          {f.receiptNo}
                        </div>
                      </div>
                    ) : f.status === 'overdue' ? (
                      <div className="text-red-700 font-semibold">
                        জরিমানাযুক্ত বকেয়া
                        {f.reminderSentAt && (
                          <div className="text-[11px] text-slate-500 font-normal">
                            রিমাইন্ডার SMS গেছে
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-amber-700 font-semibold">
                        বকেয়া রয়েছে
                        {f.reminderSentAt && (
                          <div className="text-[11px] text-slate-500 font-normal">
                            ১০ তারিখ SMS গেছে
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right no-print whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      {f.remainingDue > 0 ? (
                        <button
                          type="button"
                          onClick={() => openCashModal(f)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-md cursor-pointer"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          <span>ক্যাশ গ্রহণ</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReceiptRow(f)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>রসিদ</span>
                        </button>
                      )}
                      <a
                        href={getWhatsAppUrl(
                          f.remainingDue > 0
                            ? `${settings?.instituteName || 'ঘাসফুল স্টাডি পয়েন্ট'}: ${f.studentName} (রোল: ${f.rollNo})-এর ${formatBengaliMonth(f.month)} মাসের কোচিং ফি ${formatBDT(f.remainingDue)} বকেয়া রয়েছে।`
                            : `${settings?.instituteName || 'ঘাসফুল স্টাডি পয়েন্ট'}: ${f.studentName} (রোল: ${f.rollNo})-এর ${formatBengaliMonth(f.month)} মাসের ${formatBDT(f.paidAmount)} ক্যাশ ফি গ্রহণ করা হয়েছে। রসিদ: ${f.receiptNo || '-'}।`,
                          f.guardianPhone
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="WhatsApp-এ বার্তা পাঠান"
                        className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-md"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cash Payment Modal */}
      {payingRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                নগদ ক্যাশ ফি গ্রহণ — {payingRow.studentName}
              </h3>
              <button type="button" onClick={() => setPayingRow(null)} className="cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCashSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 font-mono-num">
                <div className="flex justify-between">
                  <span>মাসিক মূল ফি:</span>
                  <span>{formatBDT(payingRow.baseFee)}</span>
                </div>
                <div className="flex justify-between text-red-700">
                  <span>বিলম্ব জরিমানা:</span>
                  <span>{formatBDT(payingRow.fineAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>বর্তমান বকেয়া:</span>
                  <span>{formatBDT(payingRow.remainingDue)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    নগদ ক্যাশ পরিমাণ (৳) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={payingRow.remainingDue}
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    বিশেষ ছাড় (৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পেমেন্ট মাধ্যম
                </label>
                <div className="px-3 py-2 text-sm border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-medium">
                  নগদ ক্যাশ (Cash Only)
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  মন্তব্য (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="যেমন: কাউন্টারে নগদ গ্রহণ"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendReceiptSms}
                  onChange={(e) => setSendReceiptSms(e.target.checked)}
                  className="rounded border-slate-300 text-teal-800"
                />
                <span>অভিভাবককে ক্যাশ ফি রসিদ SMS পাঠান</span>
              </label>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPayingRow(null)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-lg cursor-pointer"
                >
                  {submitting ? 'প্রক্রিয়া চলছে...' : 'ক্যাশ পেমেন্ট নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cash Receipt Modal */}
      {receiptRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4 print-container">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {settings?.instituteName}
                </h3>
                <p className="text-xs text-slate-500">নগদ ক্যাশ ফি জমার রসিদ</p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptRow(null)}
                className="no-print p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-sm space-y-2 font-mono-num">
              <div className="flex justify-between">
                <span className="text-slate-500">রসিদ নং:</span>
                <span className="font-bold">{receiptRow.receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">শিক্ষার্থী:</span>
                <span className="font-sans font-semibold">{receiptRow.studentName} ({receiptRow.rollNo})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">মাস:</span>
                <span className="font-sans">{formatBengaliMonth(receiptRow.month)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">মাসিক ফি:</span>
                <span>{formatBDT(receiptRow.baseFee)}</span>
              </div>
              {receiptRow.fineAmount > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>বিলম্ব জরিমানা:</span>
                  <span>{formatBDT(receiptRow.fineAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-200">
                <span>নগদ ক্যাশ পরিশোধিত:</span>
                <span className="text-emerald-700">{formatBDT(receiptRow.paidAmount)}</span>
              </div>
            </div>
            <div className="pt-3 flex justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-lg cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>রসিদ প্রিন্ট করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
