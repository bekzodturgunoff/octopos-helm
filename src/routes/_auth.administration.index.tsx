import {NavOption, NavOptionAdornmentWithBg} from "@yeahuz/kdsx-react";
import {createFileRoute, Link} from "@tanstack/react-router";
import {BellRing, History, Users, Vault} from "lucide-react";
import {useTranslation} from "react-i18next";
import {Can} from "@/permission";

export let Route = createFileRoute("/_auth/administration/")({
  beforeLoad: () => ({backLink: {to: "/"}}),
  component: Administration,
});

function Administration() {
  let {user} = Route.useRouteContext();
  let {t} = useTranslation();
  return (
    <div className="flex flex-col gap-10 px-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t("team:administration", {defaultValue: "Administration"})}</h1>
      <ul>
        <Can subject={user} capability="role.read">
          <li>
            <Link to="/administration/roles">
              <NavOption
                startAdornment={
                  <NavOptionAdornmentWithBg>
                    <Vault size={20} />
                  </NavOptionAdornmentWithBg>
                }
                title={t("access:accessControl", {defaultValue: "Access control"})}
                subtitle={t("access:manageAccessControl", {defaultValue: "Roles and what each one is allowed to do"})}
              />
            </Link>
          </li>
        </Can>
        <Can subject={user} capability="team.read">
          <li>
            <Link to="/administration/team">
              <NavOption
                startAdornment={
                  <NavOptionAdornmentWithBg>
                    <Users size={20} />
                  </NavOptionAdornmentWithBg>
                }
                title={t("team:team", {defaultValue: "Team"})}
                subtitle={t("team:teamSubtitle", {defaultValue: "Who works in Helm and what each role may do"})}
              />
            </Link>
          </li>
        </Can>
        <Can subject={user} capability="team.read">
          <li>
            <Link to="/administration/notifications">
              <NavOption
                startAdornment={
                  <NavOptionAdornmentWithBg>
                    <BellRing size={20} />
                  </NavOptionAdornmentWithBg>
                }
                title={t("team:teamAlerts", {defaultValue: "Team alerts"})}
                subtitle={t("team:teamAlertsSubtitle", {defaultValue: "Installation and billing trouble posted to the team's Telegram group"})}
              />
            </Link>
          </li>
        </Can>
        <Can subject={user} capability="audit.read">
          <li>
            <Link to="/administration/activity">
              <NavOption
                startAdornment={
                  <NavOptionAdornmentWithBg>
                    <History size={20} />
                  </NavOptionAdornmentWithBg>
                }
                title={t("team:activity", {defaultValue: "Activity log"})}
                subtitle={t("team:activitySubtitle", {defaultValue: "Every change made from Helm, and every payment and fleet event"})}
              />
            </Link>
          </li>
        </Can>
      </ul>
    </div>
  );
}
