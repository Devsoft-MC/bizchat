export type Role = 'company_admin' | 'user';

export type LoginInput = {
  companySlug: string;
  mobileNumber: string;
  password: string;
};

export type UserForm = {
  firstName: string;
  lastName: string;
  employeeCode: string;
  jobTitle: string;
  mobileNumber: string;
  countryCode: string;
  timezone: string;
  email: string;
  password: string;
  role: Role;
  departmentIds: string[];
};

export type UserEditForm = Omit<UserForm, 'password'>;

export type Department = {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
};

export type User = {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string | null;
  employee_code: string | null;
  job_title: string | null;
  mobile_number: string;
  country_code: string | null;
  timezone: string | null;
  email: string | null;
  role: 'super_admin' | Role;
  status: 'active' | 'inactive' | 'suspended';
  department_names: string[];
  department_ids: string[];
};

export type DirectoryUser = {
  id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  profile_photo_url: string | null;
  department_names: string[];
};

export type DirectConversation = {
  id: string;
  created_at: string;
  last_message_at: string | null;
  participant: DirectoryUser;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: 'text' | 'image' | 'file' | 'audio';
  content: string | null;
  edited_at: string | null;
  created_at: string;
  sender_first_name?: string;
  sender_last_name?: string | null;
  attachments?: ChatAttachment[];
};

export type ChatAttachment = {
  id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number;
};

export type ConversationSummary = {
  id: string;
  last_message_at: string | null;
  created_at: string;
  participant_id: string;
  participant_first_name: string;
  participant_last_name: string | null;
  participant_job_title: string | null;
  participant_profile_photo_url: string | null;
  last_message_id: string | null;
  last_message_sender_id: string | null;
  last_message_type: ChatMessage['message_type'] | null;
  last_message_content: string | null;
  unread_count: number;
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  timezone: string;
  logo_url: string | null;
};

export type DeviceType = 'web' | 'ios' | 'android';

export type CallType = 'audio' | 'video';
export type CallStatus = 'scheduled' | 'ringing' | 'ongoing' | 'ended' | 'cancelled' | 'declined' | 'missed' | 'failed';

export type Call = {
  id: string;
  company_id?: string;
  conversation_id: string;
  created_by: string;
  call_type: CallType;
  status: CallStatus;
  room_name?: string;
  participant_status?: 'invited' | 'accepted' | 'joined' | 'left' | 'declined' | 'missed' | 'busy';
  participant_ids?: string[];
  caller_first_name?: string;
  caller_last_name?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  end_reason?: string | null;
  created_at: string;
};

export type CallSession = {
  call: Call;
  livekit: { url: string; token: string };
  displayName: string;
};
