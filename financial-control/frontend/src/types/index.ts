export type SystemRole = 'ADMIN' | 'USER';
export type ProjectRole = 'GESTOR' | 'ANALISTA';
export type ProjectStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface User {
  id: string;
  name: string;
  email: string;
  systemRole: SystemRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  status: ProjectStatus;
  color?: string;
  icon?: string;
  createdAt: string;
}

export interface ProjectUser {
  userId: string;
  projectId: string;
  role: ProjectRole;
  user: Pick<User, 'id' | 'name' | 'email'>;
}

export type PersonType = 'INDIVIDUAL' | 'COMPANY';
export type BankAccountType = 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'PETTY_CASH';
export type CardBrand = 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD' | 'OTHER';
export type CategoryType = 'REVENUE' | 'EXPENSE';
export type CategoryLevel = 'PACKAGE' | 'CATEGORY' | 'SUBCATEGORY';
export type NotificationChannel = 'TELEGRAM' | 'WHATSAPP' | 'EMAIL';

export interface Supplier {
  id: string;
  personType: PersonType;
  companyName?: string;
  tradeName?: string;
  fullName?: string;
  taxId: string;
  email?: string;
  phone?: string;
  mobile?: string;
  paymentTermDays?: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Client {
  id: string;
  personType: PersonType;
  companyName?: string;
  tradeName?: string;
  fullName?: string;
  taxId: string;
  email?: string;
  phone?: string;
  mobile?: string;
  city?: string;
  state?: string;
  paymentTermDays?: number;
  isClient: boolean;
  isSupplier: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  bankCode?: string;
  agency?: string;
  accountNumber?: string;
  accountType: BankAccountType;
  initialBalance: string;
  initialDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreditCard {
  id: string;
  name: string;
  brand: CardBrand;
  lastFourDigits: string;
  creditLimit: string;
  billingDay: number;
  closingDay: number;
  paymentAccountId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AccountCategory {
  id: string;
  projectId: string;
  parentId?: string;
  code: string;
  name: string;
  type: CategoryType;
  level: CategoryLevel;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CostCenter {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface NotificationConfig {
  id: string;
  userId: string;
  channel: NotificationChannel;
  isActive: boolean;
  alertDueToday: boolean;
  alertDueTodayTime: string;
  alertDueInDays?: number;
  alertOverdue: boolean;
  alertLowBalance: boolean;
  alertLowBalanceAmount?: string;
  alertPendingApproval: boolean;
  alertDailySummary: boolean;
  alertDailySummaryTime: string;
  alertWeeklySummary: boolean;
  alertWeeklyDay?: number;
}
