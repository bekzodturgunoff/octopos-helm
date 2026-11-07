import type {TFunction} from "i18next";
import type {StatusColor} from "@/components/status-text";
import type {AnnouncementSeverity, AnnouncementStatus, BillingVendor, ClientStatus, HealthGrade, InvoiceStatus, PaymentStatus, SubscriptionStatus, TaskPriority} from "@/api";

// Colours and words for every status Helm shows, kept together so a list and a detail page cannot
// drift. Colour is for what needs somebody: green is fine, yellow is watch, red is act.

export function subscriptionStatusColor(status: SubscriptionStatus | undefined): StatusColor {
  switch (status) {
    case "active":
      return "green";
    case "trialing":
      return "blue";
    case "pastDue":
      return "red";
    case "scheduledCancel":
    case "pending":
      return "yellow";
    default:
      return "neutral";
  }
}

export function subscriptionStatusLabel(t: TFunction, status: SubscriptionStatus | undefined) {
  let defaults: Record<SubscriptionStatus, string> = {
    active: "Active",
    trialing: "Trial",
    pastDue: "Past due",
    scheduledCancel: "Cancels at period end",
    pending: "Pending",
    canceled: "Canceled",
    expired: "Expired",
  };
  if (!status) return t("billing:noSubscription", {defaultValue: "No subscription"});
  return t(`billing:subscriptionStatus.${status}`, {defaultValue: defaults[status]});
}

export function clientStatusColor(status: ClientStatus): StatusColor {
  return status === "active" ? "green" : status === "onboarding" ? "blue" : status === "suspended" ? "red" : "neutral";
}

export function clientStatusLabel(t: TFunction, status: ClientStatus) {
  let defaults: Record<ClientStatus, string> = {active: "Active", onboarding: "Onboarding", suspended: "Suspended", churned: "Churned"};
  return t(`clients:status.${status}`, {defaultValue: defaults[status]});
}

export function healthColor(grade: HealthGrade): StatusColor {
  return grade === "good" ? "green" : grade === "watch" ? "yellow" : "red";
}

export function healthLabel(t: TFunction, grade: HealthGrade) {
  let defaults: Record<HealthGrade, string> = {good: "Healthy", watch: "Watch", atRisk: "At risk"};
  return t(`clients:health.${grade}`, {defaultValue: defaults[grade]});
}

export function invoiceStatusColor(status: InvoiceStatus): StatusColor {
  return status === "paid" ? "green" : status === "open" ? "yellow" : status === "uncollectible" ? "red" : "neutral";
}

export function invoiceStatusLabel(t: TFunction, status: InvoiceStatus) {
  let defaults: Record<InvoiceStatus, string> = {draft: "Draft", open: "Open", paid: "Paid", void: "Void", uncollectible: "Uncollectible"};
  return t(`billing:invoiceStatus.${status}`, {defaultValue: defaults[status]});
}

export function paymentStatusColor(status: PaymentStatus): StatusColor {
  return status === "succeeded" ? "green" : status === "failed" ? "red" : status === "pending" ? "yellow" : "neutral";
}

export function paymentStatusLabel(t: TFunction, status: PaymentStatus) {
  let defaults: Record<PaymentStatus, string> = {succeeded: "Succeeded", pending: "Pending", failed: "Failed", refunded: "Refunded"};
  return t(`billing:paymentStatus.${status}`, {defaultValue: defaults[status]});
}

export function vendorLabel(vendor: BillingVendor) {
  let labels: Record<BillingVendor, string> = {none: "Manual", click: "Click", payme: "Payme", octo: "Octo", creem: "Creem", dodo: "Dodo"};
  return labels[vendor];
}

export function priorityColor(priority: TaskPriority): StatusColor {
  return priority === "high" ? "red" : priority === "normal" ? "yellow" : "neutral";
}

export function announcementColor(severity: AnnouncementSeverity): "blue" | "yellow" | "red" {
  return severity === "info" ? "blue" : severity === "warning" ? "yellow" : "red";
}

export function announcementStatusColor(status: AnnouncementStatus): StatusColor {
  return status === "live" ? "green" : status === "scheduled" ? "blue" : "neutral";
}

/** Tag colours are a subset of StatusColor; Tag has no "neutral"-vs-"blue" gap, so map straight across. */
export function tagColor(color: StatusColor): "neutral" | "blue" | "green" | "red" | "yellow" {
  return color;
}
