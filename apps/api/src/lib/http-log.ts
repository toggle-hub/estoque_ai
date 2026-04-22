import type { Context } from "hono";
import type { Env as HonoPinoEnv } from "hono-pino";

/**
 * Marks a request as failed with a specific reason in the structured response log.
 *
 * @param c Hono request context.
 * @param reason Failure reason written to the response log.
 */
export const logErrorResponse = (c: Context<HonoPinoEnv>, reason: string) => {
  const logger = c.get("logger");

  logger.assign({
    error: {
      reason,
    },
  });
  logger.setResMessage(reason);
  logger.setResLevel("warn");
};

/**
 * Marks a request as failed without exposing a more specific internal reason.
 *
 * @param c Hono request context.
 */
export const logGenericErrorResponse = (c: Context<HonoPinoEnv>) => {
  const logger = c.get("logger");

  logger.setResMessage("Request failed");
  logger.setResLevel("warn");
};
