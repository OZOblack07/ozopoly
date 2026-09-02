import { createMiddleware } from "@tanstack/react-start";
import { getSessionUser } from "@/lib/auth/verify.server";

export const optionalAuth = createMiddleware({ type: "function" })
  .server(async ({ next }) => {
    const user = await getSessionUser();

    return next({
      context: {
        user,
        userId: user?.id ?? null,
      },
    });
  });
