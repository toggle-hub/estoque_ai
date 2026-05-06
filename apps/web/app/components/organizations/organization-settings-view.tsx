"use client";

import { AlertCircle, CheckCircle2, ClipboardCheck, RotateCw, Save } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Organization, OrganizationProfileInput } from "../../lib/api";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Spinner } from "../ui/spinner";

type CompletionItem = {
  isComplete: boolean;
  label: string;
  primary?: boolean;
};

type OrganizationSettingsViewProps = {
  errorMessage?: string;
  isLoading?: boolean;
  isSaving?: boolean;
  onRetry?: () => void;
  onSave?: (input: OrganizationProfileInput) => Promise<void>;
  organization?: Organization | null;
  saveErrorMessage?: string;
  saveSuccessMessage?: string;
};

const writeRoles = new Set(["admin", "manager"]);

/**
 * Converts optional form text to nullable API values.
 *
 * @param value Form field value.
 * @returns Trimmed value or null.
 */
const getNullableValue = (value: string) => value.trim() || null;

/**
 * Builds profile-completion checklist items for one organization.
 *
 * @param organization Organization profile.
 * @returns Checklist items with CNPJ marked as primary.
 */
const getCompletionItems = (organization?: Organization | null): CompletionItem[] => [
  {
    isComplete: Boolean(organization?.cnpj),
    label: "CNPJ",
    primary: true,
  },
  {
    isComplete: Boolean(organization?.email),
    label: "Company email",
  },
  {
    isComplete: Boolean(organization?.phone),
    label: "Phone",
  },
  {
    isComplete: Boolean(organization?.plan_type),
    label: "Plan type",
  },
];

/**
 * Renders the organization profile settings page content.
 *
 * @param props View props.
 * @returns Organization settings UI.
 */
export function OrganizationSettingsView({
  errorMessage,
  isLoading = false,
  isSaving = false,
  onRetry,
  onSave,
  organization,
  saveErrorMessage,
  saveSuccessMessage,
}: OrganizationSettingsViewProps) {
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [planType, setPlanType] = useState("");
  const role = organization?.role?.toLowerCase() ?? "viewer";
  const canEdit = writeRoles.has(role);
  const completionItems = useMemo(() => getCompletionItems(organization), [organization]);
  const missingItems = completionItems.filter((item) => !item.isComplete);
  const isProfileIncomplete = Boolean(organization) && missingItems.length > 0;

  useEffect(() => {
    setName(organization?.name ?? "");
    setCnpj(organization?.cnpj ?? "");
    setEmail(organization?.email ?? "");
    setPhone(organization?.phone ?? "");
    setPlanType(organization?.plan_type ?? "");
  }, [organization]);

  /**
   * Submits editable organization profile fields.
   *
   * @param event Form submit event.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canEdit || !onSave || !name.trim()) {
      return;
    }

    await onSave({
      cnpj: getNullableValue(cnpj),
      email: getNullableValue(email),
      name: name.trim(),
      phone: getNullableValue(phone),
      plan_type: getNullableValue(planType),
    });
  };

  if (isLoading) {
    return (
      <main className="grid min-h-[calc(100svh-4rem)] place-items-center bg-gray-50 p-6 md:min-h-screen">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100svh-4rem)] bg-gray-50 p-4 text-[#16151c] md:min-h-screen md:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-purple-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="m-0 text-sm font-medium text-purple-600">
              {organization?.name ?? "Selected organization"}
            </p>
            <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal">
              Organization settings
            </h1>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[#5c6670]">
              Complete company profile details used across inventory workflows.
            </p>
          </div>
          <Badge variant={canEdit ? "secondary" : "outline"}>
            {canEdit ? "Can edit profile" : "Read-only access"}
          </Badge>
        </header>

        {!organization ? (
          <Alert variant="destructive">
            <AlertTitle>No organization selected</AlertTitle>
            <AlertDescription>Select an organization before editing settings.</AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load organization</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
            {onRetry ? (
              <Button className="mt-3" onClick={onRetry} variant="outline">
                Retry
              </Button>
            ) : null}
          </Alert>
        ) : null}

        {isProfileIncomplete ? (
          <Alert>
            <AlertCircle className="absolute top-4 left-4 size-4 text-purple-500" />
            <div className="pl-6">
              <AlertTitle>Complete company profile</AlertTitle>
              <AlertDescription>
                CNPJ is the main company identifier. Add it when available; missing fields do not
                block inventory work.
              </AlertDescription>
            </div>
          </Alert>
        ) : null}

        {!canEdit ? (
          <Alert>
            <AlertTitle>Viewer access</AlertTitle>
            <AlertDescription>
              Viewers can review company profile details, but cannot edit organization settings.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Company profile</CardTitle>
              <CardDescription>
                Keep legal and contact details current for this organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-purple-700">Name</span>
                  <input
                    className="h-10 min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:bg-gray-50"
                    disabled={!canEdit || isSaving}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ada Industries"
                    value={name}
                  />
                </label>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-purple-700">CNPJ</span>
                    <input
                      className="h-10 min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:bg-gray-50"
                      disabled={!canEdit || isSaving}
                      onChange={(event) => setCnpj(event.target.value)}
                      placeholder="12.345.678/0001-90"
                      value={cnpj}
                    />
                  </label>

                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-purple-700">Email</span>
                    <input
                      className="h-10 min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:bg-gray-50"
                      disabled={!canEdit || isSaving}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="ops@company.com"
                      type="email"
                      value={email}
                    />
                  </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-purple-700">Phone</span>
                    <input
                      className="h-10 min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:bg-gray-50"
                      disabled={!canEdit || isSaving}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+55 11 99999-0000"
                      value={phone}
                    />
                  </label>

                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-purple-700">Plan type</span>
                    <input
                      className="h-10 min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:bg-gray-50"
                      disabled={!canEdit || isSaving}
                      onChange={(event) => setPlanType(event.target.value)}
                      placeholder="essencial"
                      value={planType}
                    />
                  </label>
                </div>

                {saveErrorMessage ? (
                  <p className="m-0 text-sm text-[#b42318]" role="alert">
                    {saveErrorMessage}
                  </p>
                ) : null}

                {saveSuccessMessage ? (
                  <p className="m-0 text-sm text-purple-700" role="status">
                    {saveSuccessMessage}
                  </p>
                ) : null}

                {canEdit ? (
                  <Button
                    className="justify-self-start"
                    disabled={!onSave || isSaving || !name.trim()}
                    type="submit"
                  >
                    {isSaving ? <RotateCw className="animate-spin" /> : <Save />}
                    Save changes
                  </Button>
                ) : null}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile checklist</CardTitle>
              <CardDescription>Complete the core organization profile over time.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="m-0 grid list-none gap-3 p-0">
                {completionItems.map((item) => (
                  <li
                    className="flex items-center justify-between gap-3 rounded-md border border-purple-100 bg-purple-50 px-3 py-2"
                    key={item.label}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium">
                      {item.isComplete ? (
                        <CheckCircle2 className="size-4 shrink-0 text-purple-600" />
                      ) : (
                        <ClipboardCheck className="size-4 shrink-0 text-gray-400" />
                      )}
                      <span className="truncate">{item.label}</span>
                    </span>
                    <Badge variant={item.isComplete ? "secondary" : "outline"}>
                      {item.isComplete ? "Done" : item.primary ? "Primary" : "Missing"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
