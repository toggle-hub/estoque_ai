"use client";

import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  RotateCw,
  Save,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Organization, OrganizationProfileInput } from "../../lib/api";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Skeleton } from "../ui/skeleton";

type CompletionItem = {
  isComplete: boolean;
  label: string;
  primary?: boolean;
};

export type OrganizationSettingsViewProps = {
  errorMessage?: string;
  isLoading?: boolean;
  isSaving?: boolean;
  onRetry?: () => void;
  onSave?: (input: OrganizationProfileInput) => Promise<void>;
  organization?: Organization | null;
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
const getCompletionItems = (
  organization?: Organization | null,
): CompletionItem[] => [
  {
    isComplete: Boolean(organization?.cnpj),
    label: "CNPJ",
    primary: true,
  },
  {
    isComplete: Boolean(organization?.email),
    label: "Email da empresa",
  },
  {
    isComplete: Boolean(organization?.phone),
    label: "Telefone",
  },
  {
    isComplete: Boolean(organization?.plan_type),
    label: "Tipo de plano",
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
}: OrganizationSettingsViewProps) {
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setTelefone] = useState("");
  const [planType, setPlanType] = useState("");
  const previousOrganizationIdRef = useRef<string | null>(null);
  const role = organization?.role?.toLowerCase() ?? "viewer";
  const canEdit = writeRoles.has(role);
  const completionItems = useMemo(
    () => getCompletionItems(organization),
    [organization],
  );
  const missingItems = completionItems.filter((item) => !item.isComplete);
  const isProfileIncomplete = Boolean(organization) && missingItems.length > 0;

  useEffect(() => {
    const organizationId = organization?.id ?? null;

    if (previousOrganizationIdRef.current === organizationId) {
      return;
    }

    previousOrganizationIdRef.current = organizationId;
    setName(organization?.name ?? "");
    setCnpj(organization?.cnpj ?? "");
    setEmail(organization?.email ?? "");
    setTelefone(organization?.phone ?? "");
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

    try {
      await onSave({
        cnpj: getNullableValue(cnpj),
        email: getNullableValue(email),
        name: name.trim(),
        phone: getNullableValue(phone),
        plan_type: getNullableValue(planType),
      });
    } catch (error) {
      console.error("Falha ao salvar as configurações da organização.", error);
    }
  };

  if (isLoading) {
    return (
      <main
        aria-busy="true"
        className="min-h-[calc(100svh-4rem)] bg-white p-4 md:min-h-screen md:p-6"
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          <div className="border-b border-purple-100 pb-5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-3 h-8 w-72" />
            <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100svh-4rem)] bg-white p-4 text-[#16151c] md:min-h-screen md:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-purple-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="m-0 text-sm font-medium text-purple-600">
              {organization?.name ?? "Organização selecionada"}
            </p>
            <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal">
              Configurações da organização
            </h1>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[#5c6670]">
              Complete os dados da empresa usados nos fluxos de estoque.
            </p>
          </div>
          <Badge variant={canEdit ? "secondary" : "outline"}>
            {canEdit ? "Pode editar perfil" : "Acesso somente leitura"}
          </Badge>
        </header>

        {!organization ? (
          <Alert variant="destructive">
            <AlertTitle>Nenhuma organização selecionada</AlertTitle>
            <AlertDescription>
              Selecione uma organização antes de editar as configurações.
            </AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar a organização</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
            {onRetry ? (
              <Button className="mt-3" onClick={onRetry} variant="outline">
                Tentar novamente
              </Button>
            ) : null}
          </Alert>
        ) : null}

        {isProfileIncomplete ? (
          <Alert>
            <AlertCircle className="absolute top-4 left-4 size-4 text-purple-500" />
            <div className="pl-6">
              <AlertTitle>Complete o perfil da empresa</AlertTitle>
              <AlertDescription>
                CNPJ é o principal identificador da empresa. Adicione quando
                disponível; campos ausentes não bloqueiam o trabalho de estoque.
              </AlertDescription>
            </div>
          </Alert>
        ) : null}

        {!canEdit ? (
          <Alert variant="warning">
            <AlertTitle>Acesso de visualizador</AlertTitle>
            <AlertDescription>
              Visualizadores podem revisar os dados da empresa, mas não podem
              editar configurações da organização.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Perfil da empresa</CardTitle>
              <CardDescription>
                Mantenha os dados legais e de contato atualizados para esta
                organização.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-purple-700">
                    Nome
                  </span>
                  <input
                    className="h-10 min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:bg-purple-50"
                    disabled={!canEdit || isSaving}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ada Industries"
                    required
                    value={name}
                  />
                </label>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-purple-700">
                      CNPJ
                    </span>
                    <input
                      className="h-10 min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:bg-purple-50"
                      disabled={!canEdit || isSaving}
                      onChange={(event) => setCnpj(event.target.value)}
                      placeholder="12.345.678/0001-90"
                      value={cnpj}
                    />
                  </label>

                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-purple-700">
                      Email
                    </span>
                    <input
                      className="h-10 min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:bg-purple-50"
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
                    <span className="text-xs font-semibold text-purple-700">
                      Telefone
                    </span>
                    <input
                      className="h-10 min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:bg-purple-50"
                      disabled={!canEdit || isSaving}
                      onChange={(event) => setTelefone(event.target.value)}
                      placeholder="+55 11 99999-0000"
                      value={phone}
                    />
                  </label>

                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-purple-700">
                      Tipo de plano
                    </span>
                    <input
                      className="h-10 min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:bg-purple-50"
                      disabled={!canEdit || isSaving}
                      onChange={(event) => setPlanType(event.target.value)}
                      placeholder="essencial"
                      value={planType}
                    />
                  </label>
                </div>

                {canEdit ? (
                  <Button
                    className="justify-self-start"
                    disabled={!onSave || isSaving || !name.trim()}
                    type="submit"
                  >
                    {isSaving ? (
                      <RotateCw className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                    Salvar alterações
                  </Button>
                ) : null}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist do perfil</CardTitle>
              <CardDescription>
                Complete o perfil principal da organização ao longo do tempo.
              </CardDescription>
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
                        <ClipboardCheck className="size-4 shrink-0 text-purple-300" />
                      )}
                      <span className="truncate">{item.label}</span>
                    </span>
                    <Badge variant={item.isComplete ? "secondary" : "outline"}>
                      {item.isComplete
                        ? "Concluído"
                        : item.primary
                          ? "Principal"
                          : "Pendente"}
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
