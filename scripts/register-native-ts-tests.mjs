import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Pure unit tests may import modules that also expose DB-backed operations.
// Keep those imports inert without requiring production credentials or a DB connection.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://unit-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "unit-test-service-role-key";

register(new URL("./resolve-native-ts-tests.mjs", import.meta.url), pathToFileURL(`${process.cwd()}/`));
