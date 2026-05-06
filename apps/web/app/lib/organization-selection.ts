"use client";

export const selectedOrganizationStorageKey = "estoque_ai:selected_organization_id";
export const selectedLocationStorageKey = "estoque_ai:selected_location_by_org";

export type SelectedLocation = {
  id: string;
  name: string;
};

/**
 * Reads the selected organization id from durable client storage.
 *
 * @returns Selected organization id when one was persisted.
 */
export const getSelectedOrganizationId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(selectedOrganizationStorageKey);
};

/**
 * Persists the selected organization id in durable client storage.
 *
 * @param organizationId Organization id selected by the user.
 */
export const setSelectedOrganizationId = (organizationId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(selectedOrganizationStorageKey, organizationId);
};

/**
 * Removes the selected organization id from durable client storage.
 */
export const clearSelectedOrganizationId = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(selectedOrganizationStorageKey);
};

/**
 * Reads selected locations by organization from durable client storage.
 *
 * @returns Selected locations keyed by organization id.
 */
const getSelectedLocationsByOrganization = () => {
  if (typeof window === "undefined") {
    return {};
  }

  const value = window.localStorage.getItem(selectedLocationStorageKey);

  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value) as Record<string, SelectedLocation>;
  } catch {
    window.localStorage.removeItem(selectedLocationStorageKey);
    return {};
  }
};

/**
 * Reads the selected location from durable client storage.
 *
 * @param organizationId Organization that owns the selected location.
 * @returns Selected location when one was persisted.
 */
export const getSelectedLocation = (organizationId: string) =>
  getSelectedLocationsByOrganization()[organizationId] ?? null;

/**
 * Persists the selected location in durable client storage.
 *
 * @param organizationId Organization that owns the selected location.
 * @param location Selected location id and name.
 */
export const setSelectedLocation = (organizationId: string, location: SelectedLocation) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    selectedLocationStorageKey,
    JSON.stringify({
      ...getSelectedLocationsByOrganization(),
      [organizationId]: location,
    }),
  );
};

/**
 * Removes the selected location for one organization from durable client storage.
 *
 * @param organizationId Organization that owns the selected location.
 */
export const clearSelectedLocation = (organizationId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const selectedLocations = getSelectedLocationsByOrganization();

  delete selectedLocations[organizationId];
  window.localStorage.setItem(selectedLocationStorageKey, JSON.stringify(selectedLocations));
};
