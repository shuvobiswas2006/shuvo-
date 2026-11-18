import React, { useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react';
import { apiRequest, setAuthToken } from '../api';
import type { AdminUser } from '../types';

interface LoginPageProps {
  onLoginSuccess: (admin: AdminUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);

  const performLogin = async (loginUser: string, loginPass: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; admin: AdminUser }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            username: loginUser.trim(),
            password: loginPass.trim(),
          }),
        }
      );
      setAuthToken(res.token);
      onLoginSuccess(res.admin);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'লগইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(username, password);
  };

  const handleDemoLogin = async () => {
    setUsername('admin');
    setPassword('admin123');
    await performLogin('admin', 'admin123');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 items-stretch">
        {/* Left Editorial Campus Panel */}
        <div className="relative min-h-[280px] lg:min-h-[580px] bg-slate-900 flex flex-col justify-between overflow-hidden">
          {!imgError ? (
            <img
              src="/src/assets/images/coaching_login_study_1795019965749.jpg"
              alt="ঘাসফুল স্টাডি পয়েন্ট"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/65 to-slate-900/40" />

          <div className="relative z-10 p-8 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-lg">
              ঘা
            </div>
            <span className="text-white text-lg font-semibold tracking-tight">
              ঘাসফুল স্টাডি পয়েন্ট
            </span>
          </div>

          <div className="relative z-10 p-8 space-y-4">
            <h1 className="text-2xl lg:text-3xl font-bold text-white leading-snug">
              শিক্ষার্থী, ক্যাশ ফি ও শিক্ষক সম্মানী ব্যবস্থাপনা — এক প্যানেলে
            </h1>
            <p className="text-sm text-slate-200 leading-relaxed max-w-md">
              ভর্তি, দৈনিক উপস্থিতি, ১০ ও ১৫ তারিখের স্বয়ংক্রিয় এসএমএস ও জরিমানা, পরীক্ষার ফলাফল এবং শিক্ষকদের ক্লাস-ভিত্তিক মাসিক বেতন রিপোর্ট সম্পূর্ণ অ্যাডমিন নিয়ন্ত্রণে।
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
              <span>নগদ ক্যাশ ফি ট্র্যাকিং</span>
              <span aria-hidden="true">·</span>
              <span>অটোমেটেড SMS অ্যালার্ট</span>
              <span aria-hidden="true">·</span>
              <span>প্রিন্টযোগ্য মাসিক রিপোর্ট</span>
            </div>
          </div>
        </div>

        {/* Right Admin Login Form */}
        <div className="p-8 lg:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-sm w-full mx-auto space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-teal-800">
                <ShieldCheck className="w-4 h-4" />
                <span>অ্যাডমিনিস্ট্রেটর অ্যাক্সেস</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                অ্যাডমিন প্যানেলে প্রবেশ করুন
              </h2>
              <p className="text-sm text-slate-600">
                সকল শিক্ষার্থী, শিক্ষক, ফি এবং এসএমএস সিস্টেম নিয়ন্ত্রণের জন্য অ্যাডমিন তথ্য দিয়ে লগইন করুন।
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-username"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  অ্যাডমিন ইউজারনেম
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-username"
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  পাসওয়ার্ড
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-teal-800 hover:bg-teal-900 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {loading ? 'যাচাই করা হচ্ছে...' : 'লগইন করুন'}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500 font-mono-num">
                ডেমো: <span className="text-slate-800 font-medium">admin</span> /{' '}
                <span className="text-slate-800 font-medium">admin123</span>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={handleDemoLogin}
                className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                এক-ক্লিকে ডেমো লগইন
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
