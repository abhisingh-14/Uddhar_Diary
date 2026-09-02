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

export async function getBalances(userId) {
  return apiClient(`/api/debts/balances?userId=${encodeURIComponent(userId)}`);
}
