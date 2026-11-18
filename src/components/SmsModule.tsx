import React, { useState } from 'react';
import { Save, Send, Settings, X } from 'lucide-react';
import { apiRequest } from '../api';
import type { Batch, CoachingSettings, SmsLog, SmsType } from '../types';

interface SmsModuleProps {
  logs: SmsLog[];
  settings: CoachingSettings | null;
  batches: Batch[];
  onRefresh: () => void;
}

const SMS_TYPE_LABELS: Record<SmsType, string> = {
  due_reminder_10th: '১০ তারিখের বকেয়া সতর্কতা',
  late_fine_15th: '১৫ তারিখের জরিমানা নোটিশ',
  cash_receipt: 'ক্যাশ ফি রসিদ',
  admission_welcome: 'ভর্তি স্বাগতম',
  absent_alert: 'অনুপস্থিতি বার্তা',
  exam_result: 'পরীক্ষার ফলাফল',
  manual: 'ম্যানুয়াল SMS',
};

export const SmsModule: React.FC<SmsModuleProps> = ({
  logs,
  settings,
  batches,
  onRefresh,
}) => {
  const [targetType, setTargetType] = useState<'single' | 'batch' | 'unpaid'>('unpaid');
  const [batchId, setBatchId] = useState(batches[0]?.id || '');
  const [phone, setPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Settings form
  const [lateFineAmount, setLateFineAmount] = useState(
    String(settings?.lateFineAmount ?? 200)
  );
  const [reminderDay, setReminderDay] = useState(
    String(settings?.reminderDayOfMonth ?? 10)
  );
  const [fineDay, setFineDay] = useState(String(settings?.fineDayOfMonth ?? 15));
  const [smsEnabled, setSmsEnabled] = useState(settings?.smsEnabled ?? true);
  const [providerMode, setProviderMode] = useState<'outbox' | 'webhook'>(
    settings?.smsProviderMode ?? 'outbox'
  );
  const [webhookUrl, setWebhookUrl] = useState(settings?.smsWebhookUrl ?? '');
  const [apiKey, setApiKey] = useState(settings?.smsApiKey ?? '');
  const [senderId, setSenderId] = useState(settings?.smsSenderId ?? 'GHASPHUL');

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setFeedback('');
    try {
      const res = await apiRequest<{ count: number }>('/api/sms/send', {
        method: 'POST',
        body: JSON.stringify({
          targetType,
          batchId,
          phone,
          recipientName,
          message,
        }),
      });
      setMessage('');
      setFeedback(`${res.count} জন প্রাপকের কাছে SMS সফলভাবে পাঠানো হয়েছে।`);
      onRefresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'SMS পাঠানো যায়নি।');
    } finally {
      setSending(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setFeedback('');
    try {
      await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          lateFineAmount: Number(lateFineAmount),
          reminderDayOfMonth: Number(reminderDay),
          fineDayOfMonth: Number(fineDay),
          smsEnabled,
          smsProviderMode: providerMode,
          smsWebhookUrl: webhookUrl,
          smsApiKey: apiKey,
          smsSenderId: senderId,
        }),
      });
      setFeedback('অটোমেশন নিয়ম ও SMS গেটওয়ে সেটিংস সংরক্ষণ করা হয়েছে।');
      onRefresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'সেটিংস সেভ করা যায়নি।');
    } finally {
      setSending(false);
    }
  };

  const filteredLogs = logs.filter(
    (l) => typeFilter === 'all' || l.type === typeFilter
  );

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-900 flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="cursor-pointer p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manual / Bulk SMS Composer */}
        <form
          onSubmit={handleSendSms}
          className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Send className="w-4 h-4 text-teal-800" />
            <span>তাৎক্ষণিক SMS পাঠান</span>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTargetType('unpaid')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                targetType === 'unpaid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              সকল বকেয়া শিক্ষার্থী
            </button>
            <button
              type="button"
              onClick={() => setTargetType('batch')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                targetType === 'batch' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              নির্দিষ্ট ব্যাচ
            </button>
            <button
              type="button"
              onClick={() => setTargetType('single')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                targetType === 'single' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              একক নম্বর
            </button>
          </div>

          {targetType === 'batch' && (
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
          )}

          {targetType === 'single' && (
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="মোবাইল নম্বর (017...)"
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
              />
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="প্রাপকের নাম"
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          )}

          <div>
            <textarea
              required
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="আপনার বার্তা লিখুন..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>SMS প্রেরণ করুন</span>
          </button>
        </form>

        {/* Automation & Gateway Settings */}
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Settings className="w-4 h-4 text-teal-800" />
            <span>অটোমেশন নিয়ম ও SMS গেটওয়ে সেটিংস</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                রিমাইন্ডার দিন
              </label>
              <input
                type="number"
                min={1}
                max={28}
                value={reminderDay}
                onChange={(e) => setReminderDay(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                জরিমানার দিন
              </label>
              <input
                type="number"
                min={1}
                max={28}
                value={fineDay}
                onChange={(e) => setFineDay(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                জরিমানা (৳)
              </label>
              <input
                type="number"
                min={0}
                value={lateFineAmount}
                onChange={(e) => setLateFineAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SMS মোড
              </label>
              <select
                value={providerMode}
                onChange={(e) => setProviderMode(e.target.value as 'outbox' | 'webhook')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="outbox">লোকাল আউটবক্স (টেস্ট মোড)</option>
                <option value="webhook">লাইভ SMS API ওয়েবহুক</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sender ID
              </label>
              <input
                type="text"
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
          </div>

          {providerMode === 'webhook' && (
            <div className="grid grid-cols-2 gap-3">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://sms-gateway.example/api/send"
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="API Key / Token"
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={smsEnabled}
                onChange={(e) => setSmsEnabled(e.target.checked)}
                className="rounded border-slate-300 text-teal-800"
              />
              <span>অটোমেটেড SMS নোটিফিকেশন সক্রিয় রাখুন</span>
            </label>

            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>সেটিংস সেভ</span>
            </button>
          </div>
        </form>
      </div>

      {/* SMS Outbox Log */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">
            প্রেরিত SMS লগ ({filteredLogs.length}টি)
          </h3>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-xs bg-white"
          >
            <option value="all">সকল ধরন</option>
            {Object.entries(SMS_TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">সময়</th>
                <th className="py-3 px-4">প্রাপক ও নম্বর</th>
                <th className="py-3 px-4">ধরন</th>
                <th className="py-3 px-4">বার্তা</th>
                <th className="py-3 px-4">অবস্থা</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((sms) => (
                <tr key={sms.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-xs font-mono-num text-slate-500 whitespace-nowrap">
                    {sms.createdAt.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{sms.recipientName}</div>
                    <div className="text-xs font-mono-num text-slate-500">{sms.phone}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                    {SMS_TYPE_LABELS[sms.type] || sms.type}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 max-w-md">
                    {sms.message}
                  </td>
                  <td className="py-3 px-4 text-xs font-semibold whitespace-nowrap">
                    {sms.status === 'delivered' ? (
                      <span className="text-emerald-700">প্রেরিত</span>
                    ) : sms.status === 'queued' ? (
                      <span className="text-amber-700">অপেক্ষমাণ</span>
                    ) : (
                      <span className="text-red-700">ব্যর্থ</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
