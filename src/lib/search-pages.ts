import type {Capability} from "@/api";

export type Section = "general" | "clients" | "billing" | "fleet" | "admin";

export type SearchPage = {
  to: string;
  label: string;
  section: Section;
  capabilities?: Capability[];
  search?: Record<string, string>;
};

export let SECTIONS: Section[] = ["general", "clients", "billing", "fleet", "admin"];

export let SECTION_LABEL: Record<Section, string> = {
  general: "General",
  clients: "Clients",
  billing: "Billing",
  fleet: "Fleet",
  admin: "Administration",
};

// Every page the palette can jump to. Labels are English here and translated at render through
// common:page.<to>, so adding a page is one line.
export let SEARCH_PAGES: SearchPage[] = [
  {to: "/", label: "Overview", section: "general"},
  {to: "/tasks", label: "Tasks", section: "general"},
  {to: "/announcements", label: "Announcements", section: "general", capabilities: ["announcement.write"]},
  {to: "/clients", label: "All clients", section: "clients", capabilities: ["client.read"]},
  {to: "/clients", label: "Clients at risk", section: "clients", capabilities: ["client.read"], search: {health: "atRisk"}},
  {to: "/clients", label: "Clients on trial", section: "clients", capabilities: ["client.read"], search: {subscriptionStatus: "trialing"}},
  {to: "/flows/new-client", label: "New client", section: "clients", capabilities: ["client.write"]},
  {to: "/billing", label: "Billing", section: "billing", capabilities: ["billing.read"]},
  {to: "/billing/renewals", label: "Upcoming renewals", section: "billing", capabilities: ["billing.read"]},
  {to: "/billing/overdue", label: "Overdue accounts", section: "billing", capabilities: ["billing.read"]},
  {to: "/billing/payment-chasing", label: "Payment chasing", section: "billing", capabilities: ["billing.read"]},
  {to: "/billing/win-back", label: "Win-back", section: "billing", capabilities: ["billing.read"]},
  {to: "/billing/invoices", label: "Invoices", section: "billing", capabilities: ["billing.read"]},
  {to: "/billing/payments", label: "Payments", section: "billing", capabilities: ["billing.read"]},
  {to: "/billing/plans", label: "Plans", section: "billing", capabilities: ["billing.read"]},
  {to: "/reports", label: "Reports", section: "billing", capabilities: ["billing.read"]},
  {to: "/fleet", label: "Installations", section: "fleet", capabilities: ["fleet.read"]},
  {to: "/fleet/releases", label: "Releases", section: "fleet", capabilities: ["fleet.read"]},
  {to: "/administration/roles", label: "Access control", section: "admin", capabilities: ["role.read"]},
  {to: "/flows/new-role", label: "New role", section: "admin", capabilities: ["role.write"]},
  {to: "/administration/team", label: "Team", section: "admin", capabilities: ["team.read"]},
  {to: "/administration/activity", label: "Activity log", section: "admin", capabilities: ["audit.read"]},
  {to: "/administration/notifications", label: "Team alerts", section: "admin", capabilities: ["team.read"]},
  {to: "/settings/notifications", label: "My notifications", section: "admin"},
  {to: "/settings/security", label: "Security and two-factor", section: "admin"},
  {to: "/settings", label: "Settings", section: "admin"},
];
