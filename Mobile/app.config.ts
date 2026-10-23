import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID || config.extra?.eas?.projectId;
  if (
    process.env.EXPO_PUBLIC_PUSH_ENABLED === "true" &&
    !process.env.GOOGLE_SERVICES_JSON
  )
    throw new Error(
      "Push builds require GOOGLE_SERVICES_JSON for com.mangadock.mobile.",
    );
  if (
    process.env.EXPO_PUBLIC_PUSH_ENABLED === "true" &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      projectId ?? "",
    )
  )
    throw new Error("Push builds require a valid EXPO_PUBLIC_EAS_PROJECT_ID.");
  return {
    ...config,
    name: config.name ?? "MangaDock",
    slug: config.slug ?? "mangadock",
    extra: {
      ...config.extra,
      eas: { ...config.extra?.eas, projectId: projectId ?? "" },
    },
    android: {
      ...config.android,
      ...(process.env.GOOGLE_SERVICES_JSON
        ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
        : {}),
    },
  };
};
