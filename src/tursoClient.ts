// src/tursoClient.ts
import { createClient } from "@libsql/client";

const turso = createClient({
    url: import.meta.env.VITE_TURSO_DB_URL as string,
    authToken: import.meta.env.VITE_TURSO_DB_TOKEN as string,
});

export default turso;
