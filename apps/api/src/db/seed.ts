import "dotenv/config";
import { hash } from "bcrypt";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  alertsTable,
  categoriesTable,
  itemsTable,
  locationsTable,
  organizationsTable,
  stockLevelsTable,
  transactionsTable,
  usageMetricsTable,
  userOrganizationsTable,
  usersTable,
} from "./schema";

const seedPassword = "password123";

const ids = {
  organization: "10000000-0000-4000-8000-000000000001",
  adminUser: "10000000-0000-4000-8000-000000000002",
  managerUser: "10000000-0000-4000-8000-000000000003",
  viewerUser: "10000000-0000-4000-8000-000000000004",
  adminMembership: "10000000-0000-4000-8000-000000000005",
  managerMembership: "10000000-0000-4000-8000-000000000006",
  viewerMembership: "10000000-0000-4000-8000-000000000007",
  mainLocation: "10000000-0000-4000-8000-000000000008",
  storeLocation: "10000000-0000-4000-8000-000000000009",
  electronicsCategory: "10000000-0000-4000-8000-000000000010",
  suppliesCategory: "10000000-0000-4000-8000-000000000011",
  headsetItem: "10000000-0000-4000-8000-000000000012",
  keyboardItem: "10000000-0000-4000-8000-000000000013",
  paperItem: "10000000-0000-4000-8000-000000000014",
  headsetMainStock: "10000000-0000-4000-8000-000000000015",
  headsetStoreStock: "10000000-0000-4000-8000-000000000016",
  keyboardMainStock: "10000000-0000-4000-8000-000000000017",
  paperMainStock: "10000000-0000-4000-8000-000000000018",
  receivingTransaction: "10000000-0000-4000-8000-000000000019",
  saleTransaction: "10000000-0000-4000-8000-000000000020",
  adjustmentTransaction: "10000000-0000-4000-8000-000000000021",
  lowStockAlert: "10000000-0000-4000-8000-000000000022",
  usageMetric: "10000000-0000-4000-8000-000000000023",
} as const;

/**
 * Prints seed credentials and exits before any database work.
 */
const printHelp = () => {
  console.log(`Usage: pnpm --filter api db:seed

Seeds a local development database with one organization, users, locations, categories,
items, stock levels, immutable transactions, alerts, and usage metrics.

Required env:
  DATABASE_URL=postgresql://admin:secret@localhost:5432/mydb

Seed login:
  admin@estoquei.test / ${seedPassword}
  manager@estoquei.test / ${seedPassword}
  viewer@estoquei.test / ${seedPassword}`);
};

/**
 * Returns the database connection string from the environment.
 *
 * @returns PostgreSQL connection string.
 */
const getDatabaseUrl = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed the database");
  }

  return process.env.DATABASE_URL;
};

/**
 * Inserts or updates the demo records used by local development.
 */
const runSeed = async () => {
  const pool = new Pool({ connectionString: getDatabaseUrl() });
  const db = drizzle(pool);
  const passwordHash = await hash(seedPassword, 10);

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(organizationsTable)
        .values({
          id: ids.organization,
          name: "Estoquei Demo Ltda",
          cnpj: "12.345.678/0001-90",
          email: "contato@estoquei.test",
          phone: "+55 11 4002-8922",
          plan_type: "profissional",
        })
        .onConflictDoUpdate({
          target: organizationsTable.id,
          set: {
            name: "Estoquei Demo Ltda",
            cnpj: "12.345.678/0001-90",
            email: "contato@estoquei.test",
            phone: "+55 11 4002-8922",
            plan_type: "profissional",
            deleted_at: null,
            updated_at: new Date(),
          },
        });

      await tx
        .insert(usersTable)
        .values([
          {
            id: ids.adminUser,
            email: "admin@estoquei.test",
            name: "Admin Demo",
            password_hash: passwordHash,
            is_active: true,
          },
          {
            id: ids.managerUser,
            email: "manager@estoquei.test",
            name: "Manager Demo",
            password_hash: passwordHash,
            is_active: true,
          },
          {
            id: ids.viewerUser,
            email: "viewer@estoquei.test",
            name: "Viewer Demo",
            password_hash: passwordHash,
            is_active: true,
          },
        ])
        .onConflictDoUpdate({
          target: usersTable.id,
          set: {
            password_hash: passwordHash,
            is_active: true,
            deleted_at: null,
            updated_at: new Date(),
          },
        });

      await tx
        .insert(userOrganizationsTable)
        .values([
          {
            id: ids.adminMembership,
            user_id: ids.adminUser,
            organization_id: ids.organization,
            role: "admin",
          },
          {
            id: ids.managerMembership,
            user_id: ids.managerUser,
            organization_id: ids.organization,
            role: "manager",
          },
          {
            id: ids.viewerMembership,
            user_id: ids.viewerUser,
            organization_id: ids.organization,
            role: "viewer",
          },
        ])
        .onConflictDoUpdate({
          target: userOrganizationsTable.id,
          set: {
            deleted_at: null,
            updated_at: new Date(),
          },
        });

      await tx
        .insert(locationsTable)
        .values([
          {
            id: ids.mainLocation,
            organization_id: ids.organization,
            name: "Centro de Distribuicao",
            address: "Av. Paulista, 1000 - Sao Paulo, SP",
            is_active: true,
          },
          {
            id: ids.storeLocation,
            organization_id: ids.organization,
            name: "Loja Centro",
            address: "Rua XV de Novembro, 120 - Curitiba, PR",
            is_active: true,
          },
        ])
        .onConflictDoUpdate({
          target: locationsTable.id,
          set: {
            is_active: true,
            deleted_at: null,
            updated_at: new Date(),
          },
        });

      await tx
        .insert(categoriesTable)
        .values([
          {
            id: ids.electronicsCategory,
            organization_id: ids.organization,
            name: "Eletronicos",
            description: "Produtos eletronicos e perifericos",
          },
          {
            id: ids.suppliesCategory,
            organization_id: ids.organization,
            name: "Suprimentos",
            description: "Materiais de escritorio e consumo",
          },
        ])
        .onConflictDoUpdate({
          target: categoriesTable.id,
          set: {
            deleted_at: null,
          },
        });

      await tx
        .insert(itemsTable)
        .values([
          {
            id: ids.headsetItem,
            organization_id: ids.organization,
            category_id: ids.electronicsCategory,
            sku: "HEAD-USB-001",
            name: "Headset USB",
            description: "Headset USB com microfone",
            unit_price: "149.90",
            reorder_point: 10,
            is_active: true,
          },
          {
            id: ids.keyboardItem,
            organization_id: ids.organization,
            category_id: ids.electronicsCategory,
            sku: "KEY-ABNT2-001",
            name: "Teclado ABNT2",
            description: "Teclado USB padrao ABNT2",
            unit_price: "89.90",
            reorder_point: 8,
            is_active: true,
          },
          {
            id: ids.paperItem,
            organization_id: ids.organization,
            category_id: ids.suppliesCategory,
            sku: "PAP-A4-500",
            name: "Papel A4 500 folhas",
            description: "Resma de papel sulfite A4",
            unit_price: "29.90",
            reorder_point: 20,
            is_active: true,
          },
        ])
        .onConflictDoUpdate({
          target: itemsTable.id,
          set: {
            is_active: true,
            deleted_at: null,
            updated_at: new Date(),
          },
        });

      await tx
        .insert(stockLevelsTable)
        .values([
          {
            id: ids.headsetMainStock,
            organization_id: ids.organization,
            location_id: ids.mainLocation,
            item_id: ids.headsetItem,
            quantity: 25,
          },
          {
            id: ids.headsetStoreStock,
            organization_id: ids.organization,
            location_id: ids.storeLocation,
            item_id: ids.headsetItem,
            quantity: 6,
          },
          {
            id: ids.keyboardMainStock,
            organization_id: ids.organization,
            location_id: ids.mainLocation,
            item_id: ids.keyboardItem,
            quantity: 14,
          },
          {
            id: ids.paperMainStock,
            organization_id: ids.organization,
            location_id: ids.mainLocation,
            item_id: ids.paperItem,
            quantity: 120,
          },
        ])
        .onConflictDoUpdate({
          target: stockLevelsTable.id,
          set: {
            updated_at: new Date(),
          },
        });

      await tx
        .insert(transactionsTable)
        .values([
          {
            id: ids.receivingTransaction,
            organization_id: ids.organization,
            location_id: ids.mainLocation,
            item_id: ids.headsetItem,
            type: "RECEIVING",
            quantity: 30,
            previous_quantity: 0,
            new_quantity: 30,
            reference: "NF-000123",
            notes: "Carga inicial de headsets",
            performed_by: ids.adminUser,
          },
          {
            id: ids.saleTransaction,
            organization_id: ids.organization,
            location_id: ids.mainLocation,
            item_id: ids.headsetItem,
            type: "SALE",
            quantity: -5,
            previous_quantity: 30,
            new_quantity: 25,
            reference: "PED-000456",
            notes: "Venda para cliente demo",
            performed_by: ids.managerUser,
          },
          {
            id: ids.adjustmentTransaction,
            organization_id: ids.organization,
            location_id: ids.storeLocation,
            item_id: ids.headsetItem,
            type: "ADJUSTMENT",
            quantity: -1,
            previous_quantity: 7,
            new_quantity: 6,
            reference: "AJUSTE-0001",
            notes: "Ajuste de inventario fisico",
            performed_by: ids.adminUser,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(alertsTable)
        .values({
          id: ids.lowStockAlert,
          organization_id: ids.organization,
          item_id: ids.headsetItem,
          location_id: ids.storeLocation,
          message: "Headset USB esta abaixo do ponto de reposicao na Loja Centro",
          is_read: false,
        })
        .onConflictDoUpdate({
          target: alertsTable.id,
          set: {
            is_read: false,
            deleted_at: null,
          },
        });

      await tx
        .insert(usageMetricsTable)
        .values({
          id: ids.usageMetric,
          organization_id: ids.organization,
          date: "2026-04-01",
          transaction_count: 3,
        })
        .onConflictDoUpdate({
          target: usageMetricsTable.id,
          set: {
            transaction_count: 3,
          },
        });
    });
  } finally {
    await pool.end();
  }
};

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
} else {
  runSeed()
    .then(() => {
      console.log("Database seeded.");
      console.log(`Demo users use password: ${seedPassword}`);
    })
    .catch((error) => {
      console.error("Database seed failed.");
      console.error(error);
      process.exitCode = 1;
    });
}
