import {Link} from "@tanstack/react-router";
import {useTranslation} from "react-i18next";
import type {Invoice, Payment} from "@/api";
import {StatusText} from "@/components/status-text";
import {invoiceStatusColor, invoiceStatusLabel, paymentStatusColor, paymentStatusLabel, vendorLabel} from "@/lib/status";
import {daysUntil, formatDate, formatDue} from "@/lib/format";
import {cn} from "@/lib/utils";

export function InvoiceRow({invoice, showClient = false, actions}: {invoice: Invoice; showClient?: boolean; actions?: React.ReactNode}) {
  let {t} = useTranslation();
  let overdue = invoice.status === "open" && daysUntil(invoice.dueAt) < 0;
  return (
    <li className="hover:bg-surface-300 flex flex-col rounded-xl px-2 py-3">
      <Link to="/billing/invoices/$id" params={{id: invoice.id}} className="flex items-center justify-between gap-4">
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">
            {invoice.number}
            {showClient ? <span className="text-on-surface-secondary font-normal"> · {invoice.clientName}</span> : null}
          </span>
          <span className={cn("line-clamp-2 text-sm sm:truncate", overdue ? "text-error-bright" : "text-on-surface-secondary")}>
            {t("billing:issued", {defaultValue: "Issued {{date}}", date: formatDate(invoice.issuedAt)})} ·{" "}
            {invoice.status === "paid"
              ? t("billing:paidOnDate", {defaultValue: "paid {{date}}", date: formatDate(invoice.paidAt)})
              : overdue
                ? t("billing:overdueSince", {defaultValue: "Overdue {{when}}", when: formatDue(invoice.dueAt)})
                : t("billing:dueWhen", {defaultValue: "due {{when}}", when: formatDue(invoice.dueAt)})}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="tabular-nums">{invoice.total.display}</span>
          <StatusText color={invoiceStatusColor(invoice.status)} className="text-sm">
            {invoiceStatusLabel(t, invoice.status)}
          </StatusText>
        </span>
      </Link>
      {actions}
    </li>
  );
}

export function PaymentRow({payment, showClient = true}: {payment: Payment; showClient?: boolean}) {
  let {t} = useTranslation();
  let how =
    payment.method === "card"
      ? vendorLabel(payment.vendor)
      : t(`billing:methodLabel.${payment.method}`, {defaultValue: payment.method === "bankTransfer" ? "Bank transfer" : payment.method === "cash" ? "Cash" : "Manual"});
  return (
    <li className="flex items-center justify-between gap-4 rounded-xl px-2 py-3">
      <span className="flex min-w-0 flex-col">
        <span className="truncate">
          {showClient ? (
            <Link to="/clients/$id" params={{id: payment.clientID}} className="font-medium hover:underline">
              {payment.clientName}
            </Link>
          ) : (
            <span className="font-medium">{how}</span>
          )}
          {payment.invoiceNumber ? <span className="text-on-surface-secondary"> · {payment.invoiceNumber}</span> : null}
        </span>
        <span className={cn("line-clamp-2 text-sm sm:truncate", payment.status === "failed" ? "text-error-bright" : "text-on-surface-secondary")}>
          {formatDate(payment.createdAt)} · {showClient ? how : null}
          {payment.failureReason ? ` · ${payment.failureReason}` : null}
          {payment.recordedBy ? ` · ${t("billing:recordedBy", {defaultValue: "recorded by {{name}}", name: payment.recordedBy.name})}` : null}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="tabular-nums">{payment.amount.display}</span>
        <StatusText color={paymentStatusColor(payment.status)} className="text-sm">
          {paymentStatusLabel(t, payment.status)}
        </StatusText>
      </span>
    </li>
  );
}
