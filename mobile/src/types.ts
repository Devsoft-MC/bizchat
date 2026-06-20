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
};

export type DirectoryUser = {
  id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  profile_photo_url: string | null;
  department_names: string[];
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  timezone: string;
  logo_url: string | null;
};
