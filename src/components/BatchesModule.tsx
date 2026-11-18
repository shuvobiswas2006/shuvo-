import React, { useState } from 'react';
import { Edit3, Plus, Trash2, X } from 'lucide-react';
import { apiRequest, formatBDT } from '../api';
import type { Batch, Teacher } from '../types';

interface BatchesModuleProps {
  batches: Batch[];
  teachers: Teacher[];
  onRefresh: () => void;
}

export const BatchesModule: React.FC<BatchesModuleProps> = ({
  batches,
  teachers,
  onRefresh,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [name, setName] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [subject, setSubject] = useState('');
  const [schedule, setSchedule] = useState('');
  const [room, setRoom] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('2500');
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || '');
  const [capacity, setCapacity] = useState('30');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const openNew = () => {
    setEditing(null);
    setName('');
    setClassLevel('দশম শ্রেণি');
    setSubject('');
    setSchedule('শনি, সোম, বুধ · বিকাল ০৪:০০');
    setRoom('রুম ১০১');
    setMonthlyFee('2500');
    setTeacherId(teachers[0]?.id || '');
    setCapacity('30');
    setShowForm(true);
  };

  const openEdit = (b: Batch) => {
    setEditing(b);
    setName(b.name);
    setClassLevel(b.classLevel);
    setSubject(b.subject);
    setSchedule(b.schedule);
    setRoom(b.room);
    setMonthlyFee(String(b.monthlyFee));
    setTeacherId(b.teacherId);
    setCapacity(String(b.capacity));
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback('');
    try {
      const payload = {
        name,
        classLevel,
        subject,
        schedule,
        room,
        monthlyFee: Number(monthlyFee),
        teacherId,
        capacity: Number(capacity),
      };
      if (editing) {
        await apiRequest(`/api/batches/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback('ক্লাস / ব্যাচের তথ্য সফলভাবে আপডেট হয়েছে।');
      } else {
        await apiRequest('/api/batches', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback('নতুন ক্লাস / ব্যাচ তৈরি হয়েছে।');
      }
      setShowForm(false);
      onRefresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b: Batch) => {
    await apiRequest(`/api/batches/${b.id}`, { method: 'DELETE' });
    setFeedback(`"${b.name}" মুছে ফেলা হয়েছে।`);
    onRefresh();
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            ক্লাস ও ব্যাচ ব্যবস্থাপনা
          </h2>
          <p className="text-xs text-slate-500">
            নতুন ব্যাচ তৈরি করুন, ক্লাসের সময়সূচি, রুম, শিক্ষক ও মাসিক ফি আপডেট করুন
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white text-sm font-semibold rounded-lg cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন ব্যাচ যোগ করুন</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-900 flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="cursor-pointer p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {batches.map((b) => (
          <div
            key={b.id}
            className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">
                    {b.classLevel} · {b.room}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    {b.name}
                  </h3>
                </div>
                <div className="text-right font-mono-num shrink-0">
                  <div className="text-sm font-bold text-teal-800">
                    {formatBDT(b.monthlyFee)}
                  </div>
                  <div className="text-xs text-slate-500">মাসিক ফি</div>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-1 pt-1">
                <div>বিষয়সমূহ: {b.subject}</div>
                <div>সময়সূচি: {b.schedule}</div>
                <div>দায়িত্বপ্রাপ্ত শিক্ষক: {b.teacherName || 'নির্ধারিত নয়'}</div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-mono-num text-slate-600">
                শিক্ষার্থী: <strong className="text-slate-900">{b.studentCount || 0}</strong> / {b.capacity} জন
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(b)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>ক্লাস আপডেট</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(b)}
                  className="p-1.5 border border-slate-300 rounded-md text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editing ? 'ব্যাচ / ক্লাস আপডেট করুন' : 'নতুন ব্যাচ তৈরি করুন'}
              </h3>
              <button type="button" onClick={() => setShowForm(false)} className="cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ব্যাচের নাম *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    শ্রেণি / স্তর *
                  </label>
                  <input
                    type="text"
                    required
                    value={classLevel}
                    onChange={(e) => setClassLevel(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    বিষয়সমূহ
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    সময়সূচি
                  </label>
                  <input
                    type="text"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    কক্ষ নম্বর
                  </label>
                  <input
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    মাসিক ফি (৳)
                  </label>
                  <input
                    type="number"
                    required
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    আসন সংখ্যা
                  </label>
                  <input
                    type="number"
                    required
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  প্রধান শিক্ষক
                </label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">শিক্ষক নির্বাচন করুন</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-lg cursor-pointer"
                >
                  {saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
