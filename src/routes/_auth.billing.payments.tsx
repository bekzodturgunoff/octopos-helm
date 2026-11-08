import {Suspense} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, redirect} from "@tanstack/react-router";
import {CreditCard} from "lucide-react";
import {useTranslation} from "react-i18next";
import {listPayments, listPaymentsOptions, type BillingVendor, type Payment, type PaymentStatus} from "@/api";
import {ExportButton} from "@/components/export-button";
import type {Column} from "@/lib/csv";

let PAYMENT_COLUMNS: Column<Payment>[] = [
  {header: "Date", value: (p) => p.createdAt.slice(0, 10)},
  {header: "Client", value: (p) => p.clientName},
  {header: "Invoice", value: (p) => p.invoiceNumber},
  {header: "Amount", value: (p) => p.amount.majorAmount},
  {header: "Currency", value: (p) => p.amount.currency},
  {header: "Provider", value: (p) => p.vendor},
  {header: "Method", value: (p) => p.method},
  {header: "Status", value: (p) => p.status},
  {header: "Failure reason", value: (p) => p.failureReason},
  {header: "Recorded by", value: (p) => p.recordedBy?.name},
];
import {PageHeader} from "@/components/page-header";
import {FilterSelect} from "@/components/filter-bar";
import {PaymentRow} from "@/components/billing-rows";
import {EmptyState} from "@/components/empty-state";
import {ListSkeleton} from "@/components/skeletons";
import {Pagination} from "@/components/pagination";
import {paymentStatusLabel, vendorLabel} from "@/lib/status";
import {can} from "@/permission";

type Search = {status?: PaymentStatus; vendor?: BillingVendor; page?: number};

export let Route = createFileRoute("/_auth/billing/payments")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "billing.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/billing"}};
  },
  validateSearch: (search: Record<string, unknown>): Search => ({
    status: (search.status as PaymentStatus) || undefined,
    vendor: (search.vendor as BillingVendor) || undefined,
    page: Number(search.page) || undefined,
  }),
  component: Payments,
});

function Payments() {
  let {t} = useTranslation();
  let search = Route.useSearch();
  let navigate = Route.useNavigate();
  return (
    <div className="flex flex-col gap-8 px-4">
      <PageHeader
        title={t("billing:payments", {defaultValue: "Payments"})}
        subtitle={t("billing:paymentsHint", {defaultValue: "Failed charges stay here with the provider's reason, so a call can start with it."})}
      >
        <ExportButton name="payments" load={() => listPayments({query: {...search, page: 1, pageSize: 1000}}).then((page) => page.items)} columns={PAYMENT_COLUMNS} />
      </PageHeader>
      <div className="flex flex-wrap gap-2">
        <FilterSelect
          label={t("billing:anyStatus", {defaultValue: "Any status"})}
          value={search.status}
          onChange={(status) => navigate({search: (prev) => ({...prev, status: status as PaymentStatus | undefined, page: undefined})})}
          options={(["succeeded", "failed", "pending", "refunded"] as PaymentStatus[]).map((value) => ({value, label: paymentStatusLabel(t, value)}))}
        />
        <FilterSelect
          label={t("billing:anyProvider", {defaultValue: "Any provider"})}
          value={search.vendor}
          onChange={(vendor) => navigate({search: (prev) => ({...prev, vendor: vendor as BillingVendor | undefined, page: undefined})})}
          options={(["click", "payme", "none"] as BillingVendor[]).map((value) => ({value, label: vendorLabel(value)}))}
        />
      </div>
      <Suspense fallback={<ListSkeleton rows={10} />}>
        <PaymentList search={search} />
      </Suspense>
    </div>
  );
}

function PaymentList({search}: {search: Search}) {
  let {t} = useTranslation();
  let {data} = useSuspenseQuery(listPaymentsOptions({query: {...search, pageSize: 30}}));
  if (!data.items.length) return <EmptyState icon={CreditCard} title={t("billing:noPaymentsMatch", {defaultValue: "No payments match"})} />;
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-1">
        {data.items.map((payment) => (
          <PaymentRow key={payment.id} payment={payment} />
        ))}
      </ul>
      {data.pages > 1 ? <Pagination page={data.page} pages={data.pages} hasNext={data.page < data.pages} hasPrevious={data.page > 1} from="/billing/payments" /> : null}
    </div>
  );
}
