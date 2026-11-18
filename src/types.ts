export type AttendanceStatus = 'present' | 'absent' | 'late';
export type FeeStatus = 'paid' | 'pending' | 'overdue';
export type SmsType =
  | 'due_reminder_10th'
  | 'late_fine_15th'
  | 'cash_receipt'
  | 'admission_welcome'
  | 'absent_alert'
  | 'exam_result'
  | 'manual';

export interface AdminUser {
  username: string;
  displayName: string;
  role: 'admin';
}

export interface CoachingSettings {
  instituteName: string;
  instituteAddress: string;
  institutePhone: string;
  lateFineAmount: number;
  reminderDayOfMonth: number;
  fineDayOfMonth: number;
  smsEnabled: boolean;
  smsProviderMode: 'outbox' | 'webhook';
  smsWebhookUrl: string;
  smsApiKey: string;
  smsSenderId: string;
  lastAutomationRunAt: string | null;
}

export interface Batch {
  id: string;
  name: string;
  classLevel: string;
  subject: string;
  schedule: string;
  room: string;
  monthlyFee: number;
  teacherId: string;
  teacherName?: string;
  studentCount?: number;
  capacity: number;
  active: boolean;
  createdAt: string;
}

export interface StudentFeeRecordSummary {
  id: string;
  month: string;
  baseFee: number;
  fineAmount: number;
  discountAmount: number;
  paidAmount: number;
  receiptNo: string | null;
  paidAt: string | null;
  status: FeeStatus;
}

export interface StudentExamSummary {
  examId: string;
  title: string;
  subject: string;
  examDate: string;
  totalMarks: number;
  passMarks: number;
  obtainedMarks: number;
  percentage: number;
  remarks: string;
}

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  guardianName: string;
  phone: string;
  guardianPhone: string;
  batchId: string;
  batchName?: string;
  classLevel?: string;
  monthlyFee: number;
  admissionDate: string;
  address: string;
  status: 'active' | 'inactive';
  notes?: string;
  attendanceSummary?: {
    totalClasses: number;
    presentCount: number;
    absentCount: number;
    rate: number;
  };
  financialSummary?: {
    totalPaid: number;
    totalDue: number;
    records: StudentFeeRecordSummary[];
  };
  academicSummary?: {
    examsTaken: number;
    avgPercentage: number | null;
    exams: StudentExamSummary[];
  };
}

export interface AttendanceRecord {
  id: string;
  date: string;
  batchId: string;
  studentId: string;
  status: AttendanceStatus;
  recordedAt: string;
}

export interface FeeRow {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  guardianPhone: string;
  batchId: string;
  batchName: string;
  month: string;
  baseFee: number;
  fineAmount: number;
  discountAmount: number;
  paidAmount: number;
  netPayable: number;
  remainingDue: number;
  paymentMethod: 'cash' | null;
  receiptNo: string | null;
  paidAt: string | null;
  status: FeeStatus;
  reminderSentAt: string | null;
  fineAppliedAt: string | null;
  note?: string;
}

export interface ExamResultRow {
  studentId: string;
  studentName: string;
  rollNo: string;
  obtainedMarks: number;
  percentage: number;
  rank: number;
  passed: boolean;
  remarks?: string;
}

export interface Exam {
  id: string;
  title: string;
  batchId: string;
  batchName: string;
  subject: string;
  examDate: string;
  totalMarks: number;
  passMarks: number;
  results: ExamResultRow[];
  createdAt: string;
}

export interface Teacher {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  subject: string;
  qualification: string;
  baseSalary: number;
  perClassRate: number;
  joiningDate: string;
  active: boolean;
}

export interface TeacherClassLog {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherCode: string;
  batchId: string;
  batchName: string;
  subject: string;
  date: string;
  month: string;
  classesCount: number;
  durationHours: number;
  ratePerClass: number;
  totalEarned: number;
  topic: string;
  loggedBy: string;
  createdAt: string;
}

export interface TeacherSalaryRow {
  teacherId: string;
  code: string;
  name: string;
  phone: string;
  subject: string;
  qualification: string;
  active: boolean;
  month: string;
  baseSalary: number;
  perClassRate: number;
  classesConducted: number;
  totalHours: number;
  classEarnings: number;
  bonus: number;
  deduction: number;
  totalPayable: number;
  paidAmount: number;
  balanceDue: number;
  status: 'paid' | 'partial' | 'unpaid';
  receiptNo: string | null;
  paidAt: string | null;
  note: string;
  logs: Array<{
    id: string;
    date: string;
    batchName: string;
    subject: string;
    classesCount: number;
    durationHours: number;
    ratePerClass: number;
    totalEarned: number;
    topic: string;
  }>;
}

export interface TeacherSalaryReport {
  month: string;
  monthLabel: string;
  institute: {
    name: string;
    address: string;
    phone: string;
  };
  summary: {
    totalTeachers: number;
    grandTotalClasses: number;
    grandTotalPayable: number;
    grandTotalPaid: number;
    grandBalanceDue: number;
  };
  teachers: TeacherSalaryRow[];
}

export interface SmsLog {
  id: string;
  recipientName: string;
  phone: string;
  message: string;
  type: SmsType;
  status: 'delivered' | 'queued' | 'failed';
  gatewayResponse: string;
  month?: string;
  createdAt: string;
}

export interface DashboardData {
  month: string;
  monthLabel: string;
  settings: CoachingSettings;
  kpis: {
    totalStudents: number;
    totalBatches: number;
    totalTeachers: number;
    totalCollectedCash: number;
    totalExpectedFee: number;
    totalPendingDue: number;
    paidCount: number;
    unpaidCount: number;
    overdueCount: number;
    todayAttendanceCount: number;
    todayPresent: number;
    todayAbsent: number;
    totalClassesConducted: number;
    totalTeacherSalaryPayable: number;
    smsSentCount: number;
  };
  recentFees: Array<FeeRow & { studentName: string; rollNo: string }>;
  recentSms: SmsLog[];
  teacherSummary: Array<{
    teacherId: string;
    name: string;
    subject: string;
    classesConducted: number;
    classEarnings: number;
    baseSalary: number;
    totalPayable: number;
    status: string;
  }>;
}
