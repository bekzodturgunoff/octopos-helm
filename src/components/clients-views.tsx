import {useNavigate} from "@tanstack/react-router";
import {Tabs, TabsList, TabsTrigger} from "@yeahuz/kdsx-react";
import {List, MapPin} from "lucide-react";
import {useTranslation} from "react-i18next";

/** The two ways to look at clients: as a list, or where they are. One area in the menu, two views. */
export function ClientsViews({value}: {value: "list" | "map"}) {
  let {t} = useTranslation();
  let navigate = useNavigate();
  return (
    <Tabs value={value} onValueChange={(next) => navigate({to: next === "map" ? "/clients/map" : "/clients"})}>
      <TabsList>
        <TabsTrigger value="list" className="shrink-0 gap-2 px-2 text-sm sm:px-4 sm:text-base">
          <List size={16} /> {t("clients:viewList", {defaultValue: "List"})}
        </TabsTrigger>
        <TabsTrigger value="map" className="shrink-0 gap-2 px-2 text-sm sm:px-4 sm:text-base">
          <MapPin size={16} /> {t("clients:map", {defaultValue: "Map"})}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
