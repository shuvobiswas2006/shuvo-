import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Banknote,
  BookOpenCheck,
  CalendarCheck,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  X,
} from 'lucide-react';
import {
  apiRequest,
  clearAuthToken,
  formatBengaliMonth,
  getAuthToken,
  getCurrentMonthStr,
} from './api';
import { AttendanceModule } from './components/AttendanceModule';
import { BatchesModule } from './components/BatchesModule';
import { DashboardOverview, type NavSection } from './components/DashboardOverview';
import { ExamsModule } from './components/ExamsModule';
import { FeesModule } from './components/FeesModule';
import { LoginPage } from './components/LoginPage';
import { SalaryReportModule } from './components/SalaryReportModule';
import { SmsModule } from './components/SmsModule';
import { StudentsModule } from './components/StudentsModule';
import { TeachersAndClassLogModule } from './components/TeachersAndClassLogModule';
import type {
  AdminUser,
  Batch,
  CoachingSettings,
  DashboardData,
  Exam,
  FeeRow,
  SmsLog,
  Student,
  Teacher,
  TeacherClassLog,
  TeacherSalaryReport,
} from './types';

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
  { id: 'students', label: 'শিক্ষার্থী ও ভর্তি', icon: GraduationCap },
  { id: 'batches', label: 'ক্লাস ও ব্যাচ', icon: Layers },
  { id: 'attendance', label: 'উপস্থিতি ট্র্যাকার', icon: CalendarCheck },
  { id: 'fees', label: 'ক্যাশ ফি ও জরিমানা', icon: Banknote },
  { id: 'exams', label: 'পরীক্ষার রেজাল্ট', icon: Award },
  { id: 'teachers', label: 'শিক্ষক ও ক্লাস লগ', icon: BookOpenCheck },
  { id: 'salary-report', label: 'মাসিক বেতন রিপোর্ট', icon: FileSpreadsheet },
  { id: 'sms', label: 'এসএমএস ও অটোমেশন', icon: MessageSquare },
];

export default function App() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [month, setMonth] = useState<string>(getCurrentMonthStr());
  const [avatarError, setAvatarError] = useState(false);

  // Domain Data
  const [loadingData, setLoadingData] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classLogs, setClassLogs] = useState<TeacherClassLog[]>([]);
  const [salaryReport, setSalaryReport] = useState<TeacherSalaryReport | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [settings, setSettings] = useState<CoachingSettings | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    apiRequest<{ valid: boolean; admin: AdminUser }>('/api/auth/verify')
      .then((res) => {
        if (res.valid) setAdmin(res.admin);
      })
      .catch(() => {
        clearAuthToken();
        setAdmin(null);
      })
      .finally(() => setAuthChecking(false));
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setAdmin(null);
    };
    window.addEventListener('ghasphul:unauthorized', handleUnauthorized);
    return () =>
      window.removeEventListener('ghasphul:unauthorized', handleUnauthorized);
  }, []);

  const loadAllData = useCallback(async () => {
    if (!admin) return;
    setLoadingData(true);
    try {
      const [
        dashRes,
        batchesRes,
        studentsRes,
        feesRes,
        examsRes,
        teachersRes,
        logsRes,
        salaryRes,
        smsRes,
      ] = await Promise.all([
        apiRequest<DashboardData>(`/api/dashboard?month=${month}`),
        apiRequest<Batch[]>('/api/batches'),
        apiRequest<Student[]>('/api/students'),
        apiRequest<FeeRow[]>(`/api/fees?month=${month}`),
        apiRequest<Exam[]>('/api/exams'),
        apiRequest<Teacher[]>('/api/teachers'),
        apiRequest<TeacherClassLog[]>(`/api/class-logs?month=${month}`),
        apiRequest<TeacherSalaryReport>(`/api/reports/teacher-salary?month=${month}`),
        apiRequest<{ settings: CoachingSettings; logs: SmsLog[] }>('/api/sms'),
      ]);

      setDashboard(dashRes);
      setBatches(batchesRes);
      setStudents(studentsRes);
      setFees(feesRes);
      setExams(examsRes);
      setTeachers(teachersRes);
      setClassLogs(logsRes);
      setSalaryReport(salaryRes);
      setSmsLogs(smsRes.logs);
      setSettings(smsRes.settings);
    } catch (err) {
      console.error('Data load error:', err);
    } finally {
      setLoadingData(false);
    }
  }, [admin, month]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleLogout = () => {
    clearAuthToken();
    setAdmin(null);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        অ্যাডমিন সেশন যাচাই করা হচ্ছে...
      </div>
    );
  }

  if (!admin) {
    return <LoginPage onLoginSuccess={(user) => setAdmin(user)} />;
  }

  const currentNav = NAV_ITEMS.find((n) => n.id === activeSection);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 no-print">
        <div className="h-16 px-5 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center font-bold shrink-0">
            ঘা
          </div>
          <span className="font-bold text-slate-900 truncate">
            ঘাসফুল স্টাডি পয়েন্ট
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-teal-800 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {!avatarError ? (
              <img
                src="/src/assets/images/admin_profile_avatar_1795019965643.jpg"
                alt="অ্যাডমিন প্রোফাইল"
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
                অ্যা
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {admin.displayName}
              </div>
              <div className="text-[11px] text-slate-500 font-mono-num truncate">
                @{admin.username}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="লগআউট"
            className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-full bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900">ঘাসফুল স্টাডি পয়েন্ট</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg cursor-pointer ${
                      active
                        ? 'bg-teal-800 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-red-700 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>লগআউট করুন</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 cursor-pointer"
              aria-label="মেনু খুলুন"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                অ্যাডমিন প্যানেল
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-bold text-slate-900 truncate">
                {currentNav?.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline text-xs text-slate-500 whitespace-nowrap">
              {formatBengaliMonth(month)}
            </span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="মাস নির্বাচন"
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono-num bg-white text-slate-800"
            />
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {activeSection === 'dashboard' && (
            <DashboardOverview
              data={dashboard}
              loading={loadingData && !dashboard}
              month={month}
              onNavigate={setActiveSection}
              onRefresh={loadAllData}
            />
          )}

          {activeSection === 'students' && (
            <StudentsModule
              students={students}
              batches={batches}
              onRefresh={loadAllData}
            />
          )}

          {activeSection === 'batches' && (
            <BatchesModule
              batches={batches}
              teachers={teachers}
              onRefresh={loadAllData}
            />
          )}

          {activeSection === 'attendance' && (
            <AttendanceModule
              batches={batches}
              students={students}
              onRefresh={loadAllData}
            />
          )}

          {activeSection === 'fees' && (
            <FeesModule
              month={month}
              onMonthChange={setMonth}
              fees={fees}
              settings={settings}
              onRefresh={loadAllData}
            />
          )}

          {activeSection === 'exams' && (
            <ExamsModule
              exams={exams}
              batches={batches}
              students={students}
              onRefresh={loadAllData}
            />
          )}

          {activeSection === 'teachers' && (
            <TeachersAndClassLogModule
              month={month}
              onMonthChange={setMonth}
              teachers={teachers}
              batches={batches}
              classLogs={classLogs}
              onRefresh={loadAllData}
            />
          )}

          {activeSection === 'salary-report' && (
            <SalaryReportModule
              month={month}
              onMonthChange={setMonth}
              report={salaryReport}
              onRefresh={loadAllData}
            />
          )}

          {activeSection === 'sms' && (
            <SmsModule
              logs={smsLogs}
              settings={settings}
              batches={batches}
              onRefresh={loadAllData}
            />
          )}
        </main>
      </div>
    </div>
  );
}
