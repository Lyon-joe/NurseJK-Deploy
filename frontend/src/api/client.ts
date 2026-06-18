/**
 * API Client - Handles all authenticated API calls
 * Automatically includes JWT token in Authorization header
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
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
