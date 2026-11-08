import {createFileRoute, Link} from "@tanstack/react-router";
import {useNewRole} from "@/flow-contexts";
import {ErrorAlert, FixedFooter, Button} from "@yeahuz/kdsx-react";
import {useMutation, useQueryClient, useSuspenseQuery} from "@tanstack/react-query";
import {FormEvent, Suspense} from "react";
import {FlowsPageSkeleton} from "@/components/skeletons";
import {FixedContainer} from "@/components/fixed-container";
import {SuccessState} from "@/components/success-state";
import {PermissionTags} from "@/components/permissions-editor";
import {Field, Fields, Section} from "@/components/field";
import {useTranslation} from "react-i18next";
import {createRoleMutation, listAccessResourcesOptions} from "@/api";

export let Route = createFileRoute("/flows/new-role/summary")({
  loader: ({context}) => {
    context.queryClient.prefetchQuery(listAccessResourcesOptions());
  },
  component: Main,
  validateSearch: (search: Record<string, unknown>): {roleID?: string} => {
    return {
      roleID: (search?.roleID as string) || undefined,
    };
  },
});

function Main() {
  return (
    <Suspense fallback={<FlowsPageSkeleton />}>
      <MainForm />
    </Suspense>
  );
}

function MainForm() {
  let navigate = Route.useNavigate();
  let search = Route.useSearch();
  let {t} = useTranslation();
  let queryClient = useQueryClient();
  let {roleData, reset} = useNewRole();
  let {data} = useSuspenseQuery(listAccessResourcesOptions());
  let {
    mutate: createRole,
    isPending: isCreating,
    error,
  } = useMutation({
    ...createRoleMutation(),
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      navigate({search: {roleID: result.id}});
      reset();
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    createRole({body: roleData});
  }

  return search.roleID ? (
    <FixedContainer>
      <SuccessState title={t("access:roleCreated", {defaultValue: "Role created"})} className="py-16">
        <Button size="lg" asChild>
          <Link to="/administration/roles/$id" params={{id: search.roleID}}>
            {t("access:goToRole", {defaultValue: "Open role"})}
          </Link>
        </Button>
        <Button color="neutral" variant="ghost" size="lg" asChild>
          <Link to="/administration/team">{t("access:assignPeople", {defaultValue: "Give it to someone on the team"})}</Link>
        </Button>
      </SuccessState>
    </FixedContainer>
  ) : (
    <form className="mx-auto flex w-full flex-col px-4 sm:max-w-xl" onSubmit={onSubmit}>
      <h1 className="text-center text-3xl font-semibold tracking-tight">{t("common:summary", {defaultValue: "Summary"})}</h1>
      <div className="mt-10 mb-5 flex flex-1 flex-col gap-8">
        {error ? <ErrorAlert message={error.message} title={t("common:error", {defaultValue: "Error"})} /> : null}
        <Section title={t("access:role", {defaultValue: "Role"})}>
          <Fields>
            <Field label={t("common:name", {defaultValue: "Name"})} value={roleData.name} />
            <Field label={t("common:description", {defaultValue: "Description"})} value={roleData.description || "—"} />
          </Fields>
        </Section>
        <Section title={t("access:permissions", {defaultValue: "Permissions"})}>
          <PermissionTags permissions={roleData.permissions} resources={data.resources} />
        </Section>
      </div>
      <FixedFooter className="z-20 px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:static sm:px-0">
        <Button size="lg" className="w-full" disabled={isCreating || !roleData.permissions.length} loading={isCreating}>
          {t("access:createRole", {defaultValue: "Create role"})}
        </Button>
      </FixedFooter>
    </form>
  );
}
