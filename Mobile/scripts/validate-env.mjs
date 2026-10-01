const required = [
  "EXPO_PUBLIC_WEB_URL",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
];

const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(`Missing required mobile environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

for (const name of ["EXPO_PUBLIC_WEB_URL", "EXPO_PUBLIC_SUPABASE_URL"]) {
  try {
    new URL(process.env[name]);
  } catch {
    console.error(`${name} must be an absolute URL.`);
    process.exit(1);
  }
}

console.log("Mobile environment is configured.");
