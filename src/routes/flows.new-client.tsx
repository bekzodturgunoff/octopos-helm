import {FormEvent, useEffect, useState} from "react";
import {useMutation, useQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {Button, ErrorAlert, FixedFooter, Input, PhoneInput, RadioCard, Select} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";
import {checkClientSlugOptions, createClientMutation, getSignedInOperatorOptions, listOperatorsOptions, listPlansOptions, type BillingCycle, type BusinessType, type ClientDetail} from "@/api";
import {FlowsHeader} from "@/components/flows-header";
import {FixedContainer} from "@/components/fixed-container";
import {SuccessState} from "@/components/success-state";
import {FormField} from "@/components/form-dialog";
import {SectionHeader} from "@/components/form-section";
import {can} from "@/permission";
import {DashLink} from "@/components/dash-link";
import {DASH_DOMAIN, dashUrl, SLUG_PATTERN, slugify} from "@/lib/dash";
import {Check, TriangleAlert} from "lucide-react";

export let Route = createFileRoute("/flows/new-client")({
  beforeLoad: async ({context}) => {
    let user = await context.queryClient.ensureQueryData(getSignedInOperatorOptions()).catch(() => {
      throw redirect({to: "/login", search: {redirect: "/flows/new-client"}});
    });
    if (!can(user, "client.write")) throw redirect({to: "/403"});
  },
  component: NewClient,
});

let BUSINESS_TYPES: {value: BusinessType; label: string}[] = [
  {value: "restaurant", label: "Restaurant"},
  {value: "cafe", label: "Cafe"},
  {value: "fastFood", label: "Fast food"},
  {value: "bar", label: "Bar"},
  {value: "bakery", label: "Bakery"},
  {value: "retail", label: "Retail"},
  {value: "other", label: "Other"},
];

function NewClient() {
  let {t} = useTranslation();
  let {data: plans} = useQuery(listPlansOptions());
  let {data: team} = useQuery(listOperatorsOptions());
  let [name, setName] = useState("");
  let [slug, setSlug] = useState("");
  // Follows the name until someone edits the address by hand.
  let [slugTouched, setSlugTouched] = useState(false);
  // Asks the server once typing pauses, not on every key.
  let [checking, setChecking] = useState("");
  useEffect(() => {
    let timer = setTimeout(() => setChecking(slug), 350);
    return () => clearTimeout(timer);
  }, [slug]);
  let valid = SLUG_PATTERN.test(slug);
  let {data: check} = useQuery({...checkClientSlugOptions({query: {slug: checking}}), enabled: valid && checking === slug});
  let taken = check && check.slug === slug && !check.available;
  let [created, setCreated] = useState<ClientDetail>();
  let {mutate, isPending, error} = useMutation({...createClientMutation(), onSuccess: setCreated});

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid || taken) {
      document.getElementById("slug")?.focus();
      return;
    }
    let data = new FormData(e.target as HTMLFormElement);
    let get = (key: string) => ((data.get(key) as string | null) ?? "").trim();
    mutate({
      body: {
        name: get("name"),
        slug: get("slug"),
        businessType: get("businessType") as BusinessType,
        city: get("city") || undefined,
        owner: {name: get("ownerName"), phone: get("ownerPhone") || undefined, email: get("ownerEmail") || undefined, telegram: get("ownerTelegram") || undefined, role: "Owner"},
        planID: get("planID"),
        billingCycle: get("billingCycle") as BillingCycle,
        trialDays: Number(get("trialDays")),
        accountManagerID: get("accountManagerID") || undefined,
      },
    });
  }

  if (created) {
    return (
      <FixedContainer>
        <SuccessState title={t("clients:clientCreated", {defaultValue: "{{name}} is set up", name: created.name})} className="py-16">
          <p className="text-on-surface-secondary text-center text-sm">{t("clients:clientCreatedHint2", {defaultValue: "Send the owner their dash link and login, then book the install."})}</p>
          <DashLink slug={created.slug} className="mb-4 justify-center" />
          <Button size="lg" asChild>
            <Link to="/clients/$id" params={{id: created.id}}>
              {t("clients:goToClient", {defaultValue: "Open client"})}
            </Link>
          </Button>
          <Button color="neutral" variant="ghost" size="lg" onClick={() => setCreated(undefined)}>
            {t("common:createNew", {defaultValue: "Create another"})}
          </Button>
        </SuccessState>
      </FixedContainer>
    );
  }

  return (
    <>
      <FlowsHeader />
      <form className="mx-auto flex w-full flex-col px-4 sm:max-w-lg" onSubmit={onSubmit}>
        <h1 className="text-center text-3xl font-semibold tracking-tight">{t("clients:newClient", {defaultValue: "New client"})}</h1>
        <div className="mt-10 mb-5 flex flex-1 flex-col gap-8">
          {error ? <ErrorAlert message={error.message} title={t("common:error", {defaultValue: "Error"})} /> : null}

          <div className="flex flex-col gap-5">
            <SectionHeader title={t("clients:business", {defaultValue: "Business"})} />
            <FormField label={t("clients:businessName", {defaultValue: "Business name"})} htmlFor="name">
              <Input
                size="lg"
                id="name"
                name="name"
                required
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            </FormField>
            <FormField label={t("clients:dashAddress", {defaultValue: "Dash address"})} htmlFor="slug">
              <div className="flex items-center gap-1">
                <Input
                  size="lg"
                  id="slug"
                  name="slug"
                  required
                  value={slug}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "")
                        .slice(0, 40),
                    );
                  }}
                  className="min-w-0 flex-1 font-mono"
                />
                <span className="text-on-surface-secondary shrink-0 font-mono text-sm">.{DASH_DOMAIN}</span>
              </div>
              {!slug ? (
                <span className="text-on-surface-secondary text-xs">{t("clients:dashAddressHint", {defaultValue: "Filled in from the name. The owner opens their dash here."})}</span>
              ) : !valid ? (
                <span className="text-error-bright flex items-center gap-1.5 text-xs">
                  <TriangleAlert size={14} /> {t("clients:dashAddressInvalid", {defaultValue: "3–40 Latin letters, digits or dashes."})}
                </span>
              ) : taken ? (
                <span className="text-error-bright flex flex-wrap items-center gap-x-1.5 text-xs">
                  <TriangleAlert size={14} />
                  {check?.reason === "reserved"
                    ? t("clients:dashAddressReserved", {defaultValue: "This address is reserved."})
                    : t("clients:dashAddressTaken", {defaultValue: "Another client already has this address."})}
                  {check?.suggestion ? (
                    <button
                      type="button"
                      className="text-on-surface underline underline-offset-2"
                      onClick={() => {
                        setSlugTouched(true);
                        if (check?.suggestion) setSlug(check.suggestion);
                      }}
                    >
                      {t("clients:useSuggestion", {defaultValue: "Use {{slug}}", slug: check?.suggestion})}
                    </button>
                  ) : null}
                </span>
              ) : check?.slug === slug ? (
                <span className="text-on-surface-green flex items-center gap-1.5 text-xs">
                  <Check size={14} /> {t("clients:dashAddressFree", {defaultValue: "Free · {{url}}", url: dashUrl(slug).replace("https://", "")})}
                </span>
              ) : (
                <span className="text-on-surface-secondary text-xs">{t("clients:dashAddressChecking", {defaultValue: "Checking…"})}</span>
              )}
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("clients:businessType", {defaultValue: "Type"})} htmlFor="businessType">
                <Select size="lg" id="businessType" name="businessType" defaultValue="restaurant">
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {t(`clients:businessTypes.${type.value}`, {defaultValue: type.label})}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label={t("clients:city", {defaultValue: "City"})} htmlFor="city">
                <Input size="lg" id="city" name="city" defaultValue="Tashkent" />
              </FormField>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <SectionHeader title={t("clients:owner", {defaultValue: "Owner"})} />
            <FormField label={t("common:fullName", {defaultValue: "Full name"})} htmlFor="ownerName">
              <Input size="lg" id="ownerName" name="ownerName" required />
            </FormField>
            <FormField label={t("common:phone", {defaultValue: "Phone"})} htmlFor="ownerPhone">
              <PhoneInput size="lg" id="ownerPhone" name="ownerPhone" defaultValue="+998" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("common:email", {defaultValue: "Email"})} htmlFor="ownerEmail">
                <Input size="lg" id="ownerEmail" name="ownerEmail" type="email" />
              </FormField>
              <FormField label="Telegram" htmlFor="ownerTelegram">
                <Input size="lg" id="ownerTelegram" name="ownerTelegram" placeholder="@username" />
              </FormField>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <SectionHeader title={t("billing:plan", {defaultValue: "Plan"})} />
            <div className="flex flex-col gap-2">
              {plans?.plans.map((plan, i) => (
                <RadioCard key={plan.id} name="planID" value={plan.id} defaultChecked={i === 1} required>
                  <span className="flex w-full min-w-0 items-center justify-between gap-3">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{plan.name}</span>
                      <span className="text-on-surface-secondary text-xs">
                        {plan.features
                          .slice(0, 4)
                          .map((f) => f.key)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm whitespace-nowrap tabular-nums">{plan.prices.find((p) => p.billingCycle === "monthly")?.value.display}</span>
                  </span>
                </RadioCard>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("billing:cycle", {defaultValue: "Billing cycle"})} htmlFor="billingCycle">
                <Select size="lg" id="billingCycle" name="billingCycle" defaultValue="monthly">
                  <option value="monthly">{t("billing:monthly", {defaultValue: "Monthly"})}</option>
                  <option value="yearly">{t("billing:yearly", {defaultValue: "Yearly (2 months free)"})}</option>
                </Select>
              </FormField>
              <FormField label={t("billing:trial", {defaultValue: "Trial"})} htmlFor="trialDays">
                <Select size="lg" id="trialDays" name="trialDays" defaultValue="14">
                  <option value="0">{t("billing:noTrial", {defaultValue: "No trial"})}</option>
                  <option value="7">{t("billing:daysCount", {defaultValue: "{{count}} days", count: 7})}</option>
                  <option value="14">{t("billing:daysCount", {defaultValue: "{{count}} days", count: 14})}</option>
                  <option value="30">{t("billing:daysCount", {defaultValue: "{{count}} days", count: 30})}</option>
                </Select>
              </FormField>
            </div>
            <FormField label={t("clients:accountManager", {defaultValue: "Account manager"})} htmlFor="accountManagerID">
              <Select size="lg" id="accountManagerID" name="accountManagerID" defaultValue="">
                <option value="">{t("common:unassigned", {defaultValue: "Unassigned"})}</option>
                {team?.operators
                  .filter((o) => o.status === "active")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.firstName} {o.lastName}
                    </option>
                  ))}
              </Select>
            </FormField>
          </div>
        </div>
        <FixedFooter className="z-20 px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:static sm:px-0">
          <Button size="lg" className="w-full" disabled={isPending} loading={isPending}>
            {t("clients:createClient", {defaultValue: "Create client"})}
          </Button>
        </FixedFooter>
      </form>
    </>
  );
}
