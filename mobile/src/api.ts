import { Platform } from 'react-native';
import type { Company, Department, DirectoryUser, LoginInput, User, UserForm } from './types';

const defaultApiUrl = Platform.OS === 'android'
  ? 'http://10.0.2.2:5001/api'
  : 'http://localhost:5001/api';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || defaultApiUrl).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new ApiError('Cannot reach the BizChat server. Check that the backend is running.', 0, 'network_error');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      data?.error?.message || 'The request could not be completed.',
      response.status,
      data?.error?.code,
    );
  }
  return data as T;
}

export async function login(input: LoginInput) {
  return apiRequest<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getCurrentUser(token: string) {
  const result = await apiRequest<{ user: User }>('/auth/me', {}, token);
  return result.user;
}

export async function getDepartments(token: string) {
  const result = await apiRequest<{ departments: Department[] }>('/departments', {}, token);
  return result.departments;
}

export async function getCurrentCompany(token: string) {
  const result = await apiRequest<{ company: Company }>('/companies/current', {}, token);
  return result.company;
}

export async function getUsers(token: string) {
  const result = await apiRequest<{ users: User[] }>('/users', {}, token);
  return result.users;
}

export async function getDirectoryUsers(token: string) {
  const result = await apiRequest<{ users: DirectoryUser[] }>('/users/directory', {}, token);
  return result.users;
}

export async function updateUserStatus(token: string, userId: string, status: User['status']) {
  const result = await apiRequest<{ user: User }>(`/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, token);
  return result.user;
}

export async function createUser(token: string, form: UserForm) {
  const payload = {
    firstName: form.firstName.trim(),
    ...(form.lastName.trim() && { lastName: form.lastName.trim() }),
    ...(form.employeeCode.trim() && { employeeCode: form.employeeCode.trim() }),
    ...(form.jobTitle.trim() && { jobTitle: form.jobTitle.trim() }),
    mobileNumber: form.mobileNumber.trim(),
    ...(form.countryCode.trim() && { countryCode: form.countryCode.trim().toUpperCase() }),
    ...(form.timezone.trim() && { timezone: form.timezone.trim() }),
    ...(form.email.trim() && { email: form.email.trim().toLowerCase() }),
    password: form.password,
    role: form.role,
    departmentIds: form.departmentIds,
  };
  const result = await apiRequest<{ user: User }>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  return result.user;
}
