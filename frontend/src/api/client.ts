/**
 * API Client - Handles all authenticated API calls
 * Automatically includes JWT token in Authorization header
 */

// ✨ Clean casting bypasses duplicate global interface declarations entirely
const metaEnv = (import.meta as any).env || {};
const BASE_URL = metaEnv.VITE_API_URL || 'https://nursejk-assistant-q1oe.onrender.com';
const API_URL = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;

export interface ApiOptions extends RequestInit {
  // Custom options can be added here
}

/**
 * Make an authenticated API call
 */
export async function apiCall(
  endpoint: string,
  options: ApiOptions = {}
): Promise<any> {
  const token = localStorage.getItem('authToken');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Ensure the endpoint string starts with a leading slash cleanly
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const response = await fetch(`${API_URL}${cleanEndpoint}`, {
    ...options,
    headers, 
  });

  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('authToken');
    window.location.href = '/';
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.message || 'API request failed');
  }

  return response.json();
}

/**
 * Chat API
 */
export const chatAPI = {
  async sendMessage(message: string, options?: any) {
    return apiCall('/api/chat/retrieval', {
      method: 'POST',
      body: JSON.stringify({ message, ...options }),
    });
  },

  async getHistory() {
    return apiCall('/api/conversations');
  },

  async getPerformance() {
    return apiCall('/api/dashboard/performance');
  },
};

/**
 * Health check
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/`);
    return response.ok;
  } catch {
    return false;
  }
}