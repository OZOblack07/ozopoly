/**
 * Server-only PostgreSQL connection.
 *
 * Ozopoly uses Supabase Postgres in production through DATABASE_URL.
 */

export type DbSource = "supabase";

export const dbSource: DbSource = "supabase";

export interface Sql {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;

  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
}

const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;

const identity = (value: string) => value;

const globalRef = globalThis as typeof globalThis & {
  __supabasePgSqlPromise__?: Promise<Sql>;
};

function toSql(
  run: <T>(text: string, params: unknown[]) => Promise<T[]>,
): Sql {
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    let text = strings[0];

    for (let i = 0; i < values.length; i += 1) {
      text += `$${i + 1}${strings[i + 1]}`;
    }

    return run<T>(text, values);
  }) as unknown as Sql;

  sql.query = <T = Record<string, unknown>>(
    text: string,
    params: unknown[] = [],
  ) => run<T>(text, params);

  return sql;
}

function createPostgresSql(): Promise<Sql> {
  globalRef.__supabasePgSqlPromise__ ??= (async () => {
    const databaseUrl = process.env.DATABASE_URL?.trim();

    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is required. Configure your Supabase Postgres connection string.",
      );
    }

    const { Pool, types } = await import("pg");

    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_INTERVAL, identity);

    const pool = new Pool({
      connectionString: databaseUrl,
    });

    return toSql(async <T>(text: string, params: unknown[]) => {
      const result = await pool.query(text, params);
      return result.rows as T[];
    });
  })().catch((error) => {
    globalRef.__supabasePgSqlPromise__ = undefined;
    throw error;
  });

  return globalRef.__supabasePgSqlPromise__;
}

let sqlPromise: Promise<Sql> | null = null;

async function createSql(): Promise<Sql> {
  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/db is server-only. Use getSql() only from server functions or server routes.",
    );
  }

  return createPostgresSql();
}

export function getSql(): Promise<Sql> {
  sqlPromise ??= createSql().catch((error) => {
    sqlPromise = null;
    throw error;
  });

  return sqlPromise;
}

/**
 * Database bootstrap is handled by the Supabase database itself.
 * Migrations are applied separately with `npm run db:migrate`.
 */
export function ensureDbReady(): Promise<void> {
  return Promise.resolve();
}
