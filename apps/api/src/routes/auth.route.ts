import { compare, hash } from "bcrypt";
import { eq } from "drizzle-orm";
import { Context, Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { JWTPayload } from "hono/utils/jwt/types";
import { getLogger } from "hono-pino";
import { z } from "zod";
import { db } from "../db";
import { usersTable } from "../db/schema";
import { env } from "../env";

const auth = new Hono().basePath("/auth");

const registerSchema = z.object({
    email: z.email(),
    name: z.string().trim().min(1),
    password: z.string().min(8),
});

const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
});

type UserRecord = typeof usersTable.$inferSelect;

const sanitizeUser = (user: UserRecord) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at,
});

const getBearerToken = (authorizationHeader?: string | null) => {
    if (!authorizationHeader) {
        return null;
    }

    const [scheme, token] = authorizationHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
        return null;
    }

    return token;
};

const logErrorResponse = (c: Context, reason: string) => {
    const logger = getLogger(c);

    logger.assign({
        error: {
            reason,
        },
    });
    logger.setResMessage(reason);
    logger.setResLevel("warn");
};

const logGenericErrorResponse = (c: Context) => {
    const logger = getLogger(c);

    logger.setResMessage("Request failed");
    logger.setResLevel("warn");
};

auth.post("/register", async (c) => {
    const payload = await c.req.json().catch(() => null);
    const parsed = registerSchema.safeParse(payload);

    if (!parsed.success) {
        logErrorResponse(c, "Invalid request body");
        return c.json({ error: "Invalid request body", issues: parsed.error.flatten() }, 400);
    }

    const [existingUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, parsed.data.email))
        .limit(1);

    if (existingUser) {
        logGenericErrorResponse(c);
        return c.json({ error: "Email already in use" }, 409);
    }

    const hashedPassword = await hash(parsed.data.password, env.BCRYPT_SALT);

    const [user] = await db
        .insert(usersTable)
        .values({
            email: parsed.data.email,
            name: parsed.data.name,
            password_hash: hashedPassword,
        })
        .returning();

    const safeUser = sanitizeUser(user);
    const token = await sign({ sub: user.id, user: safeUser }, env.JWT_SECRET);

    return c.json({ token, user: safeUser }, 201);
});

auth.post("/login", async (c) => {
    const payload = await c.req.json().catch(() => null);
    const parsed = loginSchema.safeParse(payload);

    if (!parsed.success) {
        logErrorResponse(c, "Invalid request body");
        return c.json({ error: "Invalid request body", issues: parsed.error.flatten() }, 400);
    }

    const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, parsed.data.email))
        .limit(1);

    if (!user) {
        logErrorResponse(c, "Invalid credentials");
        return c.json({ error: "Invalid credentials" }, 401);
    }

    const passwordMatches = await compare(parsed.data.password, user.password_hash);

    if (!passwordMatches) {
        logErrorResponse(c, "Invalid credentials");
        return c.json({ error: "Invalid credentials" }, 401);
    }

    const safeUser = sanitizeUser(user);
    const token = await sign({ sub: user.id, user: safeUser }, env.JWT_SECRET);

    return c.json({ token, user: safeUser });
});

auth.get("/me", async (c) => {
    const token = getBearerToken(c.req.header("authorization"));

    if (!token) {
        logErrorResponse(c, "Missing or invalid authorization header");
        return c.json({ error: "Missing or invalid authorization header" }, 401);
    }
    let payload: JWTPayload & { sub?: string }
    try {
        payload = await verify(token, env.JWT_SECRET, "HS256");
    } catch {
        logErrorResponse(c, "Invalid token");
        return c.json({ error: "Invalid token" }, 401);
    }

    if (!payload.sub) {
        logErrorResponse(c, "Invalid token payload");
        return c.json({ error: "Invalid token payload" }, 401);
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.sub)).limit(1);

    if (!user) {
        logErrorResponse(c, "User not found");
        return c.json({ error: "User not found" }, 404);
    }

    return c.json({ user: sanitizeUser(user) });
});

export { auth };
