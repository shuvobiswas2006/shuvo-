import React, { useState } from 'react';
import {
  ArrowRight,
  Banknote,
  BookOpenCheck,
  CalendarCheck,
  MessageSquare,
  Play,
  Share2,
  UserPlus,
  Users,
} from 'lucide-react';
import { apiRequest, formatBDT, getWhatsAppUrl } from '../api';
import type { DashboardData } from '../types';

export type NavSection =
  | 'dashboard'
  | 'students'
  | 'batches'
  | 'attendance'
  | 'fees'
  | 'exams'
  | 'teachers'
  | 'salary-report'
  | 'sms';

interface DashboardOverviewProps {
  data: DashboardData | null;
  loading: boolean;
  month: string;
  onNavigate: (section: NavSection) => void;
  onRefresh: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  data,
  loading,
  month,
  onNavigate,
  onRefresh,
}) => {
  const [simDay, setSimDay] = useState<string>(String(new Date().getDate()));
  const [runningAuto, setRunningAuto] = useState(false);
  const [autoMsg, setAutoMsg] = useState<string>('');

  const handleRunAutomation = async (dayOverride?: number) => {
    setRunningAuto(true);
    setAutoMsg('');
    try {
      const res = await apiRequest<{
        evaluatedDay: number;
        remindersSent: number;
        finesApplied: number;
        totalFineAdded: number;
      }>('/api/automation/run', {
        method: 'POST',
        body: JSON.stringify({
          month,
          simulatedDay: dayOverride ?? Number(simDay),
        }),
      });
      setAutoMsg(
        `${res.evaluatedDay} তারিখ হিসেবে চেক সম্পন্ন: ${res.remindersSent}টি বকেয়া SMS পাঠানো হয়েছে এবং ${res.finesApplied} জন শিক্ষার্থীর ফির সাথে মোট ${formatBDT(res.totalFineAdded)} জরিমানা যুক্ত হয়েছে।`
      );
      onRefresh();
    } catch (err) {
      setAutoMsg(err instanceof Error ? err.message : 'অটোমেশন চালানো যায়নি।');
    } finally {
      setRunningAuto(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 bg-white border border-slate-200 rounded-lg animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 bg-white border border-slate-200 rounded-lg animate-pulse" />
      </div>
    );
  }

  const { kpis } = data;
  const collectionPercent =
    kpis.totalExpectedFee > 0
      ? Math.round((kpis.totalCollectedCash / kpis.totalExpectedFee) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Quick Action Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            দৈনন্দিন দ্রুত কাজ ({data.monthLabel})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            এক ক্লিকে শিক্ষার্থী ভর্তি, উপস্থিতি, ক্যাশ ফি গ্রহণ অথবা শিক্ষকের ক্লাস লগ করুন
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('students')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>নতুন ভর্তি</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('attendance')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>উপস্থিতি নিন</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('fees')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>ক্যাশ ফি গ্রহণ</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('teachers')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <BookOpenCheck className="w-3.5 h-3.5" />
            <span>শিক্ষক ক্লাস লগ</span>
          </button>
          <a
            href={getWhatsAppUrl(
              `ঘাসফুল স্টাডি পয়েন্ট — কোচিং ম্যানেজমেন্ট ওয়েবসাইট:\n${typeof window !== 'undefined' ? window.location.origin : ''}`
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>WhatsApp-এ ওয়েবসাইট পাঠান</span>
          </a>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>সক্রিয় শিক্ষার্থী</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono-num">
              {kpis.totalStudents}
            </span>
            <span className="text-xs text-slate-500">জন</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {kpis.totalBatches}টি চলমান ব্যাচ · {kpis.totalTeachers} জন শিক্ষক
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>নগদ ক্যাশ ফি আদায়</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono-num">
              {formatBDT(kpis.totalCollectedCash)}
            </span>
            <span className="text-xs text-emerald-700 font-medium font-mono-num">
              ({collectionPercent}%)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono-num">
            বকেয়া: <span className="text-amber-700 font-medium">{formatBDT(kpis.totalPendingDue)}</span> · {kpis.overdueCount} জরিমানাযুক্ত
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>আজকের উপস্থিতি</span>
            <CalendarCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono-num">
              {kpis.todayPresent}
            </span>
            <span className="text-xs text-slate-500 font-mono-num">
              / {kpis.todayAttendanceCount || kpis.totalStudents} জন
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono-num">
            অনুপস্থিত: <span className="text-red-700 font-medium">{kpis.todayAbsent}</span> জন
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>শিক্ষকদের প্রদেয় বেতন</span>
            <BookOpenCheck className="w-4 h-4 text-teal-700" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono-num">
              {formatBDT(kpis.totalTeacherSalaryPayable)}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono-num">
            মোট ক্লাস: {kpis.totalClassesConducted}টি · SMS: {kpis.smsSentCount}টি
          </div>
        </div>
      </div>

      {/* Automated 10th & 15th Rule Engine Control */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">
              স্বয়ংক্রিয় ফি রিমাইন্ডার (১০ তারিখ) ও বিলম্ব জরিমানা (১৫ তারিখ) ইঞ্জিন
            </h3>
            <p className="text-xs text-slate-600">
              মাসের {data.settings.reminderDayOfMonth} তারিখের মধ্যে ক্যাশ ফি পরিশোধ না হলে স্বয়ংক্রিয় SMS যাবে এবং {data.settings.fineDayOfMonth} তারিখের পর বকেয়া থাকলে {formatBDT(data.settings.lateFineAmount)} জরিমানা যোগ হবে। পরীক্ষামূলকভাবে তারিখ সিলেক্ট করে যাচাই করতে পারেন।
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-600 flex items-center gap-2">
              <span>তারিখ পরীক্ষা:</span>
              <select
                value={simDay}
                onChange={(e) => setSimDay(e.target.value)}
                className="border border-slate-300 rounded-md px-2.5 py-1.5 text-xs bg-white text-slate-900 font-mono-num"
              >
                <option value="5">০৫ তারিখ (স্বাভাবিক)</option>
                <option value="10">১০ তারিখ (SMS রিমাইন্ডার)</option>
                <option value="15">১৫ তারিখ (জরিমানা + SMS)</option>
                <option value="18">১৮ তারিখ (বর্তমান দিন)</option>
              </select>
            </label>
            <button
              type="button"
              disabled={runningAuto}
              onClick={() => handleRunAutomation()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-md transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{runningAuto ? 'চলছে...' : 'অটোমেশন চেক চালান'}</span>
            </button>
          </div>
        </div>

        {autoMsg && (
          <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-800">
            {autoMsg}
          </div>
        )}
      </div>

      {/* 2-Column Activity Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teacher Monthly Salary Snapshot */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                শিক্ষকদের চলতি মাসের ক্লাস ও বেতন সারসংক্ষেপ
              </h3>
              <p className="text-xs text-slate-500">মূল বেতন + গৃহীত ক্লাস সম্মানী</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('salary-report')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:text-teal-950 cursor-pointer whitespace-nowrap"
            >
              <span>পূর্ণ রিপোর্ট</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">শিক্ষক</th>
                  <th className="py-2.5 px-3 text-right">ক্লাস</th>
                  <th className="py-2.5 px-4 text-right">মোট প্রদেয়</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {data.teacherSummary.map((t) => (
                  <tr key={t.teacherId} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.subject}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                      {t.classesConducted}টি
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-slate-900">
                      {formatBDT(t.totalPayable)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent SMS Notifications */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                সাম্প্রতিক অটোমেটেড এসএমএস লগ
              </h3>
              <p className="text-xs text-slate-500">বকেয়া, জরিমানা, রসিদ ও উপস্থিতি বার্তা</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('sms')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:text-teal-950 cursor-pointer whitespace-nowrap"
            >
              <span>সব SMS দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentSms.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                এখনো কোনো এসএমএস পাঠানো হয়নি।
              </div>
            ) : (
              data.recentSms.map((sms) => (
                <div key={sms.id} className="px-5 py-3 flex items-start gap-3">
                  <MessageSquare className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900 truncate">
                        {sms.recipientName}
                      </span>
                      <span className="font-mono-num text-slate-500 shrink-0">
                        {sms.phone}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                      {sms.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
