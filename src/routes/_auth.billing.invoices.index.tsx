import {Suspense, useEffect, useState} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, redirect} from "@tanstack/react-router";
import {Input} from "@yeahuz/kdsx-react";
import {ReceiptText, Search} from "lucide-react";
import {useTranslation} from "react-i18next";
import {listInvoices, listInvoicesOptions, type Invoice, type InvoiceStatus} from "@/api";
import {ExportButton} from "@/components/export-button";
import type {Column} from "@/lib/csv";

let INVOICE_COLUMNS: Column<Invoice>[] = [
  {header: "Number", value: (i) => i.number},
  {header: "Client", value: (i) => i.clientName},
  {header: "Status", value: (i) => i.status},
  {header: "Issued", value: (i) => i.issuedAt.slice(0, 10)},
  {header: "Due", value: (i) => i.dueAt.slice(0, 10)},
  {header: "Paid", value: (i) => i.paidAt?.slice(0, 10)},
  {header: "Total", value: (i) => i.total.majorAmount},
  {header: "Amount due", value: (i) => i.amountDue.majorAmount},
  {header: "Currency", value: (i) => i.total.currency},
  {header: "Provider", value: (i) => i.vendor},
];
import {PageHeader} from "@/components/page-header";
import {FilterSelect} from "@/components/filter-bar";
import {InvoiceRow} from "@/components/billing-rows";
import {EmptyState} from "@/components/empty-state";
import {ListSkeleton} from "@/components/skeletons";
import {Pagination} from "@/components/pagination";
import {useDebounced} from "@/hooks";
import {invoiceStatusLabel} from "@/lib/status";
import {can} from "@/permission";

type Search = {q?: string; status?: InvoiceStatus; page?: number};

export let Route = createFileRoute("/_auth/billing/invoices/")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "billing.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/billing"}};
  },
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: (search.q as string) || undefined,
    status: (search.status as InvoiceStatus) || undefined,
    page: Number(search.page) || undefined,
  }),
  component: Invoices,
});

function Invoices() {
  let {t} = useTranslation();
  let search = Route.useSearch();
  let navigate = Route.useNavigate();
  let [q, setQ] = useState(search.q ?? "");
  let settled = useDebounced(q, 300);

  useEffect(() => {
    if ((settled || undefined) === search.q) return;
    navigate({search: (prev) => ({...prev, q: settled || undefined, page: undefined}), replace: true});
  }, [settled, search.q, navigate]);

  return (
    <div className="flex flex-col gap-8 px-4">
      <PageHeader title={t("billing:invoices", {defaultValue: "Invoices"})}>
        <ExportButton name="invoices" load={() => listInvoices({query: {...search, page: 1, pageSize: 1000}}).then((page) => page.items)} columns={INVOICE_COLUMNS} />
      </PageHeader>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("billing:invoiceSearch", {defaultValue: "Invoice number or client"})}
          startAdornment={<Search size={18} className="text-on-surface-secondary" />}
        />
        <FilterSelect
          label={t("billing:anyStatus", {defaultValue: "Any status"})}
          value={search.status}
          onChange={(status) => navigate({search: (prev) => ({...prev, status: status as InvoiceStatus | undefined, page: undefined})})}
          options={(["open", "paid", "void", "uncollectible", "draft"] as InvoiceStatus[]).map((value) => ({value, label: invoiceStatusLabel(t, value)}))}
        />
      </div>
      <Suspense fallback={<ListSkeleton rows={10} />}>
        <InvoiceList search={search} />
      </Suspense>
    </div>
  );
}

function InvoiceList({search}: {search: Search}) {
  let {t} = useTranslation();
  let {data} = useSuspenseQuery(listInvoicesOptions({query: {...search, pageSize: 30}}));
  if (!data.items.length) return <EmptyState icon={ReceiptText} title={t("billing:noInvoicesMatch", {defaultValue: "No invoices match"})} />;
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-1">
        {data.items.map((invoice) => (
          <InvoiceRow key={invoice.id} invoice={invoice} showClient />
        ))}
      </ul>
      {data.pages > 1 ? <Pagination page={data.page} pages={data.pages} hasNext={data.page < data.pages} hasPrevious={data.page > 1} from="/billing/invoices/" /> : null}
    </div>
  );
}
