import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import type { Call, CallSession, CallType, ChatMessage, Company, ConversationSummary, Department, DeviceType, DirectConversation, DirectoryUser, LoginInput, User, UserEditForm, UserForm } from './types';

const defaultApiUrl = Platform.OS === 'web'
  ? '/api'
  : Platform.OS === 'android'
    ? 'http://10.0.2.2:5001/api'
    : 'http://localhost:5001/api';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || defaultApiUrl).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: Array<{ field: string; message: string }>,
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
    const details = Array.isArray(data?.error?.details) ? data.error.details : undefined;
    const detailMessage = details?.length
      ? ` ${details.map((detail: { field?: string; message?: string }) => `${detail.field || 'request'}: ${detail.message || 'Invalid value'}`).join('; ')}`
      : '';
    throw new ApiError(
      `${data?.error?.message || 'The request could not be completed.'}${detailMessage}`,
      response.status,
      data?.error?.code,
      details,
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

export async function registerPushToken(token: string, pushToken: string, deviceType: DeviceType, deviceName?: string) {
  return apiRequest<{ device: { id: string } }>('/devices/push-token', {
    method: 'POST',
    body: JSON.stringify({ pushToken, deviceType, deviceName }),
  }, token);
}

export async function unregisterPushToken(token: string, pushToken: string) {
  return apiRequest<{ revoked: boolean }>('/devices/push-token', {
    method: 'DELETE',
    body: JSON.stringify({ pushToken }),
  }, token);
}

export async function getIncomingCall(token: string) {
  const result = await apiRequest<{ call: Call | null }>('/calls/incoming', {}, token);
  return result.call;
}

export async function getCall(token: string, callId: string) {
  const result = await apiRequest<{ call: Call }>(`/calls/${callId}`, {}, token);
  return result.call;
}

export async function startCall(token: string, conversationId: string, participantId: string, callType: CallType) {
  const result = await apiRequest<{ call: Call }>('/calls', {
    method: 'POST',
    body: JSON.stringify({ conversationId, participantId, callType }),
  }, token);
  return result.call;
}

export async function respondToCall(token: string, callId: string, action: 'accept' | 'decline' | 'busy') {
  const result = await apiRequest<{ call: Call }>(`/calls/${callId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  }, token);
  return result.call;
}

export async function getCallSession(token: string, callId: string, displayName: string): Promise<CallSession> {
  const result = await apiRequest<{ call: Call; livekit: CallSession['livekit'] }>(`/calls/${callId}/token`, {
    method: 'POST',
  }, token);
  return { ...result, displayName };
}

export async function endCall(token: string, callId: string, reason: 'completed' | 'cancelled' | 'failed' | 'unanswered' = 'completed') {
  const result = await apiRequest<{ call: Call }>(`/calls/${callId}/end`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }, token);
  return result.call;
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

export async function getOrCreateDirectConversation(token: string, participantId: string) {
  const result = await apiRequest<{ conversation: DirectConversation }>('/conversations/direct', {
    method: 'POST',
    body: JSON.stringify({ participantId }),
  }, token);
  return result.conversation;
}

export async function getConversations(token: string) {
  const result = await apiRequest<{ conversations: ConversationSummary[] }>('/conversations', {}, token);
  return result.conversations;
}

export async function getConversationMessages(token: string, conversationId: string) {
  const result = await apiRequest<{ messages: ChatMessage[] }>(`/conversations/${conversationId}/messages`, {}, token);
  return result.messages;
}

export async function markConversationRead(token: string, conversationId: string) {
  return apiRequest<{ readCount: number }>(`/conversations/${conversationId}/read`, { method: 'POST' }, token);
}

export async function sendConversationMessage(token: string, conversationId: string, content: string) {
  const result = await apiRequest<{ message: ChatMessage }>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  }, token);
  return result.message;
}

export async function uploadConversationAttachment(token: string, conversationId: string, file: Blob, fileName: string) {
  const form = new FormData();
  form.append('file', file, fileName);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/conversations/${conversationId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new ApiError('Cannot reach the BizChat server. Check your connection.', 0, 'network_error');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data?.error?.message || 'The file could not be uploaded.', response.status, data?.error?.code);
  return data.message as ChatMessage;
}

export async function uploadConversationAttachmentFromUri(token: string, conversationId: string, uri: string, fileName: string, mimeType: string) {
  const form = new FormData();
  const nativeFile = new File(uri);
  const uploadFile = nativeFile.type ? nativeFile : nativeFile.slice(0, nativeFile.size, mimeType);
  form.append('file', uploadFile, fileName);
  let response: Response;
  try {
    response = await expoFetch(`${API_URL}/conversations/${conversationId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new ApiError('Cannot reach the BizChat server. Check your connection.', 0, 'network_error');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data?.error?.message || 'The voice message could not be uploaded.', response.status, data?.error?.code);
  return data.message as ChatMessage;
}

export async function downloadConversationAttachment(token: string, conversationId: string, attachmentId: string) {
  const response = await fetch(`${API_URL}/conversations/${conversationId}/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data?.error?.message || 'The attachment could not be downloaded.', response.status, data?.error?.code);
  }
  return response.blob();
}

export function getConversationAttachmentAudioSource(token: string, conversationId: string, attachmentId: string) {
  return {
    uri: `${API_URL}/conversations/${conversationId}/attachments/${attachmentId}`,
    headers: { Authorization: `Bearer ${token}` },
  };
}

export async function updateUserStatus(token: string, userId: string, status: User['status']) {
  const result = await apiRequest<{ user: User }>(`/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, token);
  return result.user;
}

export async function updateUser(token: string, userId: string, form: UserEditForm, originalRole: User['role']) {
  const payload = {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    employeeCode: form.employeeCode.trim(),
    jobTitle: form.jobTitle.trim(),
    mobileNumber: form.mobileNumber.trim(),
    countryCode: form.countryCode.trim().toUpperCase(),
    timezone: form.timezone.trim(),
    email: form.email.trim().toLowerCase(),
    ...(originalRole !== 'super_admin' && { role: form.role }),
    departmentIds: form.departmentIds,
  };
  const result = await apiRequest<{ user: User }>(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
  return result.user;
}

export async function changeUserPassword(token: string, userId: string, newPassword: string) {
  const result = await apiRequest<{ user: Pick<User, 'id' | 'first_name' | 'last_name'> }>(`/users/${userId}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ newPassword }),
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
