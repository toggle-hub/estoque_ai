"use client";

export const selectedOrganizationStorageKey = "estoque_ai:selected_organization_id";

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
