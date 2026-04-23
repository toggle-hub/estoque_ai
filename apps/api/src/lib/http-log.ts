import type { Context } from "hono";
import type { Env as HonoPinoEnv } from "hono-pino";

type LoggerEnv = HonoPinoEnv;

/**
 * Marks a request as failed with a specific reason in the structured response log.
 *
 * @param c Hono request context.
 * @param reason Failure reason written to the response log.
 */
export const logErrorResponse = <E extends LoggerEnv>(c: Context<E>, reason: string) => {
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
export const logGenericErrorResponse = <E extends LoggerEnv>(c: Context<E>) => {
  const logger = c.get("logger");

  logger.setResMessage("Request failed");
  logger.setResLevel("warn");
};
