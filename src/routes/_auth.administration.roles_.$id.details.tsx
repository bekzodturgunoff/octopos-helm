import {createFileRoute, redirect} from "@tanstack/react-router";
import {useMutation, useSuspenseQuery} from "@tanstack/react-query";
import {FormEvent, Suspense} from "react";
import {FixedFooter, ErrorAlert, Button, Input, Label, Textarea} from "@yeahuz/kdsx-react";
import {FormPageSkeleton} from "@/components/skeletons";
import {useTranslation} from "react-i18next";
import {getRoleOptions, updateRoleMutation} from "@/api";
import {can} from "@/permission";

export let Route = createFileRoute("/_auth/administration/roles_/$id/details")({
  beforeLoad: ({context, params}) => {
    if (!can(context.user, "role.write")) throw redirect({to: "/403"});
    return {backLink: {to: "/administration/roles/$id", params}};
  },
  loader: ({context, params}) => {
    context.queryClient.prefetchQuery(getRoleOptions({query: {id: params.id}}));
  },
  component: Details,
});

function Details() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <DetailsForm />
    </Suspense>
  );
}

function DetailsForm() {
  let routeCtx = Route.useRouteContext();
  let navigate = Route.useNavigate();
  let params = Route.useParams();
  let {data: role} = useSuspenseQuery(getRoleOptions({query: {id: params.id}}));
  let {t} = useTranslation();

  let {
    mutate: updateRole,
    isPending: isUpdating,
    error,
  } = useMutation({
    ...updateRoleMutation(),
    onSuccess: () => {
      routeCtx.queryClient.invalidateQueries();
      navigate({to: "/administration/roles/$id", params});
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let data = new FormData(e.target as HTMLFormElement);
    updateRole({body: {id: params.id, name: data.get("name") as string, description: data.get("description") as string}});
  }

  return (
    <form className="flex flex-col px-4 sm:max-w-md" onSubmit={onSubmit}>
      <h1 className="text-3xl font-semibold tracking-tight">{role.name}</h1>
      <div className="mt-10 mb-5 flex flex-col gap-5">
        {error ? <ErrorAlert message={error.message} title={t("common:error", {defaultValue: "Error"})} /> : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{t("common:name", {defaultValue: "Name"})}</Label>
          <Input size="lg" id="name" name="name" defaultValue={role.name} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">{t("access:descriptionOptional", {defaultValue: "Description (optional)"})}</Label>
          <Textarea id="description" name="description" rows={3} defaultValue={role.description} />
        </div>
      </div>
      <FixedFooter className="z-20 px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:static sm:px-0">
        <Button size="lg" color="brand" className="w-full" variant="fill" disabled={isUpdating} loading={isUpdating}>
          {t("common:saveChanges", {defaultValue: "Save changes"})}
        </Button>
      </FixedFooter>
    </form>
  );
}
