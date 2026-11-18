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

export interface Batch {
  id: string;
  name: string;
  classLevel: string;
  subject: string;
  schedule: string;
  room: string;
  monthlyFee: number;
  teacherId: string;
  capacity: number;
  active: boolean;
  createdAt: string;
}

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  guardianName: string;
  phone: string;
  guardianPhone: string;
  batchId: string;
  monthlyFee: number;
  admissionDate: string;
  address: string;
  status: 'active' | 'inactive';
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  batchId: string;
  studentId: string;
  status: AttendanceStatus;
  recordedAt: string;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  batchId: string;
  month: string; // YYYY-MM
  baseFee: number;
  fineAmount: number;
  discountAmount: number;
  paidAmount: number;
  paymentMethod: 'cash' | null;
  receiptNo: string | null;
  paidAt: string | null;
  status: FeeStatus;
  reminderSentAt: string | null;
  fineAppliedAt: string | null;
  note?: string;
}

export interface ExamResultEntry {
  studentId: string;
  obtainedMarks: number;
  remarks?: string;
}

export interface Exam {
  id: string;
  title: string;
  batchId: string;
  subject: string;
  examDate: string; // YYYY-MM-DD
  totalMarks: number;
  passMarks: number;
  results: ExamResultEntry[];
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
  batchId: string;
  subject: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  classesCount: number;
  durationHours: number;
  ratePerClass: number;
  totalEarned: number;
  topic: string;
  loggedBy: string;
  createdAt: string;
}

export interface TeacherSalaryPayout {
  id: string;
  teacherId: string;
  month: string; // YYYY-MM
  baseSalary: number;
  classesCount: number;
  classEarnings: number;
  bonus: number;
  deduction: number;
  totalPayable: number;
  paidAmount: number;
  paymentMethod: 'cash' | null;
  paidAt: string | null;
  receiptNo: string | null;
  note?: string;
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

export interface CoachingSettings {
  instituteName: string;
  instituteAddress: string;
  institutePhone: string;
  lateFineAmount: number;
  reminderDayOfMonth: number; // default 10
  fineDayOfMonth: number; // default 15
  smsEnabled: boolean;
  smsProviderMode: 'outbox' | 'webhook';
  smsWebhookUrl: string;
  smsApiKey: string;
  smsSenderId: string;
  lastAutomationRunAt: string | null;
}

export interface CoachingDatabase {
  settings: CoachingSettings;
  batches: Batch[];
  students: Student[];
  attendance: AttendanceRecord[];
  fees: FeeRecord[];
  exams: Exam[];
  teachers: Teacher[];
  classLogs: TeacherClassLog[];
  salaryPayouts: TeacherSalaryPayout[];
  smsLogs: SmsLog[];
}
