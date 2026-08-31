import type { Organisation, User } from "@prisma/client";

export function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organisationId: user.organisationId,
    status: user.status,
  };
}

export function serializeOrganisation(organisation: Organisation) {
  return {
    id: organisation.id,
    name: organisation.name,
    createdAt: organisation.createdAt.toISOString(),
    contractCount: organisation.contractCount,
  };
}

export function serializeSession(user: User, organisation: Organisation | null) {
  return {
    user: serializeUser(user),
    organisation: organisation ? serializeOrganisation(organisation) : null,
  };
}
