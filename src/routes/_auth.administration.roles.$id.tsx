import {Suspense} from "react";
import {can, Can} from "@/permission";
import {createFileRoute, redirect} from "@tanstack/react-router";
import {useMutation, useQueryClient, useSuspenseQueries} from "@tanstack/react-query";
import {FixedFooter, ErrorAlert, Button, ConfirmationAlert} from "@yeahuz/kdsx-react";
import {Show} from "@yeahuz/kdsx-react";
import {NavLink} from "@/components/nav-link";
import {useTranslation} from "react-i18next";
import {deleteRoleMutation, getRoleOptions, listAccessResourcesOptions, listOperatorsOptions} from "@/api";
import {SectionHeader} from "@/components/form-section";
import {DetailPageSkeleton} from "@/components/skeletons";
import {PermissionTags} from "@/components/permissions-editor";
import {Field, Fields} from "@/components/field";
import {initials} from "@/lib/format";
import {useStepUp} from "@/components/step-up";

export let Route = createFileRoute("/_auth/administration/roles/$id")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "role.read")) {
      throw redirect({to: "/403"});
    }
    return {
      backLink: {to: "/administration/roles"},
    };
  },
  loader: ({context, params}) => {
    context.queryClient.prefetchQuery(getRoleOptions({query: {id: params.id}}));
    context.queryClient.prefetchQuery(listAccessResourcesOptions());
  },
  component: () => (
    <Suspense fallback={<DetailPageSkeleton sections={3} />}>
      <SingleRole />
    </Suspense>
  ),
});

function SingleRole() {
  let navigate = Route.useNavigate();
  let params = Route.useParams();
  let {user} = Route.useRouteContext();
  let {t} = useTranslation();
  let queryClient = useQueryClient();
  let [{data: role}, {data: catalog}, {data: team}] = useSuspenseQueries({
    queries: [getRoleOptions({query: {id: params.id}}), listAccessResourcesOptions(), listOperatorsOptions()],
  });
  let members = team.operators.filter((o) => o.role.id === role.id);
  let writes = can(user, "role.write");

  let stepUp = useStepUp();
  let {
    mutate: deleteRole,
    isPending: isDeleting,
    error,
  } = useMutation({
    // Deleting a role is one of the confirmed actions; a 428 asks for a code and tries again.
    mutationFn: (options: {body: {id: string}}) => stepUp(() => deleteRoleMutation().mutationFn(options)),
    onSuccess: () => {
      queryClient.invalidateQueries(listRolesKey());
      navigate({to: "/administration/roles"});
    },
  });

  return (
    <div className="flex flex-col gap-10 px-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">{role.name}</h1>
          {error ? <ErrorAlert message={error.message} title={t("common:error", {defaultValue: "Error"})} /> : null}
          <Show when={writes && !role.internal}>
            <FixedFooter className="px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:static sm:px-0">
              <ConfirmationAlert
                title={`${t("common:delete", {defaultValue: "Delete"})} ${role.name}`}
                description={
                  role.memberCount
                    ? t("access:deleteRoleInUse", {defaultValue: "{{count}} people have this role. Move them to another role first, or the delete will be refused.", count: role.memberCount})
                    : t("access:deleteThisRole", {defaultValue: "This role will be removed. This cannot be undone."})
                }
                trigger={
                  <div>
                    <Button className="hidden sm:inline-flex" size="sm" color="danger" variant="outline">
                      {t("access:deleteRole", {defaultValue: "Delete role"})}
                    </Button>
                    <Button className="w-full sm:hidden" size="lg" color="danger" variant="fill">
                      {t("access:deleteRole", {defaultValue: "Delete role"})}
                    </Button>
                  </div>
                }
                action={
                  <Button size="lg" color="danger" variant="fill" disabled={isDeleting} loading={isDeleting} onClick={() => deleteRole({body: {id: params.id}})}>
                    {t("common:delete", {defaultValue: "Delete"})}
                  </Button>
                }
              />
            </FixedFooter>
          </Show>
        </div>
      </div>
      <section className="flex flex-col gap-4">
        <SectionHeader
          title={t("access:role", {defaultValue: "Role"})}
          action={
            writes ? (
              <Button color="brand" variant="link" size="none" asChild>
                <NavLink to="/administration/roles/$id/details" params={params}>
                  {t("common:edit", {defaultValue: "Edit"})}
                </NavLink>
              </Button>
            ) : null
          }
        />
        <Fields>
          <Field label={t("common:name", {defaultValue: "Name"})} value={role.name} />
          <Show when={role.description}>
            <Field label={t("common:description", {defaultValue: "Description"})} value={role.description} />
          </Show>
        </Fields>
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeader
          title={t("access:permissions", {defaultValue: "Permissions"})}
          action={
            writes && !role.internal ? (
              <Button color="brand" variant="link" size="none" asChild>
                <NavLink to="/administration/roles/$id/permissions" params={params}>
                  {t("common:edit", {defaultValue: "Edit"})}
                </NavLink>
              </Button>
            ) : null
          }
        />
        <PermissionTags permissions={role.permissions} resources={catalog.resources} />
        {role.internal ? (
          <p className="text-on-surface-secondary text-xs">{t("access:internalRole", {defaultValue: "Built in. Its permissions cannot be changed, so the team can never lock itself out."})}</p>
        ) : null}
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeader
          title={t("access:members", {defaultValue: "People with this role"})}
          action={
            <Can subject={user} capability="team.write">
              <Button color="brand" variant="link" size="none" asChild>
                <NavLink to="/administration/team">{t("access:manageTeam", {defaultValue: "Manage team"})}</NavLink>
              </Button>
            </Can>
          }
        />
        {members.length ? (
          <ul className="flex flex-col gap-1">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 py-2">
                <span className="bg-neutral flex size-9 shrink-0 items-center justify-center rounded-full text-xs">{initials(`${member.firstName} ${member.lastName}`)}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">
                    {member.firstName} {member.lastName}
                  </span>
                  <span className="text-on-surface-secondary truncate text-sm">
                    {member.email} · {t(`team:status.${member.status}`, {defaultValue: member.status})}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-on-surface-secondary text-sm">{t("access:noMembers", {defaultValue: "Nobody has this role yet."})}</span>
        )}
      </section>
    </div>
  );
}

function listRolesKey() {
  return {predicate: (query: {queryKey: readonly unknown[]}) => ["listRoles", "getRole", "listOperators"].includes((query.queryKey[0] as {_id?: string})?._id ?? "")};
}
