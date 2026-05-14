"use client";

import { AlertCircle, Building2, Check, RefreshCw } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import type { Organization } from "../../lib/api";
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
import { Spinner } from "../ui/spinner";

type OrganizationSelectionViewProps = {
  errorMessage?: string;
  isCreating?: boolean;
  isLoading?: boolean;
  onCreate?: (input: { name: string }) => Promise<void>;
  onRetry?: () => void;
  onSelect?: (organizationId: string) => void;
  organizations: Organization[];
  selectedOrganizationId?: string | null;
};

/**
 * Renders organization selection states and membership options.
 *
 * @param props Selection view props.
 * @returns Organization selection UI.
 */
export function OrganizationSelectionView({
  errorMessage,
  isCreating = false,
  isLoading = false,
  onCreate,
  onRetry,
  onSelect,
  organizations,
  selectedOrganizationId,
}: OrganizationSelectionViewProps) {
  const [organizationName, setOrganizationName] = useState("");
  const hasOrganizations = organizations.length > 0;

  /**
   * Submits a new organization for the current user.
   *
   * @param event Form submit event.
   */
  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!onCreate || !organizationName.trim()) {
      return;
    }

    try {
      await onCreate({ name: organizationName.trim() });
    } catch {
      return;
    }

    setOrganizationName("");
  };

  return (
    <main className="min-h-svh bg-white text-[#16151c]">
      <section className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-6 py-10 max-[640px]:px-4">
        <header className="mb-8 flex items-center justify-between gap-4 border-b border-purple-100 pb-5">
          <div>
            <p className="m-0 text-sm font-medium text-purple-500">
              Contexto da organização
            </p>
            <h1 className="m-0 mt-1 text-2xl leading-8 font-semibold tracking-normal">
              Selecionar organização
            </h1>
          </div>
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-purple-500 text-white">
            <Building2 size={21} aria-hidden="true" />
          </span>
        </header>

        {isLoading ? (
          <div className="grid flex-1 place-items-center">
            <div className="flex items-center gap-3 text-sm text-[#5c6670]">
              <Spinner />
              <span>Carregando organizações</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="grid flex-1 place-items-center">
            <Alert className="w-full max-w-md" variant="destructive">
              <AlertTitle className="flex items-center gap-2">
                <AlertCircle size={18} aria-hidden="true" />
                Não foi possível carregar as organizações
              </AlertTitle>
              <AlertDescription className="mb-4 text-[#6f2f2a]">
                {errorMessage}
              </AlertDescription>
              {onRetry ? (
                <Button
                  className="border-[#b42318] text-[#b42318] hover:bg-[#fff5f4]"
                  type="button"
                  variant="outline"
                  onClick={onRetry}
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  Tentar novamente
                </Button>
              ) : null}
            </Alert>
          </div>
        ) : null}

        {!isLoading && !errorMessage && !hasOrganizations ? (
          <div className="grid flex-1 place-items-center">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Nenhuma organização disponível</CardTitle>
                <CardDescription>
                  Sua conta ainda não pertence a uma organização ativa.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : null}

        {!isLoading && !errorMessage && hasOrganizations ? (
          <div className="grid gap-3">
            {organizations.map((organization) => {
              const isSelected = organization.id === selectedOrganizationId;

              return (
                <Card
                  key={organization.id}
                  className="transition-colors hover:border-purple-500 hover:bg-purple-50"
                >
                  <CardContent className="grid grid-cols-[1fr_auto] items-center gap-4 p-4">
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold">
                        {organization.name}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-2">
                        <Badge className="capitalize">
                          {organization.role}
                        </Badge>
                        {organization.plan_type ? (
                          <Badge variant="secondary">
                            {organization.plan_type}
                          </Badge>
                        ) : null}
                        {organization.cnpj ? (
                          <Badge variant="outline">{organization.cnpj}</Badge>
                        ) : null}
                        {organization.email ? (
                          <Badge variant="outline">{organization.email}</Badge>
                        ) : null}
                      </span>
                    </span>
                    <Button
                      aria-label={`Selecionar ${organization.name}`}
                      aria-pressed={isSelected}
                      size="icon"
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => onSelect?.(organization.id)}
                    >
                      {isSelected ? (
                        <Check aria-hidden="true" />
                      ) : (
                        <Building2 aria-hidden="true" />
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}

        {!isLoading && !errorMessage ? (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Criar organização</CardTitle>
              <CardDescription>
                Crie um novo espaço de empresa e troque para ele depois.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-3 sm:flex-row"
                onSubmit={handleCreate}
              >
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Nome da organização</span>
                  <input
                    className="h-10 w-full min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    disabled={!onCreate}
                    onChange={(event) =>
                      setOrganizationName(event.target.value)
                    }
                    placeholder="Nome da organização"
                    value={organizationName}
                  />
                </label>
                <Button
                  disabled={!onCreate || isCreating || !organizationName.trim()}
                  type="submit"
                >
                  Criar organização
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  );
}
