import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const createdAt = timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp({ withTimezone: true }).notNull().defaultNow();

export const transactionTypeEnum = pgEnum("transaction_type", [
  "RECEIVING",
  "SALE",
  "TRANSFER",
  "ADJUSTMENT",
]);

export const organizationsTable = pgTable("organizations", {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  cnpj: varchar({ length: 18 }).unique(),
  email: varchar({ length: 255 }),
  phone: varchar({ length: 20 }),
  plan_type: varchar({ length: 50 }).default("essencial"),
  created_at: createdAt,
  updated_at: updatedAt,
});

export const usersTable = pgTable(
  "users",
  {
    id: uuid().defaultRandom().primaryKey(),
    organization_id: uuid().references(() => organizationsTable.id, {
      onDelete: "cascade",
    }),
    email: varchar({ length: 255 }).notNull(),
    password_hash: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    role: varchar({ length: 50 }).default("viewer"),
    is_active: boolean().default(true),
    created_at: createdAt,
    updated_at: updatedAt,
  },
  (table) => [uniqueIndex("users_organization_email_unique").on(table.organization_id, table.email)],
);

export const locationsTable = pgTable(
  "locations",
  {
    id: uuid().defaultRandom().primaryKey(),
    organization_id: uuid().references(() => organizationsTable.id, {
      onDelete: "cascade",
    }),
    name: varchar({ length: 255 }).notNull(),
    address: text(),
    is_active: boolean().default(true),
    created_at: createdAt,
    updated_at: updatedAt,
  },
  (table) => [index("idx_locations_org").on(table.organization_id)],
);

export const categoriesTable = pgTable(
  "categories",
  {
    id: uuid().defaultRandom().primaryKey(),
    organization_id: uuid().references(() => organizationsTable.id, {
      onDelete: "cascade",
    }),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_categories_org").on(table.organization_id)],
);

export const itemsTable = pgTable(
  "items",
  {
    id: uuid().defaultRandom().primaryKey(),
    organization_id: uuid().references(() => organizationsTable.id, {
      onDelete: "cascade",
    }),
    category_id: uuid().references(() => categoriesTable.id),
    sku: varchar({ length: 100 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    unit_price: numeric({ precision: 10, scale: 2 }),
    reorder_point: integer().default(0),
    is_active: boolean().default(true),
    created_at: createdAt,
    updated_at: updatedAt,
  },
  (table) => [
    uniqueIndex("items_organization_sku_unique").on(table.organization_id, table.sku),
    index("idx_items_org").on(table.organization_id),
    index("idx_items_sku").on(table.sku),
  ],
);

export const stockLevelsTable = pgTable(
  "stock_levels",
  {
    id: uuid().defaultRandom().primaryKey(),
    organization_id: uuid().references(() => organizationsTable.id, {
      onDelete: "cascade",
    }),
    location_id: uuid().references(() => locationsTable.id, {
      onDelete: "cascade",
    }),
    item_id: uuid().references(() => itemsTable.id, {
      onDelete: "cascade",
    }),
    quantity: integer().notNull().default(0),
    created_at: createdAt,
    updated_at: updatedAt,
  },
  (table) => [
    uniqueIndex("stock_levels_location_item_unique").on(table.location_id, table.item_id),
    index("idx_stock_org_location").on(table.organization_id, table.location_id),
    index("idx_stock_item").on(table.item_id),
  ],
);

export const transactionsTable = pgTable(
  "transactions",
  {
    id: uuid().defaultRandom().primaryKey(),
    organization_id: uuid().references(() => organizationsTable.id, {
      onDelete: "cascade",
    }),
    location_id: uuid().references(() => locationsTable.id),
    item_id: uuid().references(() => itemsTable.id),
    type: transactionTypeEnum().notNull(),
    quantity: integer().notNull(),
    previous_quantity: integer().notNull(),
    new_quantity: integer().notNull(),
    reference: varchar({ length: 255 }),
    notes: text(),
    performed_by: uuid().references(() => usersTable.id),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_transactions_org").on(table.organization_id),
    index("idx_transactions_item").on(table.item_id),
    index("idx_transactions_created").on(table.created_at),
  ],
);

export const alertsTable = pgTable(
  "alerts",
  {
    id: uuid().defaultRandom().primaryKey(),
    organization_id: uuid().references(() => organizationsTable.id, {
      onDelete: "cascade",
    }),
    item_id: uuid().references(() => itemsTable.id),
    location_id: uuid().references(() => locationsTable.id),
    message: text().notNull(),
    is_read: boolean().default(false),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_alerts_org").on(table.organization_id),
    index("idx_alerts_unread").on(table.is_read),
  ],
);

export const usageMetricsTable = pgTable(
  "usage_metrics",
  {
    id: uuid().defaultRandom().primaryKey(),
    organization_id: uuid().references(() => organizationsTable.id, {
      onDelete: "cascade",
    }),
    date: date().notNull(),
    transaction_count: integer().default(0),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("usage_metrics_organization_date_unique").on(table.organization_id, table.date),
    index("idx_usage_org_date").on(table.organization_id, table.date),
  ],
);

export const organizationsRelations = relations(organizationsTable, ({ many }) => ({
  users: many(usersTable),
  locations: many(locationsTable),
  categories: many(categoriesTable),
  items: many(itemsTable),
  stock_levels: many(stockLevelsTable),
  transactions: many(transactionsTable),
  alerts: many(alertsTable),
  usage_metrics: many(usageMetricsTable),
}));

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  organization: one(organizationsTable, {
    fields: [usersTable.organization_id],
    references: [organizationsTable.id],
  }),
  transactions: many(transactionsTable),
}));

export const locationsRelations = relations(locationsTable, ({ one, many }) => ({
  organization: one(organizationsTable, {
    fields: [locationsTable.organization_id],
    references: [organizationsTable.id],
  }),
  stock_levels: many(stockLevelsTable),
  transactions: many(transactionsTable),
  alerts: many(alertsTable),
}));

export const categoriesRelations = relations(categoriesTable, ({ one, many }) => ({
  organization: one(organizationsTable, {
    fields: [categoriesTable.organization_id],
    references: [organizationsTable.id],
  }),
  items: many(itemsTable),
}));

export const itemsRelations = relations(itemsTable, ({ one, many }) => ({
  organization: one(organizationsTable, {
    fields: [itemsTable.organization_id],
    references: [organizationsTable.id],
  }),
  category: one(categoriesTable, {
    fields: [itemsTable.category_id],
    references: [categoriesTable.id],
  }),
  stock_levels: many(stockLevelsTable),
  transactions: many(transactionsTable),
  alerts: many(alertsTable),
}));

export const stockLevelsRelations = relations(stockLevelsTable, ({ one }) => ({
  organization: one(organizationsTable, {
    fields: [stockLevelsTable.organization_id],
    references: [organizationsTable.id],
  }),
  location: one(locationsTable, {
    fields: [stockLevelsTable.location_id],
    references: [locationsTable.id],
  }),
  item: one(itemsTable, {
    fields: [stockLevelsTable.item_id],
    references: [itemsTable.id],
  }),
}));

export const transactionsRelations = relations(transactionsTable, ({ one }) => ({
  organization: one(organizationsTable, {
    fields: [transactionsTable.organization_id],
    references: [organizationsTable.id],
  }),
  location: one(locationsTable, {
    fields: [transactionsTable.location_id],
    references: [locationsTable.id],
  }),
  item: one(itemsTable, {
    fields: [transactionsTable.item_id],
    references: [itemsTable.id],
  }),
  performed_by_user: one(usersTable, {
    fields: [transactionsTable.performed_by],
    references: [usersTable.id],
  }),
}));

export const alertsRelations = relations(alertsTable, ({ one }) => ({
  organization: one(organizationsTable, {
    fields: [alertsTable.organization_id],
    references: [organizationsTable.id],
  }),
  item: one(itemsTable, {
    fields: [alertsTable.item_id],
    references: [itemsTable.id],
  }),
  location: one(locationsTable, {
    fields: [alertsTable.location_id],
    references: [locationsTable.id],
  }),
}));

export const usageMetricsRelations = relations(usageMetricsTable, ({ one }) => ({
  organization: one(organizationsTable, {
    fields: [usageMetricsTable.organization_id],
    references: [organizationsTable.id],
  }),
}));
