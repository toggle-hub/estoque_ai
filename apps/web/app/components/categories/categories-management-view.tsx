"use client";

import { AlertCircle, Boxes, Plus, RotateCw, Tags } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import type { Category, CategoryInput, Organization } from "../../lib/api";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Spinner } from "../ui/spinner";

export type CategoriesManagementViewProps = {
  categories: Category[];
  createErrorMessage?: string;
  errorMessage?: string;
  isCreating?: boolean;
  isLoading?: boolean;
  onCreate?: (input: CategoryInput) => Promise<void>;
  onRetry?: () => void;
  organization?: Organization | null;
};

const writeRoles = new Set(["admin", "manager"]);

/**
 * Formats API timestamps for category detail cards.
 *
 * @param value ISO timestamp.
 * @returns Localized date copy.
 */
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
  }).format(new Date(value));

/**
 * Renders organization-scoped category management.
 *
 * @param props View props.
 * @returns Categorias management UI.
 */
export function CategoriesManagementView({
  categories,
  createErrorMessage,
  errorMessage,
  isCreating = false,
  isLoading = false,
  onCreate,
  onRetry,
  organization,
}: CategoriesManagementViewProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const role = organization?.role?.toLowerCase() ?? "viewer";
  const canCreate = writeRoles.has(role);
  const hasCategories = categories.length > 0;

  /**
   * Submits a new category when the user can manage taxonomy.
   *
   * @param event Form submit event.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canCreate || !onCreate || !name.trim()) {
      return;
    }

    try {
      await onCreate({
        description: description.trim() || undefined,
        name: name.trim(),
      });
    } catch {
      return;
    }

    setName("");
    setDescription("");
  };

  if (isLoading) {
    return (
      <main className="grid min-h-[calc(100svh-4rem)] place-items-center bg-white p-6 md:min-h-screen">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100svh-4rem)] bg-white p-4 text-[#16151c] md:min-h-screen md:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-purple-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="m-0 text-sm font-medium text-purple-600">
              {organization?.name ?? "Organização selecionada"}
            </p>
            <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal">Categorias</h1>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[#5c6670]">
              Gerencie a taxonomia de produtos usada por itens de estoque e relatórios.
            </p>
          </div>
          <Badge variant={canCreate ? "secondary" : "outline"}>
            {canCreate ? "Pode criar categorias" : "Acesso somente leitura"}
          </Badge>
        </header>

        {!organization ? (
          <Alert variant="destructive">
            <AlertTitle>Nenhuma organização selecionada</AlertTitle>
            <AlertDescription>Selecione uma organização antes de gerenciar categorias.</AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar as categorias</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {organization && !canCreate ? (
          <Alert variant="warning">
            <AlertTitle>Acesso de visualizador</AlertTitle>
            <AlertDescription>
              Visualizadores podem revisar detalhes de categorias, mas não podem criar registros de taxonomia.
            </AlertDescription>
          </Alert>
        ) : null}

        {canCreate ? (
          <Card>
            <CardHeader>
              <CardTitle>Criar categoria</CardTitle>
              <CardDescription>Adicione um grupo de produtos que pode ser reutilizado nos formulários de itens.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]"
                onSubmit={handleSubmit}
              >
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-purple-700">Nome</span>
                  <input
                    className="h-10 min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Eletrônicos"
                    required
                    value={name}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-purple-700">Descrição</span>
                  <input
                    className="h-10 min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Dispositivos, acessórios e peças"
                    value={description}
                  />
                </label>
                <Button className="self-end" disabled={isCreating || !name.trim()} type="submit">
                  {isCreating ? <RotateCw className="animate-spin" /> : <Plus />}
                  Adicionar categoria
                </Button>
              </form>
              {createErrorMessage ? (
                <p className="m-0 mt-3 text-sm text-[#b42318]" role="alert">
                  {createErrorMessage}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {!errorMessage && !hasCategories ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Nenhuma categoria ainda</CardTitle>
              <CardDescription>
                {canCreate
                  ? "Crie a primeira categoria para organizar produtos nos fluxos de itens."
                  : "Nenhuma categoria está disponível para esta organização ainda."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {hasCategories ? (
          <section className="grid gap-4 lg:grid-cols-2" aria-label="Categorias da organização">
            {categories.map((category) => (
              <Card key={category.id}>
                <CardHeader>
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex min-w-0 items-center gap-2 text-base">
                        <Tags className="size-4 shrink-0 text-purple-500" />
                        <span className="truncate">{category.name}</span>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {category.description ?? "Sem descrição"}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">Ativa</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium text-purple-700">Criada</dt>
                      <dd className="m-0 mt-1 font-semibold">{formatDate(category.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-purple-700">ID da categoria</dt>
                      <dd className="m-0 mt-1 truncate font-mono text-xs">{category.id}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </section>
        ) : null}

        {errorMessage && onRetry ? (
          <Button className="w-fit" onClick={onRetry} type="button" variant="outline">
            <AlertCircle />
            Retry
          </Button>
        ) : null}

        {!errorMessage && hasCategories ? (
          <div className="inline-flex items-center gap-2 text-sm text-purple-700">
            <Boxes className="size-4" />
            {categories.length} {categories.length === 1 ? "categoria" : "categorias"}
          </div>
        ) : null}
      </div>
    </main>
  );
}
