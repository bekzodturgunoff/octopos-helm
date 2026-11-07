import {NavLink} from "@/components/nav-link";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {ErrorAlert, Button, NavOption, NavOptionAdornmentWithBg, ConfirmationAlert} from "@yeahuz/kdsx-react";
import {Bell, Bug, KeyRound, Contrast, History, RefreshCw, UserRound, Users} from "lucide-react";
import {useTranslation} from "react-i18next";
import {signOutOperatorMutation} from "@/api";
import {clearSession} from "@/constants";
import {Can} from "@/permission";

// The dash's settings page, class for class: the account card on the left, the list on the right.
export let Route = createFileRoute("/_auth/settings/")({
  beforeLoad: () => {
    return {
      backLink: {to: "/"},
    };
  },
  component: Settings,
});

function Settings() {
  let navigate = Route.useNavigate();
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let queryClient = useQueryClient();

  let {
    isPending: signingOut,
    mutate: signOut,
    error,
  } = useMutation({
    ...signOutOperatorMutation(),
    onSuccess: () => {
      queryClient.clear();
      clearSession();
      navigate({to: "/login"});
    },
  });

  return (
    <div className="px-4 md:flex md:gap-14">
      <div className="sticky w-full md:max-w-xs">
        <div className="bg-surface-600 rounded-3xl p-6">
          <div className="flex items-center justify-center">
            <div className="bg-surface-500 flex h-16 w-16 items-center justify-center rounded-full">
              <UserRound />
            </div>
          </div>
          <h1 className="my-2 text-center text-3xl font-extrabold uppercase">
            {user.firstName} {user.lastName}
          </h1>
          {error ? <ErrorAlert message={error.message} title={t("common:error", {defaultValue: "Error"})} /> : null}
          <p className="text-on-surface text-center text-sm">
            {user.role.name} · {user.email}
          </p>
        </div>
        <div className="my-5 flex items-center justify-center">
          <ConfirmationAlert
            title={t("settings:logout", {defaultValue: "Log out"})}
            description={t("settings:sureToLogout", {defaultValue: "Are you sure you want to log out of Helm?"})}
            trigger={
              <Button size="xs" variant="fill" color="neutral">
                {t("settings:logout", {defaultValue: "Log out"})}
              </Button>
            }
            action={
              <Button color="danger" size="lg" variant="fill" disabled={signingOut} loading={signingOut} onClick={() => signOut({body: {}})}>
                {t("settings:logout", {defaultValue: "Log out"})}
              </Button>
            }
          />
        </div>
      </div>
      <div className="flex grow flex-col gap-4">
        <div className="mt-4 flex flex-col gap-5">
          <h1 className="text-2xl font-semibold tracking-tight">{t("settings:settings", {defaultValue: "Settings"})}</h1>
          <ul>
            <li>
              <NavLink to="/settings/language-and-appearance">
                <NavOption
                  startAdornment={
                    <NavOptionAdornmentWithBg>
                      <Contrast size={20} />
                    </NavOptionAdornmentWithBg>
                  }
                  title={t("settings:languageAndAppearance", {defaultValue: "Language and appearance"})}
                  subtitle={t("settings:customizeLanguage", {defaultValue: "Customize your language and appearance"})}
                />
              </NavLink>
            </li>
            <li>
              <NavLink to="/settings/security">
                <NavOption
                  startAdornment={
                    <NavOptionAdornmentWithBg>
                      <KeyRound size={20} />
                    </NavOptionAdornmentWithBg>
                  }
                  title={t("settings:security", {defaultValue: "Security"})}
                  subtitle={
                    user.twoFactorEnabled
                      ? t("settings:twoFactorIsOn", {defaultValue: "Two-factor sign-in is on"})
                      : t("settings:twoFactorIsOff", {defaultValue: "Two-factor sign-in is off — set it up"})
                  }
                />
              </NavLink>
            </li>
            <li>
              <NavLink to="/settings/notifications">
                <NavOption
                  startAdornment={
                    <NavOptionAdornmentWithBg>
                      <Bell size={20} />
                    </NavOptionAdornmentWithBg>
                  }
                  title={t("settings:notifications", {defaultValue: "Notifications"})}
                  subtitle={t("settings:notificationsSubtitle", {defaultValue: "Your morning digest on Telegram"})}
                />
              </NavLink>
            </li>
            <Can subject={user} capability="team.read">
              <li>
                <NavLink to="/administration/team">
                  <NavOption
                    startAdornment={
                      <NavOptionAdornmentWithBg>
                        <Users size={20} />
                      </NavOptionAdornmentWithBg>
                    }
                    title={t("team:team", {defaultValue: "Team"})}
                    subtitle={t("team:teamSubtitle", {defaultValue: "Who works in Helm and what each role may do"})}
                  />
                </NavLink>
              </li>
            </Can>
            <Can subject={user} capability="audit.read">
              <li>
                <NavLink to="/administration/activity" search={{actorID: user.id}}>
                  <NavOption
                    startAdornment={
                      <NavOptionAdornmentWithBg>
                        <History size={20} />
                      </NavOptionAdornmentWithBg>
                    }
                    title={t("settings:myActivity", {defaultValue: "My activity"})}
                    subtitle={t("settings:myActivitySubtitle", {defaultValue: "Everything you changed from Helm"})}
                  />
                </NavLink>
              </li>
            </Can>
            <li>
              <NavOption
                startAdornment={
                  <NavOptionAdornmentWithBg>
                    <RefreshCw size={20} />
                  </NavOptionAdornmentWithBg>
                }
                title={t("common:checkForUpdates", {defaultValue: "Check for updates"})}
                onClick={() => window.location.reload()}
                className="cursor-pointer"
              />
            </li>
            <li>
              <a href="https://t.me/octopos_bug_report_bot" target="_blank" rel="noopener noreferrer">
                <NavOption
                  startAdornment={
                    <NavOptionAdornmentWithBg>
                      <Bug size={20} />
                    </NavOptionAdornmentWithBg>
                  }
                  title={t("settings:reportBug", {defaultValue: "Report a bug"})}
                  subtitle={t("settings:bugGuidance", {defaultValue: "Tell us what happened and what you expected"})}
                />
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
