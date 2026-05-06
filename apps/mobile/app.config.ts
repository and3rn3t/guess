import appJson from "./app.json";

const config = {
  ...appJson.expo,
  extra: {
    ...((appJson.expo as { extra?: Record<string, unknown> }).extra ?? {}),
    apiBaseUrl:
      typeof process.env.EXPO_PUBLIC_API_BASE_URL === "string"
        ? process.env.EXPO_PUBLIC_API_BASE_URL.trim()
        : "",
  },
};

export default {
  expo: config,
};