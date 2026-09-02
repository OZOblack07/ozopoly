import { createSupabaseServerClient } from "@/lib/supabase/server";

const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

export const authConfigured = true;

export const DEV_USER_ID = "dev-user";

export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export type VerifiedUser = {
  id: string;
  email: string | null;
};

export async function getSessionUser(): Promise<VerifiedUser | null> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
  };
}

export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();

  if (!user) {
    if (!databaseConfigured) {
      return DEV_USER_ID;
    }

    throw new UnauthorizedError();
  }

  return user.id;
}
