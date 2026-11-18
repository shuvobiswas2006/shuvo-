import React, { useState } from 'react';
import { Banknote, ChevronDown, ChevronRight, Download, Printer, X } from 'lucide-react';
import { apiRequest, downloadCSV, formatBDT } from '../api';
import type { TeacherSalaryReport, TeacherSalaryRow } from '../types';

interface SalaryReportModuleProps {
  month: string;
  onMonthChange: (m: string) => void;
  report: TeacherSalaryReport | null;
  onRefresh: () => void;
}

export const SalaryReportModule: React.FC<SalaryReportModuleProps> = ({
  month,
  onMonthChange,
  report,
  onRefresh,
}) => {
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);
  const [payingTeacher, setPayingTeacher] = useState<TeacherSalaryRow | null>(null);
  const [bonus, setBonus] = useState('0');
  const [deduction, setDeduction] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  if (!report) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
        মাসিক বেতন রিপোর্ট লোড হচ্ছে...
      </div>
    );
  }

  const openPayModal = (row: TeacherSalaryRow) => {
    setPayingTeacher(row);
    setBonus(String(row.bonus || 0));
    setDeduction(String(row.deduction || 0));
    setPaidAmount(String(row.totalPayable));
    setNote(row.note || '');
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingTeacher) return;
    setSaving(true);
    setFeedback('');
    try {
      await apiRequest('/api/reports/teacher-salary/pay', {
        method: 'POST',
        body: JSON.stringify({
          teacherId: payingTeacher.teacherId,
          month,
          bonus: Number(bonus),
          deduction: Number(deduction),
          paidAmount: Number(paidAmount),
          note,
        }),
      });
      setFeedback(`${payingTeacher.name}-এর নগদ ক্যাশ বেতন পরিশোধ সংরক্ষিত হয়েছে।`);
      setPayingTeacher(null);
      onRefresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadCsv = () => {
    downloadCSV(
      `teacher-salary-report-${month}.csv`,
      [
        'কোড',
        'শিক্ষকের নাম',
        'বিষয়',
        'মূল বেতন',
        'গৃহীত ক্লাস',
        'ঘণ্টা',
        'ক্লাস আয়',
        'বোনাস',
        'কর্তন',
        'মোট প্রদেয় বেতন',
        'পরিশোধিত',
        'বকেয়া',
        'রসিদ',
      ],
      report.teachers.map((t) => [
        t.code,
        t.name,
        t.subject,
        t.baseSalary,
        t.classesConducted,
        t.totalHours,
        t.classEarnings,
        t.bonus,
        t.deduction,
        t.totalPayable,
        t.paidAmount,
        t.balanceDue,
        t.receiptNo || '-',
      ])
    );
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-num"
          />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              মাসিক শিক্ষক বেতন ও ক্লাস রিপোর্ট — {report.monthLabel}
            </h2>
            <p className="text-xs text-slate-500">
              প্রতিটি শিক্ষকের গৃহীত ক্লাস ও মূল বেতন অনুযায়ী মোট প্রদেয় বেতনের বিস্তারিত হিসাব
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>CSV ডাউনলোড</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>রিপোর্ট প্রিন্ট / PDF ডাউনলোড</span>
          </button>
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

      {/* Printable Report Sheet */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden print-container">
        {/* Official Report Header */}
        <div className="p-6 border-b border-slate-200 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {report.institute.name}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {report.institute.address} · ফোন: {report.institute.phone}
            </p>
            <p className="text-sm font-semibold text-teal-800 mt-2">
              শিক্ষকদের মাসিক বিস্তারিত বেতন বিবরণী — {report.monthLabel}
            </p>
          </div>
          <div className="text-right font-mono-num text-xs text-slate-600 space-y-1">
            <div>মোট ক্লাস: <strong className="text-slate-900">{report.summary.grandTotalClasses}টি</strong></div>
            <div>সর্বমোট প্রদেয়: <strong className="text-slate-900 text-sm">{formatBDT(report.summary.grandTotalPayable)}</strong></div>
            <div>পরিশোধিত (ক্যাশ): <strong className="text-emerald-700">{formatBDT(report.summary.grandTotalPaid)}</strong></div>
            <div>বকেয়া: <strong className="text-amber-700">{formatBDT(report.summary.grandBalanceDue)}</strong></div>
          </div>
        </div>

        {/* Detailed Salary Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">শিক্ষক ও বিষয়</th>
                <th className="py-3 px-3 text-right">মূল বেতন</th>
                <th className="py-3 px-3 text-right">ক্লাস (ঘণ্টা)</th>
                <th className="py-3 px-3 text-right">ক্লাস আয়</th>
                <th className="py-3 px-3 text-right">বোনাস / কর্তন</th>
                <th className="py-3 px-4 text-right">মোট প্রদেয় বেতন</th>
                <th className="py-3 px-3 text-right">পরিশোধিত</th>
                <th className="py-3 px-4">অবস্থা</th>
                <th className="py-3 px-4 text-right no-print">ক্যাশ পেমেন্ট</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.teachers.map((t) => {
                const isExpanded = expandedTeacherId === t.teacherId;
                return (
                  <React.Fragment key={t.teacherId}>
                    <tr className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedTeacherId(isExpanded ? null : t.teacherId)
                          }
                          className="inline-flex items-start gap-1.5 text-left cursor-pointer"
                        >
                          <span className="mt-1 text-slate-400 no-print">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </span>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {t.name} <span className="text-xs font-mono-num text-slate-500">({t.code})</span>
                            </div>
                            <div className="text-xs text-slate-500">
                              {t.subject} · রেট: <span className="font-mono-num">{formatBDT(t.perClassRate)}/ক্লাস</span>
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num">
                        {formatBDT(t.baseSalary)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num">
                        {t.classesConducted}টি ({t.totalHours}h)
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-800">
                        {formatBDT(t.classEarnings)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-xs">
                        {t.bonus > 0 && <span className="text-emerald-700">+{formatBDT(t.bonus)}</span>}
                        {t.bonus > 0 && t.deduction > 0 && ' / '}
                        {t.deduction > 0 && <span className="text-red-700">-{formatBDT(t.deduction)}</span>}
                        {t.bonus === 0 && t.deduction === 0 && '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-bold text-slate-900">
                        {formatBDT(t.totalPayable)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-emerald-700 font-medium">
                        {formatBDT(t.paidAmount)}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        {t.status === 'paid' ? (
                          <span className="text-emerald-700">
                            পরিশোধিত
                            {t.receiptNo && (
                              <div className="text-[11px] font-mono-num text-slate-500 font-normal">
                                {t.receiptNo}
                              </div>
                            )}
                          </span>
                        ) : t.status === 'partial' ? (
                          <span className="text-amber-700">আংশিক পরিশোধিত</span>
                        ) : (
                          <span className="text-amber-700">প্রদান বাকি</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right no-print whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openPayModal(t)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-md cursor-pointer"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          <span>{t.status === 'paid' ? 'সমন্বয়' : 'ক্যাশ প্রদান'}</span>
                        </button>
                      </td>
                    </tr>

                    {/* Itemized Conducted Classes Breakdown */}
                    {(isExpanded || false) && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={9} className="px-8 py-3">
                          <div className="text-xs font-semibold text-slate-700 mb-2">
                            {t.name}-এর {report.monthLabel} মাসের গৃহীত ক্লাসসমূহ:
                          </div>
                          {t.logs.length === 0 ? (
                            <div className="text-xs text-slate-500">
                              এই মাসে কোনো ক্লাস লগ পাওয়া যায়নি।
                            </div>
                          ) : (
                            <table className="w-full text-xs border border-slate-200 bg-white">
                              <thead>
                                <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                                  <th className="py-1.5 px-3">তারিখ</th>
                                  <th className="py-1.5 px-3">ব্যাচ</th>
                                  <th className="py-1.5 px-3">টপিক</th>
                                  <th className="py-1.5 px-3 text-right">ক্লাস</th>
                                  <th className="py-1.5 px-3 text-right">সম্মানী</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {t.logs.map((l) => (
                                  <tr key={l.id}>
                                    <td className="py-1.5 px-3 font-mono-num">{l.date}</td>
                                    <td className="py-1.5 px-3">{l.batchName}</td>
                                    <td className="py-1.5 px-3 text-slate-600">{l.topic}</td>
                                    <td className="py-1.5 px-3 text-right font-mono-num">
                                      {l.classesCount} × {formatBDT(l.ratePerClass)}
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-mono-num font-semibold">
                                      {formatBDT(l.totalEarned)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                <td className="py-3 px-4">সর্বমোট ({report.teachers.length} জন শিক্ষক)</td>
                <td className="py-3 px-3 text-right font-mono-num">
                  {formatBDT(report.teachers.reduce((s, t) => s + t.baseSalary, 0))}
                </td>
                <td className="py-3 px-3 text-right font-mono-num">
                  {report.summary.grandTotalClasses}টি
                </td>
                <td className="py-3 px-3 text-right font-mono-num">
                  {formatBDT(report.teachers.reduce((s, t) => s + t.classEarnings, 0))}
                </td>
                <td className="py-3 px-3"></td>
                <td className="py-3 px-4 text-right font-mono-num text-teal-900">
                  {formatBDT(report.summary.grandTotalPayable)}
                </td>
                <td className="py-3 px-3 text-right font-mono-num text-emerald-700">
                  {formatBDT(report.summary.grandTotalPaid)}
                </td>
                <td colSpan={2} className="py-3 px-4 text-xs text-amber-800 font-mono-num">
                  বকেয়া: {formatBDT(report.summary.grandBalanceDue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Print Signature Block */}
        <div className="hidden print:grid grid-cols-2 gap-16 px-8 pt-14 pb-6 text-xs text-slate-700">
          <div className="border-t border-slate-400 pt-2 text-center">
            হিসাবরক্ষক / প্রস্তুতকারীর স্বাক্ষর
          </div>
          <div className="border-t border-slate-400 pt-2 text-center">
            অ্যাডমিন / পরিচালকের অনুমোদন ও স্বাক্ষর
          </div>
        </div>
      </div>

      {/* Salary Cash Payout Modal */}
      {payingTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                বেতন পরিশোধ (ক্যাশ) — {payingTeacher.name}
              </h3>
              <button type="button" onClick={() => setPayingTeacher(null)} className="cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handlePaySubmit} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 font-mono-num">
                <div className="flex justify-between">
                  <span>মূল বেতন:</span>
                  <span>{formatBDT(payingTeacher.baseSalary)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ক্লাস আয় ({payingTeacher.classesConducted}টি ক্লাস):</span>
                  <span>{formatBDT(payingTeacher.classEarnings)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>সমন্বিত মোট বেতন:</span>
                  <span>
                    {formatBDT(
                      Math.max(
                        0,
                        payingTeacher.baseSalary +
                          payingTeacher.classEarnings +
                          Number(bonus || 0) -
                          Number(deduction || 0)
                      )
                    )}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    বোনাস / ভাতা (৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={bonus}
                    onChange={(e) => {
                      setBonus(e.target.value);
                      const nextTotal = Math.max(
                        0,
                        payingTeacher.baseSalary +
                          payingTeacher.classEarnings +
                          Number(e.target.value || 0) -
                          Number(deduction || 0)
                      );
                      setPaidAmount(String(nextTotal));
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    কর্তন / অগ্রিম (৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={deduction}
                    onChange={(e) => {
                      setDeduction(e.target.value);
                      const nextTotal = Math.max(
                        0,
                        payingTeacher.baseSalary +
                          payingTeacher.classEarnings +
                          Number(bonus || 0) -
                          Number(e.target.value || 0)
                      );
                      setPaidAmount(String(nextTotal));
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পরিশোধিত নগদ ক্যাশ পরিমাণ (৳) *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  মন্তব্য
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="নগদ ক্যাশ বেতন প্রদান"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPayingTeacher(null)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-lg cursor-pointer"
                >
                  {saving ? 'সংরক্ষণ হচ্ছে...' : 'ক্যাশ বেতন নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
