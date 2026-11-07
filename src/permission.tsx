import type {Capability, PermissionScope, SignedInOperator} from "@/api";

// Same contract as the dash's permission.tsx: the server sends a permissions map, "*" grants
// everything, and the UI only hides what the API would refuse anyway — it is never the gate.

const WILDCARD = "*";

export function can(subject: SignedInOperator, capability: Capability) {
  return !!(subject.permissions[WILDCARD] || subject.permissions[capability]);
}

/** How far a granted capability reaches. "*" and a scopeless grant reach every client. */
export function scopeOf(subject: SignedInOperator, capability: Capability): PermissionScope | undefined {
  if (subject.permissions[WILDCARD]) return "all";
  let granted = subject.permissions[capability];
  if (!granted) return undefined;
  return granted === true ? "all" : granted;
}

export function canAny(subject: SignedInOperator, ...capabilities: Capability[]) {
  return capabilities.some((cap) => can(subject, cap));
}

type CanProps = {
  subject: SignedInOperator;
  children: React.ReactNode;
};

export function Can({subject, capability, children}: CanProps & {capability: Capability}) {
  if (!can(subject, capability)) return undefined;
  return children;
}

export function CanAny({subject, capabilities, children}: CanProps & {capabilities: Capability[]}) {
  if (!canAny(subject, ...capabilities)) return undefined;
  return children;
}
