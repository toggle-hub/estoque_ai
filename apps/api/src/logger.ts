import pino from "pino";
import { pinoLogger } from "hono-pino";
import { env } from "./env";

export const httpLogger = pinoLogger({
  pino: {
    base: null,
    level: env.LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  http: {
    onReqBindings: (c) => ({
      req: {
        method: c.req.method,
        url: c.req.path,
      },
    }),
    onReqMessage: () => "Request started",
    onResBindings: (c) => ({
      res: {
        status: c.res.status,
      },
    }),
    onResMessage: () => "Request completed",
  },
});
