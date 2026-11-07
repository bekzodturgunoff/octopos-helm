import {EmptyState} from "@/components/empty-state";
import {Suspense} from "react";
import {createFileRoute, redirect} from "@tanstack/react-router";
import {useSuspenseQuery} from "@tanstack/react-query";
import {Button, NavOption, NavOptionAdornmentWithBg} from "@yeahuz/kdsx-react";
import {NavLink} from "@/components/nav-link";
import {useTranslation} from "react-i18next";
import {listRolesOptions} from "@/api";
import {Vault} from "lucide-react";
import {can, Can} from "@/permission";
import {ListSkeleton} from "@/components/skeletons";

export let Route = createFileRoute("/_auth/administration/roles/")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "role.read")) {
      throw redirect({to: "/403"});
    }
    return {
      backLink: {to: "/administration"},
    };
  },
  loader: ({context}) => {
    context.queryClient.prefetchQuery(listRolesOptions());
  },
  component: Roles,
});

function Roles() {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();

  return (
    <div className="flex flex-col gap-10 px-4">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{t("access:roles", {defaultValue: "Roles"})}</h1>
        <Can subject={user} capability="role.write">
          <Button className="max-w-fit" size="sm" color="brand" asChild>
            <NavLink to="/flows/new-role">{t("access:newRole", {defaultValue: "New role"})}</NavLink>
          </Button>
        </Can>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <RoleList />
      </Suspense>
    </div>
  );
}

function RoleList() {
  let {t} = useTranslation();
  let {data} = useSuspenseQuery(listRolesOptions());

  if (!data.roles.length) {
    return <EmptyState icon={Vault} title={t("access:noRoles", {defaultValue: "No roles yet"})} />;
  }

  return (
    <ul className="flex flex-col px-2">
      {data.roles.map((role) => (
        <li key={role.id}>
          <NavLink to="/administration/roles/$id" params={{id: role.id}}>
            <NavOption
              startAdornment={
                <NavOptionAdornmentWithBg>
                  <span className="font-semibold uppercase">
                    {role.name.slice(0, 1)}
                    {role.name.slice(-1)}
                  </span>
                </NavOptionAdornmentWithBg>
              }
              title={role.name}
              subtitle={[
                role.description,
                role.memberCount === 1 ? t("access:memberOne", {defaultValue: "1 person"}) : t("access:memberCount", {defaultValue: "{{count}} people", count: role.memberCount}),
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
