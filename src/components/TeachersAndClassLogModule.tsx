import React, { useMemo, useState } from 'react';
import { BookOpenCheck, Edit3, Plus, Trash2, Users, X } from 'lucide-react';
import { apiRequest, formatBDT, formatBengaliMonth } from '../api';
import type { Batch, Teacher, TeacherClassLog } from '../types';

interface TeachersAndClassLogModuleProps {
  month: string;
  onMonthChange: (m: string) => void;
  teachers: Teacher[];
  batches: Batch[];
  classLogs: TeacherClassLog[];
  onRefresh: () => void;
}

export const TeachersAndClassLogModule: React.FC<TeachersAndClassLogModuleProps> = ({
  month,
  onMonthChange,
  teachers,
  batches,
  classLogs,
  onRefresh,
}) => {
  const [tab, setTab] = useState<'logs' | 'teachers'>('logs');
  const [teacherFilter, setTeacherFilter] = useState('all');

  // Class Log Form State
  const [logTeacherId, setLogTeacherId] = useState(teachers[0]?.id || '');
  const [logBatchId, setLogBatchId] = useState(batches[0]?.id || '');
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logSubject, setLogSubject] = useState(teachers[0]?.subject || '');
  const [logClassesCount, setLogClassesCount] = useState('1');
  const [logHours, setLogHours] = useState('1.5');
  const [logRate, setLogRate] = useState(String(teachers[0]?.perClassRate || 800));
  const [logTopic, setLogTopic] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Teacher Modal State
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [tName, setTName] = useState('');
  const [tPhone, setTPhone] = useState('');
  const [tEmail, setTEmail] = useState('');
  const [tSubject, setTSubject] = useState('');
  const [tQualification, setTQualification] = useState('');
  const [tBaseSalary, setTBaseSalary] = useState('5000');
  const [tPerClassRate, setTPerClassRate] = useState('800');

  const handleLogTeacherSelect = (tid: string) => {
    setLogTeacherId(tid);
    const t = teachers.find((x) => x.id === tid);
    if (t) {
      setLogSubject(t.subject);
      setLogRate(String(t.perClassRate));
    }
  };

  const estimatedEarned =
    Math.max(1, Number(logClassesCount || 1)) * Number(logRate || 0);

  const handleAddClassLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback('');
    try {
      await apiRequest('/api/class-logs', {
        method: 'POST',
        body: JSON.stringify({
          teacherId: logTeacherId,
          batchId: logBatchId,
          subject: logSubject,
          date: logDate,
          classesCount: Number(logClassesCount),
          durationHours: Number(logHours),
          ratePerClass: Number(logRate),
          topic: logTopic || 'নিয়মিত পাঠদান',
        }),
      });
      setLogTopic('');
      setFeedback('শিক্ষকের ক্লাস লগ সংরক্ষিত হয়েছে ও মোট প্রদেয় টাকা স্বয়ংক্রিয়ভাবে আপডেট হয়েছে।');
      onRefresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'ক্লাস লগ সেভ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    await apiRequest(`/api/class-logs/${id}`, { method: 'DELETE' });
    setFeedback('ক্লাস এন্ট্রি মুছে ফেলা হয়েছে।');
    onRefresh();
  };

  const openTeacherModal = (t?: Teacher) => {
    if (t) {
      setEditingTeacher(t);
      setTName(t.name);
      setTPhone(t.phone);
      setTEmail(t.email);
      setTSubject(t.subject);
      setTQualification(t.qualification);
      setTBaseSalary(String(t.baseSalary));
      setTPerClassRate(String(t.perClassRate));
    } else {
      setEditingTeacher(null);
      setTName('');
      setTPhone('');
      setTEmail('');
      setTSubject('');
      setTQualification('');
      setTBaseSalary('5000');
      setTPerClassRate('800');
    }
    setShowTeacherModal(true);
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback('');
    try {
      const payload = {
        name: tName,
        phone: tPhone,
        email: tEmail,
        subject: tSubject,
        qualification: tQualification,
        baseSalary: Number(tBaseSalary),
        perClassRate: Number(tPerClassRate),
      };
      if (editingTeacher) {
        await apiRequest(`/api/teachers/${editingTeacher.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback('শিক্ষকের তথ্য আপডেট করা হয়েছে।');
      } else {
        await apiRequest('/api/teachers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback('নতুন শিক্ষক যুক্ত করা হয়েছে।');
      }
      setShowTeacherModal(false);
      onRefresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'ব্যর্থ হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return classLogs.filter(
      (l) =>
        l.month === month &&
        (teacherFilter === 'all' || l.teacherId === teacherFilter)
    );
  }, [classLogs, month, teacherFilter]);

  const teacherEarningsMap = useMemo(() => {
    return teachers.map((t) => {
      const tLogs = classLogs.filter(
        (l) => l.teacherId === t.id && l.month === month
      );
      const classes = tLogs.reduce((s, l) => s + l.classesCount, 0);
      const classPay = tLogs.reduce((s, l) => s + l.totalEarned, 0);
      return {
        teacher: t,
        classes,
        classPay,
        totalPayable: t.baseSalary + classPay,
      };
    });
  }, [teachers, classLogs, month]);

  return (
    <div className="space-y-5">
      {/* Sub-navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('logs')}
            className={`inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-md cursor-pointer ${
              tab === 'logs'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpenCheck className="w-4 h-4" />
            <span>শিক্ষকদের ক্লাস লগ ও সম্মানী</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('teachers')}
            className={`inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-md cursor-pointer ${
              tab === 'teachers'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>শিক্ষকদের তথ্য ({teachers.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono-num"
          />
          {tab === 'teachers' && (
            <button
              type="button"
              onClick={() => openTeacherModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white text-sm font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন শিক্ষক যোগ</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-900 flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="cursor-pointer p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {tab === 'logs' ? (
        <div className="space-y-6">
          {/* Live Per-Teacher Earned Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {teacherEarningsMap.map(({ teacher, classes, classPay, totalPayable }) => (
              <div
                key={teacher.id}
                className="bg-white border border-slate-200 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{teacher.subject}</span>
                  <span className="font-mono-num">{teacher.code}</span>
                </div>
                <div className="font-bold text-slate-900">{teacher.name}</div>
                <div className="pt-2 border-t border-slate-100 text-xs space-y-1 font-mono-num">
                  <div className="flex justify-between text-slate-600">
                    <span>গৃহীত ক্লাস:</span>
                    <span className="font-semibold text-slate-900">{classes}টি ({formatBDT(classPay)})</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>মূল বেতন:</span>
                    <span>{formatBDT(teacher.baseSalary)}</span>
                  </div>
                  <div className="flex justify-between text-teal-800 font-bold pt-1 border-t border-slate-100">
                    <span>মোট প্রাপ্য ({formatBengaliMonth(month)}):</span>
                    <span>{formatBDT(totalPayable)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Log Conducted Class Form */}
          <form
            onSubmit={handleAddClassLog}
            className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  গৃহীত ক্লাস লগ করুন (Class Entry)
                </h3>
                <p className="text-xs text-slate-500">
                  শিক্ষক যে ক্লাস নিয়েছেন তা এখানে এন্ট্রি দিলে স্বয়ংক্রিয়ভাবে মোট বেতনের সাথে যুক্ত হবে
                </p>
              </div>
              <div className="text-sm font-mono-num font-bold text-teal-800">
                এই এন্ট্রির সম্মানী: {formatBDT(estimatedEarned)}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  শিক্ষক নির্বাচন *
                </label>
                <select
                  required
                  value={logTeacherId}
                  onChange={(e) => handleLogTeacherSelect(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ব্যাচ / ক্লাস *
                </label>
                <select
                  required
                  value={logBatchId}
                  onChange={(e) => setLogBatchId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ক্লাসের তারিখ *
                </label>
                <input
                  type="date"
                  required
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বিষয়
                </label>
                <input
                  type="text"
                  required
                  value={logSubject}
                  onChange={(e) => setLogSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ক্লাস সংখ্যা *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={logClassesCount}
                  onChange={(e) => setLogClassesCount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  সময়কাল (ঘণ্টা)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0.5}
                  value={logHours}
                  onChange={(e) => setLogHours(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  প্রতি ক্লাস সম্মানী (৳)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={logRate}
                  onChange={(e) => setLogRate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পাঠদানের টপিক
                </label>
                <input
                  type="text"
                  value={logTopic}
                  onChange={(e) => setLogTopic(e.target.value)}
                  placeholder="যেমন: অধ্যায় ০৪ — তড়িৎ প্রবাহ"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{saving ? 'যুক্ত হচ্ছে...' : 'ক্লাস লগ সংরক্ষণ করুন'}</span>
              </button>
            </div>
          </form>

          {/* Logged Classes Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {formatBengaliMonth(month)}-এর গৃহীত ক্লাসের বিস্তারিত লগ
              </h3>
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-1.5 text-xs bg-white"
              >
                <option value="all">সকল শিক্ষক</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">তারিখ</th>
                    <th className="py-3 px-4">শিক্ষক</th>
                    <th className="py-3 px-4">ব্যাচ ও বিষয়</th>
                    <th className="py-3 px-4">টপিক</th>
                    <th className="py-3 px-3 text-right">ক্লাস</th>
                    <th className="py-3 px-3 text-right">রেট</th>
                    <th className="py-3 px-4 text-right">মোট আয়</th>
                    <th className="py-3 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                        এই মাসে এখনো কোনো ক্লাস লগ করা হয়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                          {l.date}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {l.teacherName}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800">{l.batchName}</div>
                          <div className="text-xs text-slate-500">{l.subject}</div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">{l.topic}</td>
                        <td className="py-3 px-3 text-right font-mono-num">
                          {l.classesCount} ({l.durationHours}h)
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num text-slate-600">
                          {formatBDT(l.ratePerClass)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num font-bold text-teal-800">
                          {formatBDT(l.totalEarned)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteLog(l.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Teachers Directory */
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">কোড</th>
                  <th className="py-3 px-4">শিক্ষকের নাম ও যোগ্যতা</th>
                  <th className="py-3 px-4">বিষয়</th>
                  <th className="py-3 px-4">যোগাযোগ</th>
                  <th className="py-3 px-3 text-right">মাসিক মূল বেতন</th>
                  <th className="py-3 px-3 text-right">প্রতি ক্লাস রেট</th>
                  <th className="py-3 px-4 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono-num font-semibold text-slate-700">
                      {t.code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.qualification}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-800">{t.subject}</td>
                    <td className="py-3 px-4 text-xs text-slate-600 font-mono-num">
                      <div>{t.phone}</div>
                      <div className="font-sans text-slate-500">{t.email}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num font-medium">
                      {formatBDT(t.baseSalary)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num font-semibold text-teal-800">
                      {formatBDT(t.perClassRate)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openTeacherModal(t)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>সম্পাদনা</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Teacher Add/Edit Modal */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingTeacher ? 'শিক্ষকের তথ্য আপডেট' : 'নতুন শিক্ষক যুক্ত করুন'}
              </h3>
              <button type="button" onClick={() => setShowTeacherModal(false)} className="cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTeacher} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">নাম *</label>
                  <input
                    type="text"
                    required
                    value={tName}
                    onChange={(e) => setTName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">মোবাইল *</label>
                  <input
                    type="text"
                    required
                    value={tPhone}
                    onChange={(e) => setTPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">বিষয় *</label>
                  <input
                    type="text"
                    required
                    value={tSubject}
                    onChange={(e) => setTSubject(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ইমেইল</label>
                  <input
                    type="email"
                    value={tEmail}
                    onChange={(e) => setTEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    মাসিক মূল বেতন (৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={tBaseSalary}
                    onChange={(e) => setTBaseSalary(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    প্রতি ক্লাস সম্মানী (৳) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={tPerClassRate}
                    onChange={(e) => setTPerClassRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">শিক্ষাগত যোগ্যতা</label>
                <input
                  type="text"
                  value={tQualification}
                  onChange={(e) => setTQualification(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowTeacherModal(false)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-lg cursor-pointer"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
