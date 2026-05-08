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

export type OrganizationProfileInput = {
  cnpj?: null | string;
  email?: null | string;
  name: string;
  phone?: null | string;
  plan_type?: null | string;
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

export type Category = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type CategoryInput = {
  description?: string;
  name: string;
};

export type LocationItem = {
  id: string;
  organization_id: string;
  category_id: string | null;
  sku: string;
  name: string;
  description: string | null;
  unit_price: string | null;
  reorder_point: number;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  category: Category | null;
  quantity: number;
};

export type LocationItemInput = {
  category_id?: string;
  description?: string;
  name: string;
  quantity?: number;
  reorder_point?: number;
  sku: string;
  unit_price: number;
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

type CategoriesResponse = {
  categories?: Category[];
  error?: string;
  pagination?: PaginationResponse;
};

type CategoryResponse = {
  category?: Category;
  error?: string;
};

type LocationItemsResponse = {
  error?: string;
  items?: LocationItem[];
  pagination?: PaginationResponse;
};

type LocationItemResponse = {
  error?: string;
  item?: LocationItem;
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
 * Reads one organization profile.
 *
 * @param organizationId Selected organization identifier.
 * @returns Organization profile and current membership role.
 */
export const getOrganization = async (organizationId: string) => {
  const response = await fetch(getApiUrl(`/api/organizations/${organizationId}`), {
    credentials: "include",
  });
  const payload = (await response.json().catch(() => ({}))) as OrganizationResponse;

  if (!response.ok) {
    throw new ApiError(payload.error ?? "Unable to load organization.", response.status);
  }

  if (!payload.organization) {
    throw new ApiError("Organization response did not include an organization.", response.status);
  }

  return payload.organization;
};

/**
 * Updates organization profile details.
 *
 * @param organizationId Selected organization identifier.
 * @param input Editable profile fields.
 * @returns Updated organization profile.
 */
export const updateOrganization = async (
  organizationId: string,
  input: OrganizationProfileInput,
) => {
  const response = await fetch(getApiUrl(`/api/organizations/${organizationId}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as OrganizationResponse;

  if (!response.ok) {
    throw new ApiError(payload.error ?? "Unable to update organization.", response.status);
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

/**
 * Lists all active categories for one organization.
 *
 * @param organizationId Selected organization identifier.
 * @returns Categories ordered by name.
 */
export const getOrganizationCategories = async (organizationId: string) => {
  const limit = 100;
  let offset = 0;
  let hasMore = true;
  const categories: Category[] = [];

  while (hasMore) {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const response = await fetch(
      getApiUrl(`/api/organizations/${organizationId}/categories?${query.toString()}`),
      {
        credentials: "include",
      },
    );
    const payload = (await response.json().catch(() => ({}))) as CategoriesResponse;

    if (!response.ok) {
      throw new ApiError(payload.error ?? "Unable to load categories.", response.status);
    }

    categories.push(...(payload.categories ?? []));
    hasMore = Boolean(payload.pagination?.hasMore);

    if (hasMore) {
      const nextOffset = payload.pagination?.nextOffset ?? offset + limit;

      if (nextOffset <= offset) {
        throw new ApiError("Category pagination did not advance.", response.status);
      }

      offset = nextOffset;
    }
  }

  return categories;
};

/**
 * Creates a category for one organization.
 *
 * @param organizationId Selected organization identifier.
 * @param input Category creation fields.
 * @returns Created category.
 */
export const createOrganizationCategory = async (
  organizationId: string,
  input: CategoryInput,
) => {
  const response = await fetch(getApiUrl(`/api/organizations/${organizationId}/categories`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as CategoryResponse;

  if (!response.ok) {
    throw new ApiError(payload.error ?? "Unable to create category.", response.status);
  }

  if (!payload.category) {
    throw new ApiError("Category response did not include a category.", response.status);
  }

  return payload.category;
};

/**
 * Lists all active items linked to one location.
 *
 * @param locationId Selected location identifier.
 * @returns Location items ordered by name.
 */
export const getLocationItems = async (locationId: string) => {
  const limit = 100;
  let offset = 0;
  let hasMore = true;
  const items: LocationItem[] = [];

  while (hasMore) {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const response = await fetch(
      getApiUrl(`/api/locations/${locationId}/items?${query.toString()}`),
      {
        credentials: "include",
      },
    );
    const payload = (await response.json().catch(() => ({}))) as LocationItemsResponse;

    if (!response.ok) {
      throw new ApiError(payload.error ?? "Unable to load location items.", response.status);
    }

    items.push(...(payload.items ?? []));
    hasMore = Boolean(payload.pagination?.hasMore);

    if (hasMore) {
      const nextOffset = payload.pagination?.nextOffset ?? offset + limit;

      if (nextOffset <= offset) {
        throw new ApiError("Location item pagination did not advance.", response.status);
      }

      offset = nextOffset;
    }
  }

  return items;
};

/**
 * Creates an item linked to one location.
 *
 * @param locationId Selected location identifier.
 * @param input Item creation fields.
 * @returns Created location item.
 */
export const createLocationItem = async (locationId: string, input: LocationItemInput) => {
  const response = await fetch(getApiUrl(`/api/locations/${locationId}/items`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as LocationItemResponse;

  if (!response.ok) {
    throw new ApiError(payload.error ?? "Unable to create item.", response.status);
  }

  if (!payload.item) {
    throw new ApiError("Item response did not include an item.", response.status);
  }

  return payload.item;
};
