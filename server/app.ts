import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import { loadDatabase, saveDatabase } from './db.ts';
import {
  dispatchSms,
  ensureFeeRecordsForMonth,
  formatBengaliMonth,
  runFeeAutomationRules,
} from './automation.ts';
import type {
  Batch,
  CoachingDatabase,
  Exam,
  Student,
  Teacher,
  TeacherClassLog,
  TeacherSalaryPayout,
} from './types.ts';

const ADMIN_USERNAME = process.env.COACHING_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.COACHING_ADMIN_PASS || 'admin123';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}:ghasphul`).digest('hex');

interface SessionPayload {
  username: string;
  role: 'admin';
  exp: number;
}

function signToken(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string): SessionPayload | null {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(body)
      .digest('base64url');
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf-8')
    ) as SessionPayload;
    if (parsed.exp < Date.now() || parsed.role !== 'admin') return null;
    return parsed;
  } catch {
    return null;
  }
}

function getCurrentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function calculateTeacherMonthlyReport(db: CoachingDatabase, month: string) {
  return db.teachers.map((teacher) => {
    const logs = db.classLogs
      .filter((c) => c.teacherId === teacher.id && c.month === month)
      .sort((a, b) => a.date.localeCompare(b.date));

    const classesConducted = logs.reduce((acc, item) => acc + item.classesCount, 0);
    const totalHours = logs.reduce((acc, item) => acc + item.durationHours, 0);
    const classEarnings = logs.reduce((acc, item) => acc + item.totalEarned, 0);

    const payout = db.salaryPayouts.find(
      (p) => p.teacherId === teacher.id && p.month === month
    );
    const baseSalary = teacher.active ? teacher.baseSalary : 0;
    const bonus = payout?.bonus || 0;
    const deduction = payout?.deduction || 0;
    const totalPayable = Math.max(0, baseSalary + classEarnings + bonus - deduction);
    const paidAmount = payout?.paidAmount || 0;
    const balanceDue = Math.max(0, totalPayable - paidAmount);

    return {
      teacherId: teacher.id,
      code: teacher.code,
      name: teacher.name,
      phone: teacher.phone,
      subject: teacher.subject,
      qualification: teacher.qualification,
      active: teacher.active,
      month,
      baseSalary,
      perClassRate: teacher.perClassRate,
      classesConducted,
      totalHours: Number(totalHours.toFixed(1)),
      classEarnings,
      bonus,
      deduction,
      totalPayable,
      paidAmount,
      balanceDue,
      status: balanceDue === 0 && totalPayable > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
      receiptNo: payout?.receiptNo || null,
      paidAt: payout?.paidAt || null,
      note: payout?.note || '',
      logs: logs.map((l) => {
        const batch = db.batches.find((b) => b.id === l.batchId);
        return {
          ...l,
          batchName: batch?.name || 'অজানা ব্যাচ',
        };
      }),
    };
  });
}


export async function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Run initial automation rule evaluation once on app boot
  const db = loadDatabase();
  await runFeeAutomationRules(db);
  saveDatabase(db);

  // Public auth endpoints
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };
    const inputUser = String(username || '').trim().toLowerCase();
    const inputPass = String(password || '').trim();
    const expectedUser = ADMIN_USERNAME.trim().toLowerCase();
    const expectedPass = ADMIN_PASSWORD.trim();
    const isUsingDefaultDemoPass = !process.env.COACHING_ADMIN_PASS;
    const passwordMatches =
      inputPass === expectedPass ||
      (isUsingDefaultDemoPass && inputPass.toLowerCase() === expectedPass.toLowerCase());

    if (inputUser === expectedUser && passwordMatches) {
      const token = signToken({
        username: ADMIN_USERNAME,
        role: 'admin',
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
      res.json({
        token,
        admin: {
          username: ADMIN_USERNAME,
          displayName: 'অ্যাডমিন পরিচালক',
          role: 'admin',
        },
      });
      return;
    }
    res.status(401).json({
      error: 'ভুল ইউজারনেম অথবা পাসওয়ার্ড। সঠিক তথ্য দিন (ডেমো: admin / admin123)।',
    });
  });

  app.get('/api/auth/verify', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ valid: false });
      return;
    }
    res.json({
      valid: true,
      admin: {
        username: payload.username,
        displayName: 'অ্যাডমিন পরিচালক',
        role: 'admin',
      },
    });
  });

  // Protect all remaining /api/* routes (Admin-only control)
  app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path.startsWith('/auth/')) {
      next();
      return;
    }
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: 'অননুমোদিত প্রবেশ। অনুগ্রহ করে অ্যাডমিন লগইন করুন।' });
      return;
    }
    next();
  });

  // Dashboard Overview
  app.get('/api/dashboard', (req, res) => {
    const month = String(req.query.month || getCurrentMonthStr());
    const db = loadDatabase();
    ensureFeeRecordsForMonth(db, month);
    saveDatabase(db);

    const activeStudents = db.students.filter((s) => s.status === 'active');
    const monthFees = db.fees.filter((f) => f.month === month);
    const totalExpectedFee = monthFees.reduce(
      (sum, f) => sum + Math.max(0, f.baseFee + f.fineAmount - f.discountAmount),
      0
    );
    const totalCollectedCash = monthFees.reduce((sum, f) => sum + f.paidAmount, 0);
    const totalPendingDue = Math.max(0, totalExpectedFee - totalCollectedCash);
    const overdueCount = monthFees.filter(
      (f) => f.status === 'overdue' || f.fineAmount > 0
    ).length;
    const paidCount = monthFees.filter((f) => f.status === 'paid').length;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayAttendance = db.attendance.filter((a) => a.date === todayStr);
    const todayPresent = todayAttendance.filter((a) => a.status === 'present').length;
    const todayAbsent = todayAttendance.filter((a) => a.status === 'absent').length;

    const teacherSalaryReport = calculateTeacherMonthlyReport(db, month);
    const totalTeacherSalaryPayable = teacherSalaryReport.reduce(
      (sum, t) => sum + t.totalPayable,
      0
    );
    const totalClassesConducted = teacherSalaryReport.reduce(
      (sum, t) => sum + t.classesConducted,
      0
    );

    res.json({
      month,
      monthLabel: formatBengaliMonth(month),
      settings: db.settings,
      kpis: {
        totalStudents: activeStudents.length,
        totalBatches: db.batches.filter((b) => b.active).length,
        totalTeachers: db.teachers.filter((t) => t.active).length,
        totalCollectedCash,
        totalExpectedFee,
        totalPendingDue,
        paidCount,
        unpaidCount: monthFees.length - paidCount,
        overdueCount,
        todayAttendanceCount: todayAttendance.length,
        todayPresent,
        todayAbsent,
        totalClassesConducted,
        totalTeacherSalaryPayable,
        smsSentCount: db.smsLogs.filter((s) => s.status === 'delivered').length,
      },
      recentFees: monthFees
        .filter((f) => f.paidAt)
        .sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''))
        .slice(0, 5)
        .map((f) => {
          const st = db.students.find((s) => s.id === f.studentId);
          return {
            ...f,
            studentName: st?.name || 'অজানা',
            rollNo: st?.rollNo || '',
          };
        }),
      recentSms: db.smsLogs.slice(0, 6),
      teacherSummary: teacherSalaryReport.map((t) => ({
        teacherId: t.teacherId,
        name: t.name,
        subject: t.subject,
        classesConducted: t.classesConducted,
        classEarnings: t.classEarnings,
        baseSalary: t.baseSalary,
        totalPayable: t.totalPayable,
        status: t.status,
      })),
    });
  });

  // Batches CRUD
  app.get('/api/batches', (_req, res) => {
    const db = loadDatabase();
    const batchesWithCounts = db.batches.map((b) => {
      const studentCount = db.students.filter(
        (s) => s.batchId === b.id && s.status === 'active'
      ).length;
      const teacher = db.teachers.find((t) => t.id === b.teacherId);
      return {
        ...b,
        studentCount,
        teacherName: teacher?.name || 'নির্ধারিত নয়',
      };
    });
    res.json(batchesWithCounts);
  });

  app.post('/api/batches', (req, res) => {
    const db = loadDatabase();
    const body = req.body as Partial<Batch>;
    if (!body.name || !body.classLevel) {
      res.status(400).json({ error: 'ব্যাচের নাম ও শ্রেণি উল্লেখ করুন।' });
      return;
    }
    const newBatch: Batch = {
      id: `bat-${crypto.randomUUID().slice(0, 6)}`,
      name: String(body.name).trim(),
      classLevel: String(body.classLevel).trim(),
      subject: String(body.subject || 'সকল বিষয়').trim(),
      schedule: String(body.schedule || 'নির্ধারিত সময়').trim(),
      room: String(body.room || 'রুম ১০১').trim(),
      monthlyFee: Number(body.monthlyFee || 2000),
      teacherId: String(body.teacherId || ''),
      capacity: Number(body.capacity || 30),
      active: body.active !== false,
      createdAt: new Date().toISOString(),
    };
    db.batches.push(newBatch);
    saveDatabase(db);
    res.status(201).json(newBatch);
  });

  app.put('/api/batches/:id', (req, res) => {
    const db = loadDatabase();
    const idx = db.batches.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'ব্যাচ পাওয়া যায়নি।' });
      return;
    }
    const body = req.body as Partial<Batch>;
    db.batches[idx] = {
      ...db.batches[idx],
      ...body,
      monthlyFee:
        body.monthlyFee !== undefined
          ? Number(body.monthlyFee)
          : db.batches[idx].monthlyFee,
      capacity:
        body.capacity !== undefined
          ? Number(body.capacity)
          : db.batches[idx].capacity,
    };
    saveDatabase(db);
    res.json(db.batches[idx]);
  });

  app.delete('/api/batches/:id', (req, res) => {
    const db = loadDatabase();
    db.batches = db.batches.filter((b) => b.id !== req.params.id);
    saveDatabase(db);
    res.json({ ok: true });
  });

  // Students CRUD + 360 Overview
  app.get('/api/students', (_req, res) => {
    const db = loadDatabase();
    const enriched = db.students.map((st) => {
      const batch = db.batches.find((b) => b.id === st.batchId);
      const stAttendance = db.attendance.filter((a) => a.studentId === st.id);
      const presentCount = stAttendance.filter(
        (a) => a.status === 'present' || a.status === 'late'
      ).length;
      const attendanceRate =
        stAttendance.length > 0
          ? Math.round((presentCount / stAttendance.length) * 100)
          : 100;

      const stFees = db.fees.filter((f) => f.studentId === st.id);
      const totalDue = stFees.reduce(
        (sum, f) =>
          sum + Math.max(0, f.baseFee + f.fineAmount - f.discountAmount - f.paidAmount),
        0
      );
      const totalPaid = stFees.reduce((sum, f) => sum + f.paidAmount, 0);

      const stExams = db.exams
        .filter((e) => e.results.some((r) => r.studentId === st.id))
        .map((e) => {
          const entry = e.results.find((r) => r.studentId === st.id)!;
          return {
            examId: e.id,
            title: e.title,
            subject: e.subject,
            examDate: e.examDate,
            totalMarks: e.totalMarks,
            passMarks: e.passMarks,
            obtainedMarks: entry.obtainedMarks,
            percentage: Math.round((entry.obtainedMarks / e.totalMarks) * 100),
            remarks: entry.remarks || '',
          };
        });
      const avgExamScore =
        stExams.length > 0
          ? Math.round(
              stExams.reduce((sum, ex) => sum + ex.percentage, 0) / stExams.length
            )
          : null;

      return {
        ...st,
        batchName: batch?.name || 'নির্ধারিত নয়',
        classLevel: batch?.classLevel || '',
        attendanceSummary: {
          totalClasses: stAttendance.length,
          presentCount,
          absentCount: stAttendance.filter((a) => a.status === 'absent').length,
          rate: attendanceRate,
        },
        financialSummary: {
          totalPaid,
          totalDue,
          records: stFees,
        },
        academicSummary: {
          examsTaken: stExams.length,
          avgPercentage: avgExamScore,
          exams: stExams,
        },
      };
    });
    res.json(enriched);
  });

  app.post('/api/students', async (req, res) => {
    const db = loadDatabase();
    const body = req.body as Partial<Student> & { sendWelcomeSms?: boolean };
    if (!body.name || !body.phone || !body.batchId) {
      res
        .status(400)
        .json({ error: 'শিক্ষার্থীর নাম, মোবাইল নম্বর এবং ব্যাচ নির্বাচন আবশ্যক।' });
      return;
    }

    const batch = db.batches.find((b) => b.id === body.batchId);
    const nextNum = 2601 + db.students.length;
    const rollNo = body.rollNo?.trim() || `BP-${nextNum}`;

    const student: Student = {
      id: `stu-${crypto.randomUUID().slice(0, 6)}`,
      rollNo,
      name: String(body.name).trim(),
      guardianName: String(body.guardianName || 'অভিভাবক').trim(),
      phone: String(body.phone).trim(),
      guardianPhone: String(body.guardianPhone || body.phone).trim(),
      batchId: body.batchId,
      monthlyFee: Number(body.monthlyFee ?? batch?.monthlyFee ?? 2000),
      admissionDate:
        body.admissionDate || new Date().toISOString().slice(0, 10),
      address: String(body.address || '').trim(),
      status: 'active',
      notes: body.notes ? String(body.notes).trim() : '',
    };

    db.students.unshift(student);
    const currentMonth = getCurrentMonthStr();
    ensureFeeRecordsForMonth(db, currentMonth);

    if (body.sendWelcomeSms !== false) {
      await dispatchSms(db, {
        recipientName: `${student.name} (${student.guardianName})`,
        phone: student.guardianPhone,
        message: `${db.settings.instituteName}: অভিনন্দন! ${student.name} (রোল: ${student.rollNo}) সফলভাবে "${batch?.name || 'নির্ধারিত ব্যাচ'}"-এ ভর্তি হয়েছে। মাসিক ফি: ৳${student.monthlyFee}।`,
        type: 'admission_welcome',
        month: currentMonth,
      });
    }

    saveDatabase(db);
    res.status(201).json(student);
  });

  app.put('/api/students/:id', (req, res) => {
    const db = loadDatabase();
    const idx = db.students.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'শিক্ষার্থী পাওয়া যায়নি।' });
      return;
    }
    const body = req.body as Partial<Student>;
    db.students[idx] = {
      ...db.students[idx],
      ...body,
      monthlyFee:
        body.monthlyFee !== undefined
          ? Number(body.monthlyFee)
          : db.students[idx].monthlyFee,
    };
    saveDatabase(db);
    res.json(db.students[idx]);
  });

  app.delete('/api/students/:id', (req, res) => {
    const db = loadDatabase();
    db.students = db.students.filter((s) => s.id !== req.params.id);
    saveDatabase(db);
    res.json({ ok: true });
  });

  // Attendance
  app.get('/api/attendance', (req, res) => {
    const db = loadDatabase();
    const date = req.query.date ? String(req.query.date) : null;
    const batchId = req.query.batchId ? String(req.query.batchId) : null;

    let records = db.attendance;
    if (date) records = records.filter((a) => a.date === date);
    if (batchId && batchId !== 'all') {
      records = records.filter((a) => a.batchId === batchId);
    }

    res.json(records);
  });

  app.post('/api/attendance', async (req, res) => {
    const db = loadDatabase();
    const { date, batchId, entries, sendAbsentSms } = req.body as {
      date: string;
      batchId: string;
      entries: Array<{ studentId: string; status: 'present' | 'absent' | 'late' }>;
      sendAbsentSms?: boolean;
    };

    if (!date || !batchId || !Array.isArray(entries)) {
      res.status(400).json({ error: 'তারিখ, ব্যাচ এবং উপস্থিতির তথ্য দিন।' });
      return;
    }

    // Remove existing records for same date & batch
    db.attendance = db.attendance.filter(
      (a) => !(a.date === date && a.batchId === batchId)
    );

    const now = new Date().toISOString();
    let absentSmsCount = 0;

    for (const entry of entries) {
      db.attendance.push({
        id: `att-${crypto.randomUUID().slice(0, 6)}`,
        date,
        batchId,
        studentId: entry.studentId,
        status: entry.status,
        recordedAt: now,
      });

      if (sendAbsentSms && entry.status === 'absent') {
        const student = db.students.find((s) => s.id === entry.studentId);
        const batch = db.batches.find((b) => b.id === batchId);
        if (student) {
          await dispatchSms(db, {
            recipientName: `${student.name} (${student.guardianName})`,
            phone: student.guardianPhone || student.phone,
            message: `${db.settings.instituteName}: সম্মানিত অভিভাবক, আজ ${date} তারিখে ${student.name} (${batch?.name || 'ক্লাস'})-এ অনুপস্থিত রয়েছে।`,
            type: 'absent_alert',
          });
          absentSmsCount += 1;
        }
      }
    }

    saveDatabase(db);
    res.json({ ok: true, saved: entries.length, absentSmsCount });
  });

  // Cash Fees & Automated 10th / 15th Rules
  app.get('/api/fees', (req, res) => {
    const month = String(req.query.month || getCurrentMonthStr());
    const db = loadDatabase();
    ensureFeeRecordsForMonth(db, month);
    saveDatabase(db);

    const list = db.fees
      .filter((f) => f.month === month)
      .map((f) => {
        const student = db.students.find((s) => s.id === f.studentId);
        const batch = db.batches.find((b) => b.id === f.batchId);
        const totalDue = Math.max(
          0,
          f.baseFee + f.fineAmount - f.discountAmount - f.paidAmount
        );
        return {
          ...f,
          studentName: student?.name || 'অজানা শিক্ষার্থী',
          rollNo: student?.rollNo || '-',
          guardianPhone: student?.guardianPhone || student?.phone || '-',
          batchName: batch?.name || '-',
          netPayable: Math.max(0, f.baseFee + f.fineAmount - f.discountAmount),
          remainingDue: totalDue,
        };
      });

    res.json(list);
  });

  app.post('/api/fees/:id/pay', async (req, res) => {
    const db = loadDatabase();
    const fee = db.fees.find((f) => f.id === req.params.id);
    if (!fee) {
      res.status(404).json({ error: 'ফি রেকর্ড পাওয়া যায়নি।' });
      return;
    }

    const { amount, discountAmount, note, sendReceiptSms } = req.body as {
      amount?: number;
      discountAmount?: number;
      note?: string;
      sendReceiptSms?: boolean;
    };

    if (discountAmount !== undefined) {
      fee.discountAmount = Math.max(0, Number(discountAmount));
    }

    const totalPayable = Math.max(0, fee.baseFee + fee.fineAmount - fee.discountAmount);
    const remaining = Math.max(0, totalPayable - fee.paidAmount);
    const cashReceived =
      amount !== undefined ? Math.min(remaining, Math.max(0, Number(amount))) : remaining;

    if (cashReceived <= 0) {
      res.status(400).json({ error: 'বৈধ নগদ ক্যাশ পরিমাণ প্রদান করুন।' });
      return;
    }

    fee.paidAmount += cashReceived;
    fee.paymentMethod = 'cash';
    fee.paidAt = new Date().toISOString();
    if (!fee.receiptNo) {
      const monthDigits = fee.month.replace('-', '');
      const seq = String(
        db.fees.filter((f) => f.month === fee.month && f.receiptNo).length + 1
      ).padStart(3, '0');
      fee.receiptNo = `CASH-${monthDigits}-${seq}`;
    }
    if (note) fee.note = String(note).trim();

    if (fee.paidAmount >= totalPayable) {
      fee.status = 'paid';
    }

    const student = db.students.find((s) => s.id === fee.studentId);
    if (student && sendReceiptSms !== false) {
      await dispatchSms(db, {
        recipientName: `${student.name} (${student.guardianName})`,
        phone: student.guardianPhone || student.phone,
        message: `${db.settings.instituteName}: ${student.name} (রোল: ${student.rollNo})-এর ${formatBengaliMonth(fee.month)} মাসের ৳${cashReceived} ক্যাশ ফি গ্রহণ করা হয়েছে। রসিদ: ${fee.receiptNo}। ধন্যবাদ।`,
        type: 'cash_receipt',
        month: fee.month,
      });
    }

    saveDatabase(db);
    res.json(fee);
  });

  app.post('/api/automation/run', async (req, res) => {
    const db = loadDatabase();
    const { month, simulatedDay } = req.body as {
      month?: string;
      simulatedDay?: number;
    };
    const summary = await runFeeAutomationRules(db, {
      month: month || getCurrentMonthStr(),
      dayOfMonth: simulatedDay ? Number(simulatedDay) : undefined,
    });
    saveDatabase(db);
    res.json(summary);
  });

  // Exams & Results
  app.get('/api/exams', (_req, res) => {
    const db = loadDatabase();
    const enriched = db.exams.map((e) => {
      const batch = db.batches.find((b) => b.id === e.batchId);
      const sortedResults = [...e.results]
        .sort((a, b) => b.obtainedMarks - a.obtainedMarks)
        .map((r, idx) => {
          const st = db.students.find((s) => s.id === r.studentId);
          const pct = Math.round((r.obtainedMarks / e.totalMarks) * 100);
          return {
            ...r,
            rank: idx + 1,
            studentName: st?.name || 'অজানা',
            rollNo: st?.rollNo || '-',
            percentage: pct,
            passed: r.obtainedMarks >= e.passMarks,
          };
        });
      return {
        ...e,
        batchName: batch?.name || '-',
        results: sortedResults,
      };
    });
    res.json(enriched);
  });

  app.post('/api/exams', async (req, res) => {
    const db = loadDatabase();
    const { title, batchId, subject, examDate, totalMarks, passMarks, results, sendSms } =
      req.body as Partial<Exam> & { sendSms?: boolean };

    if (!title || !batchId || !subject) {
      res.status(400).json({ error: 'পরীক্ষার নাম, ব্যাচ এবং বিষয় দিন।' });
      return;
    }

    const newExam: Exam = {
      id: `exm-${crypto.randomUUID().slice(0, 6)}`,
      title: String(title).trim(),
      batchId,
      subject: String(subject).trim(),
      examDate: examDate || new Date().toISOString().slice(0, 10),
      totalMarks: Number(totalMarks || 100),
      passMarks: Number(passMarks || 40),
      results: Array.isArray(results)
        ? results.map((r) => ({
            studentId: r.studentId,
            obtainedMarks: Number(r.obtainedMarks),
            remarks: r.remarks || '',
          }))
        : [],
      createdAt: new Date().toISOString(),
    };

    db.exams.unshift(newExam);

    if (sendSms && newExam.results.length > 0) {
      for (const r of newExam.results) {
        const student = db.students.find((s) => s.id === r.studentId);
        if (student) {
          await dispatchSms(db, {
            recipientName: `${student.name} (${student.guardianName})`,
            phone: student.guardianPhone || student.phone,
            message: `${db.settings.instituteName}: "${newExam.title}" (${newExam.subject}) পরীক্ষায় ${student.name} ${newExam.totalMarks} নম্বরের মধ্যে ${r.obtainedMarks} নম্বর পেয়েছে।`,
            type: 'exam_result',
          });
        }
      }
    }

    saveDatabase(db);
    res.status(201).json(newExam);
  });

  app.put('/api/exams/:id/results', async (req, res) => {
    const db = loadDatabase();
    const exam = db.exams.find((e) => e.id === req.params.id);
    if (!exam) {
      res.status(404).json({ error: 'পরীক্ষা পাওয়া যায়নি।' });
      return;
    }
    const { results, sendSms } = req.body as {
      results: Array<{ studentId: string; obtainedMarks: number; remarks?: string }>;
      sendSms?: boolean;
    };

    exam.results = results.map((r) => ({
      studentId: r.studentId,
      obtainedMarks: Number(r.obtainedMarks),
      remarks: r.remarks || '',
    }));

    if (sendSms) {
      for (const r of exam.results) {
        const student = db.students.find((s) => s.id === r.studentId);
        if (student) {
          await dispatchSms(db, {
            recipientName: `${student.name} (${student.guardianName})`,
            phone: student.guardianPhone || student.phone,
            message: `${db.settings.instituteName}: "${exam.title}" (${exam.subject}) পরীক্ষায় ${student.name} ${exam.totalMarks}-এর মধ্যে ${r.obtainedMarks} নম্বর পেয়েছে।`,
            type: 'exam_result',
          });
        }
      }
    }

    saveDatabase(db);
    res.json(exam);
  });

  // Teachers CRUD
  app.get('/api/teachers', (_req, res) => {
    const db = loadDatabase();
    res.json(db.teachers);
  });

  app.post('/api/teachers', (req, res) => {
    const db = loadDatabase();
    const body = req.body as Partial<Teacher>;
    if (!body.name || !body.phone || !body.subject) {
      res.status(400).json({ error: 'শিক্ষকের নাম, ফোন এবং বিষয় দিন।' });
      return;
    }
    const nextCode = `T-${101 + db.teachers.length}`;
    const teacher: Teacher = {
      id: `tch-${crypto.randomUUID().slice(0, 6)}`,
      code: body.code?.trim() || nextCode,
      name: String(body.name).trim(),
      phone: String(body.phone).trim(),
      email: String(body.email || '').trim(),
      subject: String(body.subject).trim(),
      qualification: String(body.qualification || '').trim(),
      baseSalary: Number(body.baseSalary || 0),
      perClassRate: Number(body.perClassRate || 700),
      joiningDate: body.joiningDate || new Date().toISOString().slice(0, 10),
      active: body.active !== false,
    };
    db.teachers.push(teacher);
    saveDatabase(db);
    res.status(201).json(teacher);
  });

  app.put('/api/teachers/:id', (req, res) => {
    const db = loadDatabase();
    const idx = db.teachers.findIndex((t) => t.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'শিক্ষক পাওয়া যায়নি।' });
      return;
    }
    const body = req.body as Partial<Teacher>;
    db.teachers[idx] = {
      ...db.teachers[idx],
      ...body,
      baseSalary:
        body.baseSalary !== undefined
          ? Number(body.baseSalary)
          : db.teachers[idx].baseSalary,
      perClassRate:
        body.perClassRate !== undefined
          ? Number(body.perClassRate)
          : db.teachers[idx].perClassRate,
    };
    saveDatabase(db);
    res.json(db.teachers[idx]);
  });

  // Teacher Class Log & Automatic Salary Calculation
  app.get('/api/class-logs', (req, res) => {
    const db = loadDatabase();
    const month = req.query.month ? String(req.query.month) : null;
    const teacherId = req.query.teacherId ? String(req.query.teacherId) : null;

    let logs = db.classLogs;
    if (month) logs = logs.filter((c) => c.month === month);
    if (teacherId && teacherId !== 'all') {
      logs = logs.filter((c) => c.teacherId === teacherId);
    }

    const enriched = [...logs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((l) => {
        const teacher = db.teachers.find((t) => t.id === l.teacherId);
        const batch = db.batches.find((b) => b.id === l.batchId);
        return {
          ...l,
          teacherName: teacher?.name || 'অজানা শিক্ষক',
          teacherCode: teacher?.code || '-',
          batchName: batch?.name || '-',
        };
      });

    res.json(enriched);
  });

  app.post('/api/class-logs', (req, res) => {
    const db = loadDatabase();
    const body = req.body as Partial<TeacherClassLog>;
    if (!body.teacherId || !body.batchId || !body.date) {
      res.status(400).json({ error: 'শিক্ষক, ব্যাচ ও তারিখ নির্বাচন করুন।' });
      return;
    }

    const teacher = db.teachers.find((t) => t.id === body.teacherId);
    if (!teacher) {
      res.status(404).json({ error: 'শিক্ষক পাওয়া যায়নি।' });
      return;
    }

    const classesCount = Math.max(1, Number(body.classesCount || 1));
    const ratePerClass =
      body.ratePerClass !== undefined
        ? Number(body.ratePerClass)
        : teacher.perClassRate;
    const totalEarned = classesCount * ratePerClass;
    const dateStr = String(body.date);
    const month = dateStr.slice(0, 7);

    const newLog: TeacherClassLog = {
      id: `cls-${crypto.randomUUID().slice(0, 6)}`,
      teacherId: teacher.id,
      batchId: body.batchId,
      subject: String(body.subject || teacher.subject).trim(),
      date: dateStr,
      month,
      classesCount,
      durationHours: Number(body.durationHours || classesCount * 1.5),
      ratePerClass,
      totalEarned,
      topic: String(body.topic || 'নিয়মিত পাঠদান').trim(),
      loggedBy: String(body.loggedBy || teacher.name).trim(),
      createdAt: new Date().toISOString(),
    };

    db.classLogs.unshift(newLog);
    saveDatabase(db);
    res.status(201).json(newLog);
  });

  app.delete('/api/class-logs/:id', (req, res) => {
    const db = loadDatabase();
    db.classLogs = db.classLogs.filter((c) => c.id !== req.params.id);
    saveDatabase(db);
    res.json({ ok: true });
  });

  // Detailed Monthly Teacher Salary Report & Cash Payout
  app.get('/api/reports/teacher-salary', (req, res) => {
    const month = String(req.query.month || getCurrentMonthStr());
    const db = loadDatabase();
    const report = calculateTeacherMonthlyReport(db, month);
    const grandTotalPayable = report.reduce((s, r) => s + r.totalPayable, 0);
    const grandTotalPaid = report.reduce((s, r) => s + r.paidAmount, 0);
    const grandTotalClasses = report.reduce((s, r) => s + r.classesConducted, 0);

    res.json({
      month,
      monthLabel: formatBengaliMonth(month),
      institute: {
        name: db.settings.instituteName,
        address: db.settings.instituteAddress,
        phone: db.settings.institutePhone,
      },
      summary: {
        totalTeachers: report.filter((r) => r.active).length,
        grandTotalClasses,
        grandTotalPayable,
        grandTotalPaid,
        grandBalanceDue: Math.max(0, grandTotalPayable - grandTotalPaid),
      },
      teachers: report,
    });
  });

  app.post('/api/reports/teacher-salary/pay', (req, res) => {
    const db = loadDatabase();
    const { teacherId, month, bonus, deduction, paidAmount, note } = req.body as {
      teacherId: string;
      month: string;
      bonus?: number;
      deduction?: number;
      paidAmount?: number;
      note?: string;
    };

    const report = calculateTeacherMonthlyReport(db, month);
    const item = report.find((r) => r.teacherId === teacherId);
    if (!item) {
      res.status(404).json({ error: 'শিক্ষক পাওয়া যায়নি।' });
      return;
    }

    const appliedBonus = bonus !== undefined ? Number(bonus) : item.bonus;
    const appliedDeduction =
      deduction !== undefined ? Number(deduction) : item.deduction;
    const totalPayable = Math.max(
      0,
      item.baseSalary + item.classEarnings + appliedBonus - appliedDeduction
    );

    let payout = db.salaryPayouts.find(
      (p) => p.teacherId === teacherId && p.month === month
    );

    const amountNow =
      paidAmount !== undefined ? Number(paidAmount) : totalPayable;

    if (!payout) {
      const monthDigits = month.replace('-', '');
      const seq = String(
        db.salaryPayouts.filter((p) => p.month === month).length + 1
      ).padStart(3, '0');
      payout = {
        id: `sal-${month}-${teacherId}`,
        teacherId,
        month,
        baseSalary: item.baseSalary,
        classesCount: item.classesConducted,
        classEarnings: item.classEarnings,
        bonus: appliedBonus,
        deduction: appliedDeduction,
        totalPayable,
        paidAmount: amountNow,
        paymentMethod: 'cash',
        paidAt: amountNow > 0 ? new Date().toISOString() : null,
        receiptNo: amountNow > 0 ? `SAL-${monthDigits}-${seq}` : null,
        note: note || '',
      };
      db.salaryPayouts.push(payout);
    } else {
      payout.bonus = appliedBonus;
      payout.deduction = appliedDeduction;
      payout.baseSalary = item.baseSalary;
      payout.classesCount = item.classesConducted;
      payout.classEarnings = item.classEarnings;
      payout.totalPayable = totalPayable;
      payout.paidAmount = Math.min(totalPayable, amountNow);
      payout.paymentMethod = 'cash';
      payout.paidAt = new Date().toISOString();
      if (!payout.receiptNo && payout.paidAmount > 0) {
        const monthDigits = month.replace('-', '');
        const seq = String(
          db.salaryPayouts.filter((p) => p.month === month).length + 1
        ).padStart(3, '0');
        payout.receiptNo = `SAL-${monthDigits}-${seq}`;
      }
      if (note !== undefined) payout.note = note;
    }

    saveDatabase(db);
    res.json(payout);
  });

  // SMS Logs & Manual Send & Settings
  app.get('/api/sms', (_req, res) => {
    const db = loadDatabase();
    res.json({
      settings: db.settings,
      logs: db.smsLogs,
    });
  });

  app.post('/api/sms/send', async (req, res) => {
    const db = loadDatabase();
    const { targetType, batchId, phone, recipientName, message } = req.body as {
      targetType: 'single' | 'batch' | 'unpaid';
      batchId?: string;
      phone?: string;
      recipientName?: string;
      message: string;
    };

    if (!message || !message.trim()) {
      res.status(400).json({ error: 'মেসেজের টেক্সট লিখুন।' });
      return;
    }

    const sentLogs = [];
    if (targetType === 'single' && phone) {
      sentLogs.push(
        await dispatchSms(db, {
          recipientName: recipientName || 'প্রাপক',
          phone: phone.trim(),
          message: message.trim(),
          type: 'manual',
        })
      );
    } else if (targetType === 'batch' && batchId) {
      const students = db.students.filter(
        (s) => s.batchId === batchId && s.status === 'active'
      );
      for (const st of students) {
        sentLogs.push(
          await dispatchSms(db, {
            recipientName: `${st.name} (${st.guardianName})`,
            phone: st.guardianPhone || st.phone,
            message: message.trim(),
            type: 'manual',
          })
        );
      }
    } else if (targetType === 'unpaid') {
      const month = getCurrentMonthStr();
      const unpaidFees = db.fees.filter(
        (f) => f.month === month && f.status !== 'paid'
      );
      for (const f of unpaidFees) {
        const st = db.students.find((s) => s.id === f.studentId);
        if (st) {
          sentLogs.push(
            await dispatchSms(db, {
              recipientName: `${st.name} (${st.guardianName})`,
              phone: st.guardianPhone || st.phone,
              message: message.trim(),
              type: 'manual',
              month,
            })
          );
        }
      }
    }

    saveDatabase(db);
    res.json({ ok: true, count: sentLogs.length, logs: sentLogs });
  });

  app.get('/api/settings', (_req, res) => {
    const db = loadDatabase();
    res.json(db.settings);
  });

  app.put('/api/settings', (req, res) => {
    const db = loadDatabase();
    const updates = req.body as Partial<typeof db.settings>;
    db.settings = {
      ...db.settings,
      ...updates,
      lateFineAmount:
        updates.lateFineAmount !== undefined
          ? Number(updates.lateFineAmount)
          : db.settings.lateFineAmount,
      reminderDayOfMonth:
        updates.reminderDayOfMonth !== undefined
          ? Number(updates.reminderDayOfMonth)
          : db.settings.reminderDayOfMonth,
      fineDayOfMonth:
        updates.fineDayOfMonth !== undefined
          ? Number(updates.fineDayOfMonth)
          : db.settings.fineDayOfMonth,
    };
    saveDatabase(db);
    res.json(db.settings);
  });

  return app;
}
