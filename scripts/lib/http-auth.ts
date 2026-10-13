/** The `Authorization` header value for HTTP Basic Auth. UTF-8, so a password with accents or emoji works. */
export function basicAuthHeader(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`, "utf8").toString("base64")}`;
}

export type Credentials = { user: string; password: string };

/** Reads `--user/--password` flags first, then BASIC_AUTH_USER / BASIC_AUTH_PASSWORD. Both or neither. */
export function credentialsFrom(argv: readonly string[], env: Record<string, string | undefined>): Credentials | undefined {
  const flag = (name: string) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const user = flag("user") ?? env.BASIC_AUTH_USER;
  const password = flag("password") ?? env.BASIC_AUTH_PASSWORD;
  if (!user && !password) return undefined;
  if (!user || !password) throw new Error("Give both a user and a password (--user/--password or BASIC_AUTH_USER/BASIC_AUTH_PASSWORD)");
  return { user, password };
}
