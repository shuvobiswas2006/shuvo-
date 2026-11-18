import crypto from 'node:crypto';
import type {
  CoachingDatabase,
  FeeRecord,
  SmsLog,
  SmsType,
} from './types.ts';

export function formatBengaliMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const months: Record<string, string> = {
    '01': 'জানুয়ারি',
    '02': 'ফেব্রুয়ারি',
    '03': 'মার্চ',
    '04': 'এপ্রিল',
    '05': 'মে',
    '06': 'জুন',
    '07': 'জুলাই',
    '08': 'আগস্ট',
    '09': 'সেপ্টেম্বর',
    '10': 'অক্টোবর',
    '11': 'নভেম্বর',
    '12': 'ডিসেম্বর',
  };
  return `${months[month] || month} ${year}`;
}

export async function dispatchSms(
  db: CoachingDatabase,
  params: {
    recipientName: string;
    phone: string;
    message: string;
    type: SmsType;
    month?: string;
  }
): Promise<SmsLog> {
  const { recipientName, phone, message, type, month } = params;
  let status: SmsLog['status'] = 'delivered';
  let gatewayResponse = 'Outbox Mode: ডেলিভারি নিশ্চিত (লোকাল লগ সংরক্ষিত)';

  if (!db.settings.smsEnabled) {
    status = 'queued';
    gatewayResponse = 'SMS অটোমেশন নিষ্ক্রিয় আছে';
  } else if (
    db.settings.smsProviderMode === 'webhook' &&
    db.settings.smsWebhookUrl.trim() !== ''
  ) {
    try {
      const res = await fetch(db.settings.smsWebhookUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(db.settings.smsApiKey
            ? { Authorization: `Bearer ${db.settings.smsApiKey}` }
            : {}),
        },
        body: JSON.stringify({
          api_key: db.settings.smsApiKey,
          senderid: db.settings.smsSenderId,
          number: phone,
          message,
        }),
      });
      if (res.ok) {
        status = 'delivered';
        gatewayResponse = `Webhook HTTP ${res.status} OK`;
      } else {
        status = 'failed';
        gatewayResponse = `Webhook Error HTTP ${res.status}`;
      }
    } catch (err) {
      status = 'failed';
      gatewayResponse =
        err instanceof Error ? `Network error: ${err.message}` : 'Webhook error';
    }
  }

  const log: SmsLog = {
    id: `sms-${crypto.randomUUID().slice(0, 8)}`,
    recipientName,
    phone,
    message,
    type,
    status,
    gatewayResponse,
    month,
    createdAt: new Date().toISOString(),
  };

  db.smsLogs.unshift(log);
  if (db.smsLogs.length > 500) {
    db.smsLogs = db.smsLogs.slice(0, 500);
  }
  return log;
}

export function ensureFeeRecordsForMonth(
  db: CoachingDatabase,
  month: string
): number {
  let created = 0;
  for (const student of db.students) {
    if (student.status !== 'active') continue;
    const exists = db.fees.some(
      (f) => f.studentId === student.id && f.month === month
    );
    if (!exists) {
      const record: FeeRecord = {
        id: `fee-${month}-${student.id}`,
        studentId: student.id,
        batchId: student.batchId,
        month,
        baseFee: student.monthlyFee,
        fineAmount: 0,
        discountAmount: 0,
        paidAmount: 0,
        paymentMethod: null,
        receiptNo: null,
        paidAt: null,
        status: 'pending',
        reminderSentAt: null,
        fineAppliedAt: null,
      };
      db.fees.push(record);
      created += 1;
    }
  }
  return created;
}

export interface AutomationSummary {
  month: string;
  evaluatedDay: number;
  feesGenerated: number;
  remindersSent: number;
  finesApplied: number;
  totalFineAdded: number;
  ranAt: string;
}

export async function runFeeAutomationRules(
  db: CoachingDatabase,
  options?: { month?: string; dayOfMonth?: number }
): Promise<AutomationSummary> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const targetMonth = options?.month || currentMonth;
  const evaluatedDay = options?.dayOfMonth ?? now.getDate();

  const feesGenerated = ensureFeeRecordsForMonth(db, targetMonth);

  const reminderDay = db.settings.reminderDayOfMonth || 10;
  const fineDay = db.settings.fineDayOfMonth || 15;
  const fineAmount = db.settings.lateFineAmount || 200;

  let remindersSent = 0;
  let finesApplied = 0;
  let totalFineAdded = 0;

  const monthLabel = formatBengaliMonth(targetMonth);

  for (const fee of db.fees) {
    if (fee.month !== targetMonth) continue;
    if (fee.status === 'paid') continue;

    const student = db.students.find((s) => s.id === fee.studentId);
    if (!student || student.status !== 'active') continue;

    const netDue = Math.max(
      0,
      fee.baseFee + fee.fineAmount - fee.discountAmount - fee.paidAmount
    );
    if (netDue <= 0) {
      fee.status = 'paid';
      continue;
    }

    // Rule 1: 10th of month due reminder SMS
    if (evaluatedDay >= reminderDay && !fee.reminderSentAt) {
      await dispatchSms(db, {
        recipientName: `${student.name} (${student.guardianName})`,
        phone: student.guardianPhone || student.phone,
        message: `${db.settings.instituteName}: সম্মানিত অভিভাবক, ${student.name} (রোল: ${student.rollNo})-এর ${monthLabel} মাসের কোচিং ফি ৳${netDue} এখনো বকেয়া রয়েছে। ${fineDay} তারিখের আগে ক্যাশ কাউন্টারে পরিশোধের অনুরোধ করা হলো, নতুবা জরিমানা যুক্ত হবে।`,
        type: 'due_reminder_10th',
        month: targetMonth,
      });
      fee.reminderSentAt = now.toISOString();
      remindersSent += 1;
    }

    // Rule 2: 15th of month automatic late fine + SMS
    if (evaluatedDay >= fineDay && !fee.fineAppliedAt) {
      fee.fineAmount += fineAmount;
      fee.fineAppliedAt = now.toISOString();
      fee.status = 'overdue';
      const updatedTotal = Math.max(
        0,
        fee.baseFee + fee.fineAmount - fee.discountAmount - fee.paidAmount
      );

      await dispatchSms(db, {
        recipientName: `${student.name} (${student.guardianName})`,
        phone: student.guardianPhone || student.phone,
        message: `${db.settings.instituteName}: ${student.name} (রোল: ${student.rollNo})-এর ${monthLabel} মাসের বেতন ${fineDay} তারিখের মধ্যে পরিশোধ না করায় ৳${fineAmount} বিলম্ব জরিমানা যুক্ত হয়েছে। সর্বমোট বকেয়া: ৳${updatedTotal} (শুধুমাত্র ক্যাশে পরিশোধযোগ্য)।`,
        type: 'late_fine_15th',
        month: targetMonth,
      });

      finesApplied += 1;
      totalFineAdded += fineAmount;
    }
  }

  const ranAt = now.toISOString();
  db.settings.lastAutomationRunAt = ranAt;

  return {
    month: targetMonth,
    evaluatedDay,
    feesGenerated,
    remindersSent,
    finesApplied,
    totalFineAdded,
    ranAt,
  };
}
