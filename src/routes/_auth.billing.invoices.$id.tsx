import {Suspense} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {Button, Tag} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";
import {getInvoiceOptions, getClientOptions, type Invoice} from "@/api";
import {DetailPageSkeleton} from "@/components/skeletons";
import {Field, Fields, Section} from "@/components/field";
import {PayLinkButtons, PromiseDialog, RecordPaymentDialog, SendReminderDialog, VoidInvoiceDialog} from "@/components/client-actions";
import {invoiceStatusColor, invoiceStatusLabel, tagColor, vendorLabel} from "@/lib/status";
import {formatDate} from "@/lib/format";
import {can} from "@/permission";

let SOURCE: Record<Invoice["source"], string> = {subscriptionRenewal: "Renewal", subscriptionUpgrade: "Plan upgrade", addonChange: "Add-on change", usage: "Usage"};

export let Route = createFileRoute("/_auth/billing/invoices/$id")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "billing.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/billing/invoices"}};
  },
  loader: ({context, params}) => {
    context.queryClient.prefetchQuery(getInvoiceOptions({query: {id: params.id}}));
  },
  component: () => (
    <Suspense fallback={<DetailPageSkeleton sections={2} />}>
      <InvoicePage />
    </Suspense>
  ),
});

function InvoicePage() {
  let {t} = useTranslation();
  let {id} = Route.useParams();
  let {user} = Route.useRouteContext();
  let {data: invoice} = useSuspenseQuery(getInvoiceOptions({query: {id}}));
  let {data: client} = useSuspenseQuery(getClientOptions({query: {id: invoice.clientID}}));
  let writes = can(user, "billing.write") && invoice.status === "open";

  return (
    <div className="flex flex-col gap-10 px-4">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{invoice.number}</h1>
          <Link to="/clients/$id" params={{id: invoice.clientID}} className="text-on-surface-secondary mt-1 inline-block text-sm hover:underline">
            {invoice.clientName}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tag color={tagColor(invoiceStatusColor(invoice.status))}>{invoiceStatusLabel(t, invoice.status)}</Tag>
          <Tag color="neutral">{vendorLabel(invoice.vendor)}</Tag>
        </div>
        {writes ? (
          <div className="flex flex-wrap gap-2">
            <RecordPaymentDialog
              invoice={invoice}
              trigger={
                <Button size="sm" color="brand">
                  {t("billing:recordPayment", {defaultValue: "Record payment"})}
                </Button>
              }
            />
            <SendReminderDialog
              clientID={client.id}
              invoice={invoice}
              ownerName={client.owner.name}
              trigger={
                <Button size="sm" color="neutral">
                  {t("billing:remind", {defaultValue: "Remind"})}
                </Button>
              }
            />
            <PromiseDialog
              invoice={invoice}
              trigger={
                <Button size="sm" color="neutral">
                  {t("billing:promiseToPay", {defaultValue: "Promise to pay"})}
                </Button>
              }
            />
            <VoidInvoiceDialog
              invoice={invoice}
              trigger={
                <Button size="sm" color="neutral" variant="ghost">
                  {t("billing:void", {defaultValue: "Void"})}
                </Button>
              }
            />
          </div>
        ) : null}
        {writes ? <PayLinkButtons invoice={invoice} /> : null}
      </div>
      <Section title={t("billing:details", {defaultValue: "Details"})}>
        <Fields>
          <Field label={t("billing:issuedAt", {defaultValue: "Issued"})} value={formatDate(invoice.issuedAt)} />
          <Field label={t("billing:dueAt", {defaultValue: "Due"})} value={formatDate(invoice.dueAt)} />
          <Field label={t("billing:paidAt", {defaultValue: "Paid"})} value={formatDate(invoice.paidAt)} />
          <Field label={t("billing:source", {defaultValue: "Source"})} value={t(`billing:invoiceSource.${invoice.source}`, {defaultValue: SOURCE[invoice.source]})} />
          <Field label={t("billing:total", {defaultValue: "Total"})} value={invoice.total.display} />
          <Field
            label={t("billing:amountDue", {defaultValue: "Amount due"})}
            value={<span className={invoice.amountDue.majorAmount ? "text-error-bright" : undefined}>{invoice.amountDue.display}</span>}
          />
        </Fields>
      </Section>
      <Section title={t("billing:lines", {defaultValue: "Lines"})}>
        <ul className="flex flex-col">
          {invoice.lines.map((line, i) => (
            <li key={i} className="border-b-border-secondary flex justify-between gap-4 border-b py-3 last:border-b-0">
              <span className="flex flex-col">
                <span>{line.description}</span>
                <span className="text-on-surface-secondary text-sm">
                  {line.quantity} × {line.unitAmount.display}
                </span>
              </span>
              <span className="tabular-nums">{line.amount.display}</span>
            </li>
          ))}
          <li className="flex justify-between gap-4 pt-3 font-semibold">
            <span>{t("billing:total", {defaultValue: "Total"})}</span>
            <span className="tabular-nums">{invoice.total.display}</span>
          </li>
        </ul>
      </Section>
    </div>
  );
}
