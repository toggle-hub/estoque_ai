Refactor the current logging @ `/apps/api` to use `https://github.com/maou-shonen/hono-pino` 

# Usage
```import { Hono } from 'hono'
import { pinoLogger } from 'hono-pino'

const app = new Hono()
  .use(
    pinoLogger({
      pino: {level: "debug"}
    }),
  )
  .get((c) => {
    const { logger } = c.var;

    const token = c.req.header("Authorization") ?? "";
    logger.debug({ token });

    const user = getAuthorizedUser(token);
    logger.assign({ user });

    const posts = getPosts();
    logger.assign({ posts });


    logger.setResMessage("Get posts success"); // optional

    return c.text("");
  });

await app.request("/", {
  headers: {
    Authorization: "Bearer token",
  },
});

// output (formatted for easier reading)
{"level":20, "token":"Bearer token"}
{
  "level": 30,
  "msg": "Get posts success",
  "user": {
    "id": 1,
    "name": "john"
  },
  "posts": [
    {
      "id": 1,
      "title": "My first post"
    },
    {
      "id": 2,
      "title": "My second post"
    }
  ],
  "req": {
    "headers": {
      "authorization": "Bearer token"
    },
    "method": "GET",
    "url": "/"
  },
  "reqId": 1,
  "res": {
    "headers": {},
    "status": 200
  },
  "responseTime": 2
}```