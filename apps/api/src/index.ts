import "./env";
import { Hono } from "hono";
import { httpLogger } from "./logger";
import { auth } from "./routes/auth.route";

export const app = new Hono().basePath("/api");

app.use("*", httpLogger);

app.get("/", (c) => c.text("Hello Hono!"));
app.route("/", auth);
