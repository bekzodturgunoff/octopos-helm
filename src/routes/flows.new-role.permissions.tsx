import {Suspense} from "react";
import {createFileRoute, redirect} from "@tanstack/react-router";
import {useSuspenseQuery} from "@tanstack/react-query";
import {useTranslation} from "react-i18next";
import {listAccessResourcesOptions} from "@/api";
import {useNewRole} from "@/flow-contexts";
import {PermissionsEditor} from "@/components/permissions-editor";
import {FlowsPageSkeleton} from "@/components/skeletons";

export let Route = createFileRoute("/flows/new-role/permissions")({
  beforeLoad: () => {
    // A reload straight onto step two with no name drafted goes back to step one.
    try {
      let draft = JSON.parse(window.sessionStorage.getItem("flows.new-role") ?? "{}");
      if (!draft.name) throw redirect({to: "/flows/new-role"});
    } catch (err) {
      if (err instanceof SyntaxError) throw redirect({to: "/flows/new-role"});
      throw err;
    }
  },
  loader: ({context}) => {
    context.queryClient.prefetchQuery(listAccessResourcesOptions());
  },
  component: () => (
    <Suspense fallback={<FlowsPageSkeleton rows={6} />}>
      <Permissions />
    </Suspense>
  ),
});

function Permissions() {
  let {t} = useTranslation();
  let navigate = Route.useNavigate();
  let {roleData, setRoleData} = useNewRole();
  let {data} = useSuspenseQuery(listAccessResourcesOptions());

  return (
    <PermissionsEditor
      title={roleData.name}
      resources={data.resources}
      initial={roleData.permissions}
      submitLabel={t("common:continue", {defaultValue: "Continue"})}
      onSubmit={(permissions) => {
        setRoleData((prev) => ({...prev, permissions}));
        navigate({to: "/flows/new-role/summary"});
      }}
    />
  );
}
