import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("native builds validate the Backend URL without requiring the old web frontend URL", () => {
  const result = spawnSync(process.execPath, ["scripts/validate-env.mjs"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      EXPO_PUBLIC_WEB_URL: "",
      EXPO_PUBLIC_API_BASE_URL: "http://10.0.2.2:4001",
      EXPO_PUBLIC_SUPABASE_URL: "https://auth.example.test",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
    },
  });
  assert.equal(result.status, 0, result.stderr);
});

test("push builds require Firebase client config but ordinary builds do not", () => {
  const script =
    "import configure from './app.config.ts'; console.log(JSON.stringify(configure({config:{name:'MangaDock',slug:'mangadock',android:{package:'com.mangadock.mobile'}}})));";
  const run = (enabled: string, configFile: string) =>
    spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: new URL("../", import.meta.url),
      encoding: "utf8",
      env: {
        ...process.env,
        EXPO_PUBLIC_PUSH_ENABLED: enabled,
        GOOGLE_SERVICES_JSON: configFile,
        EXPO_PUBLIC_EAS_PROJECT_ID: "00000000-0000-4000-8000-000000000001",
      },
    });
  assert.equal(run("false", "").status, 0);
  const missing = run("true", "");
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /require GOOGLE_SERVICES_JSON/);
  const configured = run("true", "./google-services.json");
  assert.equal(configured.status, 0, configured.stderr);
  assert.equal(
    JSON.parse(configured.stdout).android.googleServicesFile,
    "./google-services.json",
  );
});
