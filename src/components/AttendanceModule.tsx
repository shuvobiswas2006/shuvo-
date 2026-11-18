import React, { useEffect, useState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import { apiRequest } from '../api';
import type { AttendanceRecord, AttendanceStatus, Batch, Student } from '../types';

interface AttendanceModuleProps {
  batches: Batch[];
  students: Student[];
  onRefresh: () => void;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  batches,
  students,
  onRefresh,
}) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [batchId, setBatchId] = useState(batches[0]?.id || '');
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [sendAbsentSms, setSendAbsentSms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const batchStudents = students.filter(
    (s) => s.batchId === batchId && s.status === 'active'
  );

  useEffect(() => {
    if (!batchId && batches.length > 0) {
      setBatchId(batches[0].id);
    }
  }, [batches, batchId]);

  useEffect(() => {
    if (!batchId || !date) return;
    let active = true;
    setLoading(true);
    apiRequest<AttendanceRecord[]>(`/api/attendance?date=${date}&batchId=${batchId}`)
      .then((records) => {
        if (!active) return;
        const map: Record<string, AttendanceStatus> = {};
        for (const st of batchStudents) {
          const found = records.find((r) => r.studentId === st.id);
          map[st.id] = found ? found.status : 'present';
        }
        setStatusMap(map);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, batchId, students.length]);

  const setAllStatus = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    for (const st of batchStudents) {
      next[st.id] = status;
    }
    setStatusMap(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const entries = batchStudents.map((st) => ({
        studentId: st.id,
        status: statusMap[st.id] || 'present',
      }));
      const res = await apiRequest<{ saved: number; absentSmsCount: number }>(
        '/api/attendance',
        {
          method: 'POST',
          body: JSON.stringify({
            date,
            batchId,
            entries,
            sendAbsentSms,
          }),
        }
      );
      setMessage(
        `${res.saved} জন শিক্ষার্থীর উপস্থিতি সংরক্ষণ করা হয়েছে।${
          res.absentSmsCount > 0
            ? ` (${res.absentSmsCount} জন অনুপস্থিতের অভিভাবককে SMS পাঠানো হয়েছে)`
            : ''
        }`
      );
      onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const presentCount = batchStudents.filter((s) => statusMap[s.id] === 'present').length;
  const lateCount = batchStudents.filter((s) => statusMap[s.id] === 'late').length;
  const absentCount = batchStudents.filter((s) => statusMap[s.id] === 'absent').length;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">তারিখ</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-num"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">ব্যাচ নির্বাচন</label>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[240px]"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-slate-600 font-mono-num">
            উপস্থিত: <strong className="text-emerald-700">{presentCount}</strong> · বিলম্ব:{' '}
            <strong className="text-amber-700">{lateCount}</strong> · অনুপস্থিত:{' '}
            <strong className="text-red-700">{absentCount}</strong>
          </div>
          <button
            type="button"
            onClick={() => setAllStatus('present')}
            className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            সবাইকে উপস্থিত দিন
          </button>
          <button
            type="button"
            disabled={saving || batchStudents.length === 0}
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-lg cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'উপস্থিতি সেভ করুন'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={sendAbsentSms}
            onChange={(e) => setSendAbsentSms(e.target.checked)}
            className="rounded border-slate-300 text-teal-800"
          />
          <span>অনুপস্থিত শিক্ষার্থীদের অভিভাবকের নম্বরে স্বয়ংক্রিয় SMS সতর্কতা পাঠান</span>
        </label>
        {message && (
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800">
            <CheckCircle2 className="w-4 h-4" />
            <span>{message}</span>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">তালিকা লোড হচ্ছে...</div>
        ) : batchStudents.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            এই ব্যাচে কোনো সক্রিয় শিক্ষার্থী নেই।
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">রোল</th>
                <th className="py-3 px-4">শিক্ষার্থীর নাম</th>
                <th className="py-3 px-4">অভিভাবক ও ফোন</th>
                <th className="py-3 px-4 text-right">মোট উপস্থিতি হার</th>
                <th className="py-3 px-4 text-right">আজকের অবস্থা</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {batchStudents.map((st) => {
                const current = statusMap[st.id] || 'present';
                return (
                  <tr key={st.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono-num font-semibold text-slate-800">
                      {st.rollNo}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{st.name}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {st.guardianName} · <span className="font-mono-num">{st.guardianPhone}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-xs text-slate-700">
                      {st.attendanceSummary?.rate ?? 100}%
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                        <button
                          type="button"
                          onClick={() =>
                            setStatusMap((prev) => ({ ...prev, [st.id]: 'present' }))
                          }
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                            current === 'present'
                              ? 'bg-emerald-700 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          উপস্থিত
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStatusMap((prev) => ({ ...prev, [st.id]: 'late' }))
                          }
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                            current === 'late'
                              ? 'bg-amber-600 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          বিলম্ব
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStatusMap((prev) => ({ ...prev, [st.id]: 'absent' }))
                          }
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                            current === 'absent'
                              ? 'bg-red-700 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          অনুপস্থিত
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
