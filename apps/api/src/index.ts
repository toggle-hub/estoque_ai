import "./env";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { Env as HonoPinoEnv } from "hono-pino";
import { env } from "./env";
import { logGenericErrorResponse } from "./lib/http-log";
import { httpLogger } from "./logger";
import { auth } from "./routes/auth.route";
import { locations } from "./routes/location.route";
import { organizations } from "./routes/organization.route";

export const app = new Hono<HonoPinoEnv>().basePath("/api");

app.use(
  "*",
  cors({
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    origin: env.WEB_ORIGIN,
  }),
);
app.use("*", httpLogger);

app.onError((error, c) => {
  const logger = c.get("logger");

  logger.error(
    {
      error,
    },
    "Unhandled request error",
  );
  logGenericErrorResponse(c);

  if (error instanceof HTTPException) {
    return error.getResponse();
  }

  return c.json({ error: "Internal server error" }, 500);
});

app.get("/", (c) => c.text("Hello Hono!"));
app.route("/", auth);
app.route("/", locations);
app.route("/", organizations);
