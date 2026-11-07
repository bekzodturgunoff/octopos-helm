import {Suspense} from "react";
import {useQuery, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {Button, Input, Select} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";
import {inviteOperatorMutation, listOperatorsOptions, listRolesOptions, updateOperatorMutation, type Operator, type OperatorStatus} from "@/api";
import {PageHeader} from "@/components/page-header";
import {FormDialog, FormField} from "@/components/form-dialog";
import {StatusText} from "@/components/status-text";
import {ListSkeleton} from "@/components/skeletons";
import {formatRelative, initials} from "@/lib/format";
import {can, Can} from "@/permission";

export let Route = createFileRoute("/_auth/administration/team")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "team.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/administration"}};
  },
  component: Team,
});

function Team() {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  return (
    <div className="flex flex-col gap-10 px-4">
      <PageHeader
        title={t("team:team", {defaultValue: "Team"})}
        subtitle={t("team:teamHint", {defaultValue: "Everyone at Octopos who can sign in to Helm. What each person may do comes from their role."})}
      >
        <Can subject={user} capability="team.write">
          <InviteDialog />
        </Can>
        <Can subject={user} capability="role.read">
          <Button size="sm" color="brand" variant="outline" asChild>
            <Link to="/administration/roles">{t("access:accessControl", {defaultValue: "Access control"})}</Link>
          </Button>
        </Can>
      </PageHeader>
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <Members />
      </Suspense>
    </div>
  );
}

function statusColor(status: OperatorStatus) {
  return status === "active" ? "green" : status === "invited" ? "blue" : "neutral";
}

function Members() {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let {data} = useSuspenseQuery(listOperatorsOptions());
  return (
    <ul className="flex flex-col gap-1">
      {data.operators.map((operator) => (
        <li key={operator.id} className="flex items-center gap-3 rounded-xl px-2 py-3">
          <span className="bg-neutral flex size-10 shrink-0 items-center justify-center rounded-full text-sm">{initials(`${operator.firstName} ${operator.lastName}`)}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">
              {operator.firstName} {operator.lastName} {operator.id === user.id ? <span className="text-on-surface-secondary text-sm">({t("team:you", {defaultValue: "you"})})</span> : null}
            </span>
            <span className="text-on-surface-secondary truncate text-sm">
              {operator.email}
              {operator.lastSeenAt ? ` · ${t("team:seen", {defaultValue: "seen {{when}}", when: formatRelative(operator.lastSeenAt)})}` : null}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-0.5 text-sm">
            {can(user, "role.read") ? (
              <Link to="/administration/roles/$id" params={{id: operator.role.id}} className="hover:underline">
                {operator.role.name}
              </Link>
            ) : (
              <span>{operator.role.name}</span>
            )}
            <span className="flex items-center gap-2">
              {operator.status === "active" ? (
                <span className={operator.twoFactorEnabled ? "text-on-surface-green text-xs" : "text-on-surface-yellow text-xs"}>
                  {operator.twoFactorEnabled ? "2FA" : t("team:no2fa", {defaultValue: "no 2FA"})}
                </span>
              ) : null}
              <StatusText color={statusColor(operator.status)} className="text-on-surface-secondary text-xs capitalize">
                {t(`team:status.${operator.status}`, {defaultValue: operator.status})}
              </StatusText>
            </span>
          </span>
          {can(user, "team.write") && operator.id !== user.id ? <EditDialog operator={operator} /> : null}
        </li>
      ))}
    </ul>
  );
}

function RoleSelect({defaultValue}: {defaultValue?: string}) {
  let {t} = useTranslation();
  let {data} = useQuery(listRolesOptions());
  return (
    <Select id="roleID" name="roleID" defaultValue={defaultValue} required key={data ? "loaded" : "loading"}>
      {!defaultValue ? <option value="">{t("team:chooseRole", {defaultValue: "Choose a role"})}</option> : null}
      {data?.roles.map((role) => (
        <option key={role.id} value={role.id}>
          {role.name}
        </option>
      ))}
    </Select>
  );
}

function InviteDialog() {
  let {t} = useTranslation();
  let {mutationFn} = inviteOperatorMutation();
  return (
    <FormDialog
      trigger={
        <Button size="sm" color="brand">
          {t("team:invite", {defaultValue: "Invite"})}
        </Button>
      }
      title={t("team:inviteTitle", {defaultValue: "Invite to Helm"})}
      description={t("team:inviteHint", {defaultValue: "They get an email with a link to set a password. The link lasts 72 hours."})}
      action={t("team:sendInvite", {defaultValue: "Send invite"})}
      success={t("team:invited", {defaultValue: "Invite sent"})}
      onSubmit={(form) =>
        mutationFn({
          body: {
            email: (form.get("email") as string).trim(),
            firstName: (form.get("firstName") as string).trim(),
            lastName: (form.get("lastName") as string).trim(),
            roleID: form.get("roleID") as string,
          },
        })
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("common:firstName", {defaultValue: "First name"})} htmlFor="firstName">
          <Input id="firstName" name="firstName" required />
        </FormField>
        <FormField label={t("common:lastName", {defaultValue: "Last name"})} htmlFor="lastName">
          <Input id="lastName" name="lastName" required />
        </FormField>
      </div>
      <FormField label={t("common:email", {defaultValue: "Email"})} htmlFor="email">
        <Input id="email" name="email" type="email" required placeholder="name@octopos.uz" />
      </FormField>
      <FormField label={t("team:role", {defaultValue: "Role"})} htmlFor="roleID">
        <RoleSelect />
      </FormField>
    </FormDialog>
  );
}

function EditDialog({operator}: {operator: Operator}) {
  let {t} = useTranslation();
  let {mutationFn} = updateOperatorMutation();
  return (
    <FormDialog
      trigger={
        <Button size="xs" color="neutral" variant="ghost">
          {t("common:edit", {defaultValue: "Edit"})}
        </Button>
      }
      title={`${operator.firstName} ${operator.lastName}`}
      action={t("common:save", {defaultValue: "Save"})}
      success={t("team:updated", {defaultValue: "Team member updated"})}
      onSubmit={(form) => mutationFn({body: {id: operator.id, roleID: form.get("roleID") as string, status: form.get("status") as OperatorStatus}})}
    >
      <FormField label={t("team:role", {defaultValue: "Role"})} htmlFor="roleID">
        <RoleSelect defaultValue={operator.role.id} />
      </FormField>
      <FormField label={t("common:status", {defaultValue: "Status"})} htmlFor="status" hint={t("team:disableHint", {defaultValue: "Disabling signs them out everywhere at once."})}>
        <Select id="status" name="status" defaultValue={operator.status}>
          {operator.status === "invited" ? (
            <option value="invited">{t("team:status.invited", {defaultValue: "Invited"})}</option>
          ) : (
            <option value="active">{t("team:status.active", {defaultValue: "Active"})}</option>
          )}
          <option value="disabled">{t("team:status.disabled", {defaultValue: "Disabled"})}</option>
        </Select>
      </FormField>
    </FormDialog>
  );
}
