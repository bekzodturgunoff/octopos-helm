import {FlowsHeader, Step} from "@/components/flows-header";
import {useSessionState} from "@/hooks";
import {createFileRoute, Outlet, redirect} from "@tanstack/react-router";
import {CreateRoleData, getSignedInOperatorOptions} from "@/api";
import {useTranslation} from "react-i18next";
import {can} from "@/permission";
import {NewRoleContext, useNewRole} from "@/flow-contexts";

export let Route = createFileRoute("/flows/new-role")({
  beforeLoad: async ({context}) => {
    let user = await context.queryClient.ensureQueryData(getSignedInOperatorOptions()).catch(() => {
      throw redirect({to: "/login", search: {redirect: "/flows/new-role"}});
    });
    if (!can(user, "role.write")) {
      throw redirect({to: "/403"});
    }
  },
  component: NewRole,
});

let EMPTY: CreateRoleData = {name: "", description: "", permissions: []};

function NewRoleContextProvider({children}: {children: React.ReactNode}) {
  let [roleData, setRoleData, reset] = useSessionState<CreateRoleData>("flows.new-role", EMPTY);
  return <NewRoleContext.Provider value={{roleData, setRoleData, reset}}>{children}</NewRoleContext.Provider>;
}

function InnerNewRole() {
  let {reset} = useNewRole();
  let {t} = useTranslation();

  let steps: Step[] = [
    {label: t("common:name", {defaultValue: "Name"}), pathname: "/flows/new-role"},
    {label: t("access:permissions", {defaultValue: "Permissions"}), pathname: "/flows/new-role/permissions"},
    {label: t("common:summary", {defaultValue: "Summary"}), pathname: "/flows/new-role/summary"},
  ];

  return (
    <>
      <FlowsHeader steps={steps} onClose={reset} />
      <div className="mx-auto flex w-full flex-col items-center gap-5 pt-10">
        <Outlet />
      </div>
    </>
  );
}

function NewRole() {
  return (
    <NewRoleContextProvider>
      <InnerNewRole />
    </NewRoleContextProvider>
  );
}
