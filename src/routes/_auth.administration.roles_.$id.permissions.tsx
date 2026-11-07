import {Suspense} from "react";
import {createFileRoute, redirect} from "@tanstack/react-router";
import {useMutation, useSuspenseQueries} from "@tanstack/react-query";
import {getRoleOptions, listAccessResourcesOptions, updateRoleMutation} from "@/api";
import {useTranslation} from "react-i18next";
import {PermissionsEditor} from "@/components/permissions-editor";
import {FormPageSkeleton} from "@/components/skeletons";
import {useToast} from "@/components/toaster";
import {can} from "@/permission";

export let Route = createFileRoute("/_auth/administration/roles_/$id/permissions")({
  beforeLoad: ({context, params}) => {
    if (!can(context.user, "role.write")) throw redirect({to: "/403"});
    return {backLink: {to: "/administration/roles/$id", params}};
  },
  loader: ({context, params}) => {
    context.queryClient.prefetchQuery(getRoleOptions({query: {id: params.id}}));
    context.queryClient.prefetchQuery(listAccessResourcesOptions());
  },
  component: () => (
    <Suspense fallback={<FormPageSkeleton rows={6} />}>
      <Permissions />
    </Suspense>
  ),
});

function Permissions() {
  let routeCtx = Route.useRouteContext();
  let navigate = Route.useNavigate();
  let params = Route.useParams();
  let {t} = useTranslation();
  let toast = useToast();
  let [{data: role}, {data: catalog}] = useSuspenseQueries({
    queries: [getRoleOptions({query: {id: params.id}}), listAccessResourcesOptions()],
  });
  let {mutate, isPending, error} = useMutation({
    ...updateRoleMutation(),
    onSuccess: async () => {
      // A role change can change what the signed-in operator may do, so everything is re-read.
      await routeCtx.queryClient.invalidateQueries();
      toast({tone: "success", title: t("access:permissionsSaved", {defaultValue: "Permissions saved"})});
      navigate({to: "/administration/roles/$id", params});
    },
  });

  return (
    <PermissionsEditor
      title={role.name}
      resources={catalog.resources}
      initial={role.permissions}
      submitLabel={t("common:saveChanges", {defaultValue: "Save changes"})}
      pending={isPending}
      error={error?.message}
      onSubmit={(permissions) => mutate({body: {id: params.id, permissions}})}
    />
  );
}
