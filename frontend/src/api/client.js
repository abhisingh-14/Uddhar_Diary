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
    throw new Error(error.error || `API error: ${response.status} ${response.statusText}`);
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
