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
  message_type: 'text' | 'image' | 'file';
  content: string | null;
  edited_at: string | null;
  created_at: string;
  sender_first_name?: string;
  sender_last_name?: string | null;
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  timezone: string;
  logo_url: string | null;
};
