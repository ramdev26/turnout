export type UserRole = 'organizer' | 'attendee' | 'super_admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  isBlocked?: boolean;
  status?: 'active' | 'suspended' | 'banned';
  forcePasswordReset?: boolean;
  emailVerified?: boolean;
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

export type BankTransferDetails = {
  accountHolderName: string;
  bankName: string;
  bankBranch: string;
  accountNumber: string;
  accountType?: string | null;
  bankAddress?: string | null;
  bankCode?: string | null;
  branchCode?: string | null;
  swiftCode?: string | null;
};

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
  bankAccountType?: string | null;
  bankAddress?: string | null;
  bankCode?: string | null;
  bankBranchCode?: string | null;
  bankSwiftCode?: string | null;
  bankStatementDocUrl?: string | null;
  bankStatementDocUploaded?: boolean;
  /** Organization Terms & Conditions (HTML). */
  termsHtml?: string | null;
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
    bankAccountType: string | null;
    bankAddress: string | null;
    bankCode: string | null;
    bankBranchCode: string | null;
    bankSwiftCode: string | null;
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

export type OrganizerOwnGatewayId = 'payhere' | 'webx' | 'directpay';

export type OrganizerInstallmentMode = 'off' | 'turnout' | 'own';

export type OrganizerBillingStatus = 'none' | 'pending' | 'active' | 'failed';

export type OrganizerPaymentSettings = {
  gatewayMode: OrganizerGatewayMode;
  ownGateway: OrganizerOwnGatewayId | null;
  ownPayhereMerchantId: string;
  ownPayhereSecretConfigured: boolean;
  installmentMode: OrganizerInstallmentMode;
  ownKokoEnabled: boolean;
  ownMintpayEnabled: boolean;
  ownKokoMerchantId: string;
  ownKokoSecretConfigured: boolean;
  ownMintpayMerchantId: string;
  ownMintpaySecretConfigured: boolean;
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

/** Input control for an organizer-defined checkout question. */
export type CheckoutFieldType = 'text' | 'textarea' | 'number' | 'select' | 'radio';

export type CheckoutFieldOption = {
  id: string;
  label: string;
  /** Value stored on the attendee answer */
  value: string;
};

/** Organizer-defined fields collected per ticket holder at checkout (e.g. NIC). */
export type CheckoutFieldDefinition = {
  id: string;
  label: string;
  /** Stable key stored on each attendee, e.g. `nic` */
  key: string;
  required: boolean;
  /** Defaults to short text when omitted (back-compat). */
  type?: CheckoutFieldType;
  placeholder?: string;
  /** Choices for select / radio fields. */
  options?: CheckoutFieldOption[];
};

export interface EventCustomization {
  themeId?: EventThemeId;
  /** Event category label (Music, Sports, etc.) — separate from design colours */
  eventCategory?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  /** Landing display mode: follow theme (auto), force light, or force dark */
  displayMode?: LandingDisplayMode;
  /** Landing surface style: frosted glass, clean minimal, or bold solid */
  landingStyle?: LandingStyle;
  /** Deep colour overrides — when set, win over derived theme surfaces */
  buttonColor?: string;
  headingColor?: string;
  bodyTextColor?: string;
  mutedTextColor?: string;
  pageBackgroundColor?: string;
  /** Section / chrome colours for full landing customization */
  surfaceColor?: string;
  surfaceMutedColor?: string;
  borderColor?: string;
  headerBgColor?: string;
  footerBgColor?: string;
  /** Deep type scale overrides (px). When unset, templates keep their default clamps. */
  h1FontSize?: number;
  h2FontSize?: number;
  bodyFontSize?: number;
  smallFontSize?: number;
  /** Per-element type emphasis (bold / italic / underline). */
  h1Bold?: boolean;
  h1Italic?: boolean;
  h1Underline?: boolean;
  h2Bold?: boolean;
  h2Italic?: boolean;
  h2Underline?: boolean;
  bodyBold?: boolean;
  bodyItalic?: boolean;
  bodyUnderline?: boolean;
  smallBold?: boolean;
  smallItalic?: boolean;
  smallUnderline?: boolean;
  /** Per-event ticket / attendance policy (HTML). Falls back to platform default when empty. */
  eventPolicyHtml?: string;
  /** When true, the event date/time is "to be announced" (no fixed schedule) */
  scheduleTba?: boolean;
  /** Physical venue vs online meeting / stream */
  locationMode?: 'physical' | 'online';
  /** Platform when locationMode is online */
  onlinePlatform?: 'google_meet' | 'zoom' | 'youtube' | 'other';
  /** Meeting / stream URL when locationMode is online */
  onlineUrl?: string;
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
  /** Extra gallery images shared by all landing templates (banner is always image 1). */
  eventGalleryImages?: string[];
  /** Backward-compatible alias for older Arena-only clients. */
  arenaGalleryImages?: string[];
  /** When true, attendees may pay via bank transfer (requires organizer bank details). */
  allowBankTransfer?: boolean;
  /** When false, PayHere/card checkout is disabled for this event. Defaults to true. */
  allowPayhere?: boolean;
  /** Explicit payment method toggles for this event. */
  paymentMethods?: {
    payhere?: boolean;
    bankTransfer?: boolean;
  };
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
  /** Organizer Terms & Conditions HTML for checkout acceptance */
  organizerTermsHtml?: string | null;
  /** True when this event accepts bank transfer and organizer bank details are complete */
  allowBankTransfer?: boolean;
  /** True when card/online PayHere checkout is enabled for this event */
  allowPayhere?: boolean;
  paymentMethods?: {
    payhere?: boolean;
    bankTransfer?: boolean;
  };
  /** Receiving bank account shown at checkout when bank transfer is enabled */
  bankTransfer?: BankTransferDetails | null;
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
  paymentMethod?: 'free' | 'payhere' | 'bank_transfer' | 'manual' | 'complimentary' | 'manual_cash' | 'manual_bank' | 'manual_card' | 'manual_other' | string;
  bankTransferSlipUrl?: string | null;
  bankTransferSlipUploadedAt?: string | null;
  bankTransferConfirmedAt?: string | null;
  bankTransfer?: BankTransferDetails | null;
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
