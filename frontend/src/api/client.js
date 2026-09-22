import { supabase } from '../lib/supabaseClient.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function apiClient(endpoint, { body, ...customConfig } = {}) {
  const headers = {};

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    method: body ? 'POST' : 'GET',
    ...customConfig,
    headers: {
      ...headers,
      ...customConfig.headers,
    },
  };

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    config.headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const apiError = new Error(error.error || `API error: ${response.status} ${response.statusText}`);
    // Expose the server's machine-readable code and HTTP status so callers can
    // map failures onto specific fields instead of parsing the message.
    apiError.code = error.code;
    apiError.status = response.status;
    throw apiError;
  }

  return response.json();
}

export async function getBalances() {
  return apiClient('/api/debts/balances');
}

export async function getPersonDebts(personId) {
  return apiClient(`/api/debts/person/${encodeURIComponent(personId)}`);
}

export async function settleDebt(debtId, amountPaise) {
  return apiClient(`/api/debts/${encodeURIComponent(debtId)}/settle`, {
    method: 'PATCH',
    body: { amountPaise },
  });
}

export async function getExpensesByCategory(granularity) {
  return apiClient(`/api/expenses/by-category?granularity=${encodeURIComponent(granularity)}`);
}

export async function getExpensesOverTime(granularity) {
  return apiClient(`/api/expenses/over-time?granularity=${encodeURIComponent(granularity)}`);
}

export async function getPeople() {
  return apiClient('/api/people');
}

export async function createPerson({ name, email }) {
  return apiClient('/api/people', {
    method: 'POST',
    body: { name, email },
  });
}

export async function updatePersonEmail(personId, email) {
  return apiClient(`/api/people/${encodeURIComponent(personId)}`, {
    method: 'PATCH',
    body: { email },
  });
}

export async function sendReminder(personId) {
  return apiClient(`/api/people/${encodeURIComponent(personId)}/remind`, {
    method: 'POST',
  });
}

export async function getProfile() {
  return apiClient('/api/profile');
}

export async function updateProfile({ fullName }) {
  return apiClient('/api/profile', {
    method: 'PATCH',
    body: { fullName },
  });
}

export async function changePassword({ currentPassword, newPassword }) {
  return apiClient('/api/account/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}
