"use client";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Organization = {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  plan_type: string | null;
  created_at: string;
  updated_at: string;
  role: string;
};

export type Location = {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type OrganizationStockLevel = {
  id: string;
  organization_id: string;
  location_id: string;
  item_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  item: {
    id: string;
    sku: string;
    name: string;
    unit_price: string | null;
    reorder_point: number;
  };
  location: {
    id: string;
    name: string;
  };
};

type CurrentUserResponse = {
  error?: string;
  user?: AuthenticatedUser;
};

type OrganizationsResponse = {
  error?: string;
  organizations?: Organization[];
};

type OrganizationResponse = {
  error?: string;
  organization?: Organization;
};

type LocationsResponse = {
  error?: string;
  locations?: Location[];
};

type LocationResponse = {
  error?: string;
  location?: Location;
};

type PaginationResponse = {
  hasMore: boolean;
  nextOffset: number | null;
};

type OrganizationStockResponse = {
  error?: string;
  pagination?: PaginationResponse;
  stock?: OrganizationStockLevel[];
};

export class ApiError extends Error {
  status: number;

  /**
   * Creates an API error with the originating HTTP status.
   *
   * @param message User-facing error message.
   * @param status HTTP response status code.
   */
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Builds an API URL from the optional public API origin.
 *
 * @param path API path beginning with a slash.
 * @returns Same-origin path or absolute API URL.
 */
export const getApiUrl = (path: string) => {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

  return `${apiBaseUrl}${path}`;
};

/**
 * Reads the current authenticated user using the HTTP-only auth cookie.
 *
 * @returns Current authenticated user.
 */
export const getCurrentUser = async () => {
  const response = await fetch(getApiUrl("/api/auth/me"), {
    credentials: "include",
  });
  const payload = (await response.json().catch(() => ({}))) as CurrentUserResponse;

  if (!response.ok) {
    throw new ApiError(payload.error ?? "Authentication check failed.", response.status);
  }

  if (!payload.user) {
    throw new ApiError("Authentication response did not include a user.", response.status);
  }

  return payload.user;
};

/**
 * Lists organizations available to the authenticated user.
 *
 * @returns Organization memberships for the active session.
 */
export const getOrganizations = async () => {
  const response = await fetch(getApiUrl("/api/organizations"), {
    credentials: "include",
  });
  const payload = (await response.json().catch(() => ({}))) as OrganizationsResponse;

  if (!response.ok) {
    throw new ApiError(payload.error ?? "Unable to load organizations.", response.status);
  }

  return payload.organizations ?? [];
};

/**
 * Creates an organization for the authenticated user.
 *
 * @param input Organization creation fields.
 * @returns Created organization membership.
 */
export const createOrganization = async (input: { name: string }) => {
  const response = await fetch(getApiUrl("/api/organizations"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as OrganizationResponse;

  if (!response.ok) {
    throw new ApiError(payload.error ?? "Unable to create organization.", response.status);
  }

  if (!payload.organization) {
    throw new ApiError("Organization response did not include an organization.", response.status);
  }

  return payload.organization;
};

/**
 * Lists locations for one organization.
 *
 * @param organizationId Selected organization identifier.
 * @returns Active and inactive locations owned by the organization.
 */
export const getOrganizationLocations = async (organizationId: string) => {
  const response = await fetch(getApiUrl(`/api/organizations/${organizationId}/locations`), {
    credentials: "include",
  });
  const payload = (await response.json().catch(() => ({}))) as LocationsResponse;

  if (!response.ok) {
    throw new ApiError(payload.error ?? "Unable to load locations.", response.status);
  }

  return payload.locations ?? [];
};

/**
 * Creates a location for one organization.
 *
 * @param input Organization id and location fields.
 * @returns Created location.
 */
export const createOrganizationLocation = async (input: {
  address?: string;
  name: string;
  organizationId: string;
}) => {
  const response = await fetch(getApiUrl(`/api/organizations/${input.organizationId}/locations`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      address: input.address,
      name: input.name,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as LocationResponse;

  if (!response.ok) {
    throw new ApiError(payload.error ?? "Unable to create location.", response.status);
  }

  if (!payload.location) {
    throw new ApiError("Location response did not include a location.", response.status);
  }

  return payload.location;
};

/**
 * Lists stock rows for organization-level summaries.
 *
 * @param organizationId Selected organization identifier.
 * @returns Stock levels joined to item and location data.
 */
export const getOrganizationStock = async (organizationId: string) => {
  const limit = 100;
  let offset = 0;
  let hasMore = true;
  const stock: OrganizationStockLevel[] = [];

  while (hasMore) {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const response = await fetch(
      getApiUrl(`/api/organizations/${organizationId}/stock?${query.toString()}`),
      {
        credentials: "include",
      },
    );
    const payload = (await response.json().catch(() => ({}))) as OrganizationStockResponse;

    if (!response.ok) {
      throw new ApiError(payload.error ?? "Unable to load stock summary.", response.status);
    }

    stock.push(...(payload.stock ?? []));

    hasMore = Boolean(payload.pagination?.hasMore);

    if (hasMore) {
      offset = payload.pagination?.nextOffset ?? offset + limit;
    }
  }

  return stock;
};
