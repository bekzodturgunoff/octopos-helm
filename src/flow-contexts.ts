import {createContext, SetStateAction, useContext} from "react";
import type {CreateRoleData} from "@/api";

// Drafts of multi-step flows, as in the dash's flow-contexts.ts.

export let NewRoleContext = createContext<{roleData: CreateRoleData; setRoleData: (dispatch: SetStateAction<CreateRoleData>, persist?: boolean) => void; reset: () => void} | null>(null);

export function useNewRole() {
  let context = useContext(NewRoleContext);
  if (context == null) {
    throw new Error("useNewRole() should be inside NewRoleContextProvider");
  }
  return context;
}
