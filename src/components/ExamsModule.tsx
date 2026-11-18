import React, { useState } from 'react';
import { Award, Download, Plus, Printer, Save, X } from 'lucide-react';
import { apiRequest, downloadCSV } from '../api';
import type { Batch, Exam, Student } from '../types';

interface ExamsModuleProps {
  exams: Exam[];
  batches: Batch[];
  students: Student[];
  onRefresh: () => void;
}

export const ExamsModule: React.FC<ExamsModuleProps> = ({
  exams,
  batches,
  students,
  onRefresh,
}) => {
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [showNewModal, setShowNewModal] = useState(false);
  const [title, setTitle] = useState('');
  const [batchId, setBatchId] = useState(batches[0]?.id || '');
  const [subject, setSubject] = useState('');
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [totalMarks, setTotalMarks] = useState('50');
  const [passMarks, setPassMarks] = useState('20');
  const [marksDraft, setMarksDraft] = useState<Record<string, { marks: string; remarks: string }>>({});
  const [sendSms, setSendSms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const selectedExam = exams.find((e) => e.id === selectedExamId) || exams[0] || null;

  const openMarksEditor = (exam: Exam) => {
    setSelectedExamId(exam.id);
    const batchStudents = students.filter(
      (s) => s.batchId === exam.batchId && s.status === 'active'
    );
    const draft: Record<string, { marks: string; remarks: string }> = {};
    for (const st of batchStudents) {
      const existing = exam.results.find((r) => r.studentId === st.id);
      draft[st.id] = {
        marks: existing ? String(existing.obtainedMarks) : '',
        remarks: existing?.remarks || '',
      };
    }
    setMarksDraft(draft);
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback('');
    try {
      const created = await apiRequest<Exam>('/api/exams', {
        method: 'POST',
        body: JSON.stringify({
          title,
          batchId,
          subject,
          examDate,
          totalMarks: Number(totalMarks),
          passMarks: Number(passMarks),
          results: [],
        }),
      });
      setShowNewModal(false);
      setTitle('');
      setSubject('');
      setFeedback('নতুন পরীক্ষা তৈরি হয়েছে। এখন নম্বর এন্ট্রি করুন।');
      onRefresh();
      setSelectedExamId(created.id);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'ব্যর্থ হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveResults = async () => {
    if (!selectedExam) return;
    setSaving(true);
    setFeedback('');
    try {
      const batchStudents = students.filter(
        (s) => s.batchId === selectedExam.batchId && s.status === 'active'
      );
      const results = batchStudents
        .filter((st) => marksDraft[st.id] && marksDraft[st.id].marks !== '')
        .map((st) => ({
          studentId: st.id,
          obtainedMarks: Number(marksDraft[st.id].marks),
          remarks: marksDraft[st.id].remarks || '',
        }));

      await apiRequest(`/api/exams/${selectedExam.id}/results`, {
        method: 'PUT',
        body: JSON.stringify({ results, sendSms }),
      });
      setFeedback(
        `ফলাফল সংরক্ষিত হয়েছে (${results.length} জন শিক্ষার্থী)${sendSms ? ' ও অভিভাবকদের SMS পাঠানো হয়েছে।' : '।'}`
      );
      setMarksDraft({});
      onRefresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'ব্যর্থ হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const isEditingMarks = selectedExam && Object.keys(marksDraft).length > 0;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            পরীক্ষা ও ফলাফল ট্র্যাকিং
          </h2>
          <p className="text-xs text-slate-500">
            পরীক্ষা তৈরি করুন, নম্বর ইনপুট দিন, মেধাতালিকা দেখুন ও রেজাল্ট SMS পাঠান
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white text-sm font-semibold rounded-lg cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন পরীক্ষা যোগ করুন</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-900 flex items-center justify-between no-print">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="cursor-pointer p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Exam List */}
        <div className="lg:col-span-4 space-y-2 no-print">
          {exams.map((ex) => {
            const active = selectedExam?.id === ex.id;
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => {
                  setSelectedExamId(ex.id);
                  setMarksDraft({});
                }}
                className={`w-full text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                  active
                    ? 'bg-teal-50/70 border-teal-700'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono-num">
                  <span>{ex.examDate}</span>
                  <span>মোট নম্বর: {ex.totalMarks}</span>
                </div>
                <div className="font-semibold text-slate-900 mt-1">{ex.title}</div>
                <div className="text-xs text-slate-600 mt-1">
                  {ex.batchName} · {ex.subject}
                </div>
              </button>
            );
          })}
        </div>

        {/* Exam Merit / Entry Panel */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden print-container">
          {!selectedExam ? (
            <div className="p-8 text-center text-sm text-slate-500">
              একটি পরীক্ষা নির্বাচন করুন অথবা নতুন পরীক্ষা তৈরি করুন।
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedExam.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono-num">
                    {selectedExam.batchName} · {selectedExam.subject} · তারিখ: {selectedExam.examDate} · পূর্ণমান: {selectedExam.totalMarks} (পাস: {selectedExam.passMarks})
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 no-print">
                  {!isEditingMarks ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openMarksEditor(selectedExam)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-md cursor-pointer"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>নম্বর এন্ট্রি / আপডেট</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadCSV(
                            `exam-result-${selectedExam.examDate}.csv`,
                            ['মেধাক্রম', 'রোল', 'শিক্ষার্থী', 'প্রাপ্ত নম্বর', 'পূর্ণমান', 'শতকরা', 'অবস্থা'],
                            selectedExam.results.map((r) => [
                              r.rank,
                              r.rollNo,
                              r.studentName,
                              r.obtainedMarks,
                              selectedExam.totalMarks,
                              `${r.percentage}%`,
                              r.passed ? 'উত্তীর্ণ' : 'অনুত্তীর্ণ',
                            ])
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>প্রিন্ট</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setMarksDraft({})}
                        className="px-3 py-1.5 text-xs border border-slate-300 rounded-md cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleSaveResults}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-md cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{saving ? 'সেভ হচ্ছে...' : 'ফলাফল সংরক্ষণ'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isEditingMarks ? (
                <div className="p-5 space-y-4">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendSms}
                      onChange={(e) => setSendSms(e.target.checked)}
                      className="rounded border-slate-300 text-teal-800"
                    />
                    <span>সংরক্ষণের সাথে সাথে অভিভাবকদের রেজাল্ট SMS পাঠান</span>
                  </label>
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                        <th className="py-2 px-3">রোল</th>
                        <th className="py-2 px-3">শিক্ষার্থী</th>
                        <th className="py-2 px-3">প্রাপ্ত নম্বর (/{selectedExam.totalMarks})</th>
                        <th className="py-2 px-3">মন্তব্য</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students
                        .filter(
                          (s) => s.batchId === selectedExam.batchId && s.status === 'active'
                        )
                        .map((st) => (
                          <tr key={st.id}>
                            <td className="py-2 px-3 font-mono-num">{st.rollNo}</td>
                            <td className="py-2 px-3 font-medium">{st.name}</td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={0}
                                max={selectedExam.totalMarks}
                                value={marksDraft[st.id]?.marks ?? ''}
                                onChange={(e) =>
                                  setMarksDraft((prev) => ({
                                    ...prev,
                                    [st.id]: {
                                      ...prev[st.id],
                                      marks: e.target.value,
                                    },
                                  }))
                                }
                                className="w-24 px-2.5 py-1.5 border border-slate-300 rounded-md font-mono-num text-sm"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={marksDraft[st.id]?.remarks ?? ''}
                                onChange={(e) =>
                                  setMarksDraft((prev) => ({
                                    ...prev,
                                    [st.id]: {
                                      ...prev[st.id],
                                      remarks: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="মন্তব্য..."
                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
                              />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">মেধাক্রম</th>
                      <th className="py-2.5 px-4">রোল</th>
                      <th className="py-2.5 px-4">শিক্ষার্থী</th>
                      <th className="py-2.5 px-3 text-right">প্রাপ্ত নম্বর</th>
                      <th className="py-2.5 px-3 text-right">শতকরা</th>
                      <th className="py-2.5 px-4">ফলাফল</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedExam.results.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                          এখনো নম্বর এন্ট্রি করা হয়নি। উপরে "নম্বর এন্ট্রি / আপডেট" বাটনে ক্লিক করুন।
                        </td>
                      </tr>
                    ) : (
                      selectedExam.results.map((r) => (
                        <tr key={r.studentId} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono-num font-bold text-slate-800">
                            #{r.rank}
                          </td>
                          <td className="py-2.5 px-4 font-mono-num text-slate-600">{r.rollNo}</td>
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-slate-900">{r.studentName}</div>
                            {r.remarks && (
                              <div className="text-xs text-slate-500">{r.remarks}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-num font-semibold">
                            {r.obtainedMarks} / {selectedExam.totalMarks}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-num">
                            {r.percentage}%
                          </td>
                          <td className="py-2.5 px-4 text-xs font-semibold">
                            {r.passed ? (
                              <span className="text-emerald-700">উত্তীর্ণ</span>
                            ) : (
                              <span className="text-red-700">অনুত্তীর্ণ</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>

      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">নতুন পরীক্ষা যোগ করুন</h3>
              <button type="button" onClick={() => setShowNewModal(false)} className="cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateExam} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পরীক্ষার শিরোনাম *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="যেমন: মডেল টেস্ট — ০৫"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ব্যাচ *</label>
                <select
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">বিষয় *</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="পদার্থবিজ্ঞান"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">তারিখ</label>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">পূর্ণমান</label>
                  <input
                    type="number"
                    required
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">পাস নম্বর</label>
                  <input
                    type="number"
                    required
                    value={passMarks}
                    onChange={(e) => setPassMarks(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-lg cursor-pointer"
                >
                  তৈরি করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
