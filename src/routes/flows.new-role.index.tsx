import {createFileRoute} from "@tanstack/react-router";
import {useNewRole} from "@/flow-contexts";
import {FormEvent} from "react";
import {Button, FixedFooter, Input, Label, Textarea} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";

export let Route = createFileRoute("/flows/new-role/")({
  component: Index,
});

function Index() {
  let navigate = Route.useNavigate();
  let {roleData, setRoleData} = useNewRole();
  let {t} = useTranslation();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let data = new FormData(e.target as HTMLFormElement);
    setRoleData((prev) => ({...prev, name: (data.get("name") as string).trim(), description: (data.get("description") as string).trim()}));
    navigate({to: "/flows/new-role/permissions"});
  }

  return (
    <form className="mx-auto flex w-full flex-col px-4 sm:max-w-md" onSubmit={onSubmit}>
      <h1 className="text-center text-3xl font-semibold tracking-tight">{t("access:newRole", {defaultValue: "New role"})}</h1>
      <div className="mt-10 mb-5 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{t("common:name", {defaultValue: "Name"})}</Label>
          <Input size="lg" id="name" name="name" defaultValue={roleData.name} required autoFocus placeholder={t("access:roleNamePlaceholder", {defaultValue: "e.g. Sales, Installer"})} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">{t("access:descriptionOptional", {defaultValue: "Description (optional)"})}</Label>
          <Textarea id="description" name="description" rows={3} defaultValue={roleData.description} />
        </div>
      </div>
      <FixedFooter className="z-20 px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:static sm:px-0">
        <Button size="lg" className="w-full">
          {t("common:continue", {defaultValue: "Continue"})}
        </Button>
      </FixedFooter>
    </form>
  );
}
