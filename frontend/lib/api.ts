const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type RequestOptions = RequestInit & {
  requireAuth?: boolean;
};

// using localStorage for tokens currently (note: httpOnly cookies are more secure for prod)
function getTokens() {
  if (typeof window === 'undefined') return { access: null, refresh: null };
  return {
    access: localStorage.getItem('access_token'),
    refresh: localStorage.getItem('refresh_token'),
  };
}

function setTokens(access: string, refresh?: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
  }
}

function clearTokens() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
}

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { requireAuth = true, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);

  let tokens = getTokens();

  if (requireAuth && tokens.access) {
    headers.set('Authorization', `Bearer ${tokens.access}`);
  }

  // Handle JSON content if body is present and not form data
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const doRequest = () => 
    fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
    });

  let response = await doRequest();

  // Handle 401 Unauthorized
  if (response.status === 401 && requireAuth && tokens.refresh) {
    try {
      const refreshResponse = await fetch(`${API_URL}/api/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: tokens.refresh }),
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setTokens(data.access);
        headers.set('Authorization', `Bearer ${data.access}`);
        // Retry the original request
        response = await doRequest();
      } else {
        throw new Error('Refresh failed');
      }
    } catch (error) {
      clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Session expired');
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw { status: response.status, data: errorData };
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) return {} as T;
  
  return JSON.parse(text);
}

// =======================
// AUTH Endpoints
// =======================

export async function register(data: any) {
  return apiFetch('/api/register/', {
    method: 'POST',
    body: JSON.stringify(data),
    requireAuth: false,
  });
}

export async function login(username: string, password: string): Promise<{ access: string; refresh: string }> {
  const response = await apiFetch<{ access: string; refresh: string }>('/api/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
    requireAuth: false,
  });
  setTokens(response.access, response.refresh);
  return response;
}

export function logout() {
  clearTokens();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

export async function getCurrentUser() {
  return apiFetch<any>('/api/me/');
}

export async function getUsers() {
  return apiFetch<any[]>('/api/users/');
}

export async function getPresence() {
  return apiFetch<any[]>('/api/presence/');
}

// =======================
// CHAT Endpoints
// =======================

export async function getMessages(userId: string | number, afterId?: number | string) {
  let url = `/api/chat/messages/?user_id=${userId}`;
  if (afterId) {
    url += `&after=${afterId}`;
  }
  return apiFetch<any[]>(url);
}

export async function sendMessage(receiverId: string | number, content: string) {
  return apiFetch<any>('/api/chat/messages/', {
    method: 'POST',
    body: JSON.stringify({ receiver: receiverId, content }),
  });
}

// =======================
// BLOCK Endpoints
// =======================

export async function blockUser(userId: string | number) {
  return apiFetch('/api/chat/block/', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function unblockUser(userId: string | number) {
  return apiFetch(`/api/chat/block/?user_id=${userId}`, {
    method: 'DELETE',
  });
}

export async function getBlockStatus(userId: string | number) {
  return apiFetch<any>(`/api/chat/block/status/?user_id=${userId}`);
}

export async function getUnreadCounts() {
  return apiFetch<any[]>('/api/chat/unread_counts/');
}
