import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth';
import { translateErrorDetail } from '@/lib/errorMessages';
import type { AuthTokens } from '@/types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Attach the access token to every outgoing request.
apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

// Silently refresh the access token once on a 401, then retry the original request.
// If refresh itself fails, log the user out so ProtectedRoute sends them to /login.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, logout } = useAuthStore.getState();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post<AuthTokens>(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
      .then((res) => {
        setTokens(res.data);
        return res.data.access_token;
      })
      .catch(() => {
        logout();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retried &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      originalRequest._retried = true;
      const newAccessToken = await refreshAccessToken();
      if (newAccessToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);

export function extractErrorMessage(error: unknown, fallback = 'Đã có lỗi xảy ra'): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return translateErrorDetail(detail);
    if (Array.isArray(detail) && detail.length > 0 && detail[0]?.msg) return detail[0].msg;
    if (error.message) return error.message;
  }
  return fallback;
}
