import { createMiddleware } from "@tanstack/react-start";
import { requireUserId } from "./verify.server";

export const authMiddleware = createMiddleware({ type: "function" })
  .server(async ({ next }) => {
    const userId = await requireUserId();

    return next({
      context: {
        userId,
      },
    });
  });
