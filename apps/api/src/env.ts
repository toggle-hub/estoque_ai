import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url().startsWith("postgresql://", {
    message: "DATABASE_URL must be a PostgreSQL connection string",
  }),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  BCRYPT_SALT: z.string().regex(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{22}$/, {
    message: "BCRYPT_SALT must be a valid bcrypt salt",
  }),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment variables:\n${formattedErrors}`);
}

export const env = parsedEnv.data;
