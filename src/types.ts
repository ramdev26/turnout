export type UserRole = 'organizer' | 'attendee' | 'super_admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  isBlocked?: boolean;
  status?: 'active' | 'suspended' | 'banned';
  forcePasswordReset?: boolean;
  createdAt: string;
}

export type AdminSummary = {
  totalRevenue: number;
  totalPlatformFees: number;
  totalOrganizerEarnings: number;
  totalPaidOut: number;
  pendingPayoutAmount: number;
  pendingPayoutCount: number;
  transactionCount: number;
  todayRevenue?: number;
  failedPayments?: number;
  refundRequests?: number;
  totalUsers?: number;
  totalEvents?: number;
  activeEvents?: number;
  topEvents?: { id: string; title: string; revenue: number }[];
  topOrganizers?: { id: string; name: string; earnings: number }[];
  charts?: {
    days: number;
    revenueByDay: { date: string; revenue: number; transactions: number }[];
    signupsByDay: { date: string; signups: number }[];
    transactionsByStatus: { status: string; count: number; amount: number }[];
    usersByRole: { role: string; count: number }[];
  };
};

export type PlatformTransaction = {
  id: string;
  eventId: string;
  userId?: string | null;
  amount: number;
  platformFee: number;
  organizerAmount: number;
  paymentStatus: 'pending' | 'paid' | 'failed';
  payhereReference?: string | null;
  isFlagged?: boolean;
  adminNote?: string | null;
  refundRequested?: boolean;
  createdAt: string;
};

export type OrganizerPayout = {
  id: string;
  organizerId: string;
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed';
  method: 'bank_transfer';
  reference?: string | null;
  notes?: string | null;
  organizerName?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type OrganizerTeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type OrganizerProfile = {
  ownerUserId?: string;
  displayName: string;
  email: string;
  organizationName: string;
  logoUrl?: string | null;
  website?: string | null;
  phone?: string | null;
  businessAddress?: string | null;
  businessRegistrationNo?: string | null;
  businessRegistrationDocUrl?: string | null;
  businessRegistrationDocUploaded?: boolean;
  bankAccountHolderName?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountNumberLast4?: string | null;
  bankAccountConfigured?: boolean;
  bankStatementDocUrl?: string | null;
  bankStatementDocUploaded?: boolean;
};

export type OrganizerPaidEventRequirements = {
  needsBusinessDetails: boolean;
  needsBankDetails: boolean;
  needsOwnPayhereCredentials: boolean;
  needsBillingCard: boolean;
};

export type OrganizerPaidEventReadiness = {
  isReady: boolean;
  gatewayMode: OrganizerGatewayMode;
  requirements: OrganizerPaidEventRequirements;
  missing: string[];
  setupUrl: string;
  business: {
    businessAddress: string | null;
    businessRegistrationNo: string | null;
    businessRegistrationDocUrl: string | null;
    businessRegistrationDocUploaded: boolean;
  };
  bank: {
    bankAccountHolderName: string | null;
    bankName: string | null;
    bankBranch: string | null;
    bankAccountNumberLast4: string | null;
    bankAccountConfigured: boolean;
    bankStatementDocUrl: string | null;
    bankStatementDocUploaded: boolean;
  };
};

export type OrganizerTeamMember = {
  id: string;
  memberUserId: string;
  displayName: string;
  email: string;
  role: OrganizerTeamRole;
  createdAt: string | null;
  isOwner?: boolean;
};

export type OrganizerTeamInvite = {
  id: string;
  email: string;
  role: OrganizerTeamRole;
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: string;
  createdAt: string;
};

export type OrganizerWorkspace = {
  ownerUserId: string;
  role: OrganizerTeamRole;
  isOwner: boolean;
  canManageTeam: boolean;
  canEditEvents: boolean;
};

export type OrganizerGatewayMode = 'turnout' | 'own_payhere';

export type OrganizerBillingStatus = 'none' | 'pending' | 'active' | 'failed';

export type OrganizerPaymentSettings = {
  gatewayMode: OrganizerGatewayMode;
  ownPayhereMerchantId: string;
  ownPayhereSecretConfigured: boolean;
  billing: {
    status: OrganizerBillingStatus;
    cardLast4: string | null;
    cardBrand: string | null;
    setupAt: string | null;
  };
  commissionPct: number;
  isReady: boolean;
  requirements: {
    needsBillingCard: boolean;
    needsOwnPayhereCredentials: boolean;
  };
};

export type OrganizerBillingPreapproveResponse = {
  setupOrderId: string;
  actionUrl: string;
  sandbox: boolean;
  hash: string;
  fields: Record<string, unknown>;
  sdkPayment: Record<string, unknown>;
};

export type AttendeeProfile = {
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  phone?: string | null;
  bio?: string | null;
};

export type EventThemeId = 'minimal' | 'neo-green' | 'midnight' | 'sunset';

/** Landing page display mode (Apple-style "Display" control) */
export type LandingDisplayMode = 'auto' | 'light' | 'dark';

/** Landing surface treatment (Apple-style "Style" control) */
export type LandingStyle = 'glass' | 'minimal' | 'bold';

/** Organizer-defined fields collected per ticket holder at checkout (e.g. NIC). */
export type CheckoutFieldDefinition = {
  id: string;
  label: string;
  /** Stable key stored on each attendee, e.g. `nic` */
  key: string;
  required: boolean;
  placeholder?: string;
};

export interface EventCustomization {
  themeId?: EventThemeId;
  /** Event category preset (Music, Sports, etc.) applied under the Minimal theme */
  eventCategory?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  /** Landing display mode: follow theme (auto), force light, or force dark */
  displayMode?: LandingDisplayMode;
  /** Landing surface style: frosted glass, clean minimal, or bold solid */
  landingStyle?: LandingStyle;
  /** When true, the event date/time is "to be announced" (no fixed schedule) */
  scheduleTba?: boolean;
  heroText: string;
  heroSubtext: string;
  layout: 'standard' | 'centered' | 'split';
  customDomain?: string;
  dnsProvider?: 'cloudflare' | 'godaddy' | 'namecheap' | 'other';
  dnsRecordType?: 'CNAME' | 'A';
  dnsRecordTarget?: string;
  dnsConfigured?: boolean;
  ticketPdfTemplateId?: 'classic' | 'midnight' | 'sunset';
  ticketPdfPrimaryColor?: string;
  ticketPdfAccentColor?: string;
  ticketPdfBadgeText?: string;
  ticketPdfFooterNote?: string;
  /** Extra questions asked for each ticket holder during checkout */
  checkoutFields?: CheckoutFieldDefinition[];
  canvas?: CanvasDesign; // legacy freeform
  sections?: SectionDesign;
}

export type CanvasElementType =
  | 'text'
  | 'button'
  | 'image'
  | 'badge'
  | 'divider'
  | 'countdown'
  | 'ticketsEmbed';

export type CanvasElement = {
  id: string;
  type: CanvasElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  props: Record<string, any>;
};

export type CanvasDesign = {
  version: 1;
  canvas: { width: number; height: number; background?: string };
  elements: CanvasElement[];
};

export type SectionType =
  | 'hero'
  | 'richText'
  | 'image'
  | 'countdown'
  | 'tickets'
  | 'speakers'
  | 'agenda'
  | 'sponsors'
  | 'button'
  | 'divider';

export type SectionBlock = {
  id: string;
  type: SectionType;
  props: Record<string, any>;
};

export type SectionDesign = {
  version: 1;
  theme: {
    contentBackground: string;
    border: string;
  };
  blocks: SectionBlock[];
};

export interface Event {
  id: string;
  slug: string;
  organizerId: string;
  /** Organization or display name for public landing header/footer */
  organizerName?: string;
  /** Organizer logo URL when set in account settings */
  organizerLogoUrl?: string | null;
  title: string;
  description: string;
  date: string;
  location: string;
  bannerUrl: string;
  templateId: string;
  customization: EventCustomization;
  customDomain?: string | null;
  status: 'draft' | 'published' | 'cancelled';
  createdAt: string;
}

export interface Ticket {
  id: string;
  eventId: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
  description?: string;
}

export type Speaker = {
  id: string;
  eventId?: string;
  name: string;
  title?: string | null;
  company?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
};

export type Session = {
  id: string;
  eventId?: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  speakerIds: string[];
  createdAt?: string;
};

export type Attendee = {
  id: string;
  eventId: string;
  ticketId: string;
  ticketName: string;
  fullName: string;
  email: string;
  phone?: string | null;
  customFields?: Record<string, string>;
  qrToken: string;
  checkedInAt?: string | null;
  createdAt: string;
};

export type RunbookItem = {
  id: string;
  eventId: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'done';
  dueAt?: string | null;
  createdAt: string;
};

export interface OrderItem {
  ticketId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  eventId: string;
  buyerId?: string;
  buyerName?: string | null;
  buyerPhone?: string | null;
  buyerEmail: string;
  tickets: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'paid' | 'failed';
  stripeSessionId?: string;
  createdAt: string;
  /** `attendee` when opened via a ticket-holder email link (only their pass(es)). */
  viewScope?: 'order' | 'attendee';
  attendees?: {
    id: string;
    ticketId: string;
    ticketName?: string;
    fullName: string;
    email: string;
    phone?: string | null;
    customFields?: Record<string, string>;
    qrToken: string;
    checkedInAt?: string | null;
  }[];
  event?: {
    id: string;
    slug: string;
    title: string;
    date: string;
    location: string;
    bannerUrl: string;
    organizerEmail?: string;
    organizerName?: string;
  } | null;
}
