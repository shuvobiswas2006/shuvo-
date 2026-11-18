const TOKEN_KEY = 'ghasphul_admin_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (response.status === 401 && !path.startsWith('/api/auth/login')) {
    clearAuthToken();
    window.dispatchEvent(new Event('ghasphul:unauthorized'));
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (data as { error?: string }).error || `অনুরোধ ব্যর্থ হয়েছে (${response.status})`
    );
  }
  return data as T;
}

export function formatBDT(amount: number): string {
  return `৳${Number(amount || 0).toLocaleString('en-US')}`;
}

export function formatBengaliMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const map: Record<string, string> = {
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
  return `${map[month] || month} ${year}`;
}

export function getCurrentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function downloadCSV(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getWhatsAppUrl(text: string, phone?: string): string {
  const encoded = encodeURIComponent(text);
  if (!phone) {
    return `https://wa.me/?text=${encoded}`;
  }
  const digits = phone.replace(/[^0-9]/g, '');
  const formatted = digits.startsWith('01')
    ? `88${digits}`
    : digits.startsWith('880')
      ? digits
      : digits;
  return `https://wa.me/${formatted}?text=${encoded}`;
}

