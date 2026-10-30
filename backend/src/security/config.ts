import { isIPv4 } from "node:net";

export type SecurityConfig = {
  environment: "development" | "test" | "production";
  allowedOrigins: string[];
  trustedProxies: string[];
  allowDevMediaTokens: boolean;
  livekitApiKey?: string;
  livekitApiSecret?: string;
  livekitPublicUrl: string;
  ipLimit: number;
};

export function loadSecurityConfig(env: NodeJS.ProcessEnv = process.env): SecurityConfig {
  const environment = env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(environment)) {
    throw new Error("NODE_ENV must be development, test or production.");
  }
  const production = environment === "production";
  const origins = (env.ALLOWED_ORIGINS ?? (production ? "" : "http://localhost:5173,http://localhost:8080"))
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (!origins.length) throw new Error("ALLOWED_ORIGINS must name at least one origin.");
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || url.username || url.password ||
        !["http:", "https:"].includes(url.protocol) || (production && url.protocol !== "https:")) {
      throw new Error("ALLOWED_ORIGINS must contain exact origins (HTTPS in production).");
    }
  }
  if (env.ENABLE_DEV_MEDIA_TOKENS && !["true", "false"].includes(env.ENABLE_DEV_MEDIA_TOKENS)) {
    throw new Error("ENABLE_DEV_MEDIA_TOKENS must be true or false.");
  }
  const allowDevMediaTokens = env.ENABLE_DEV_MEDIA_TOKENS === "true";
  if (production && allowDevMediaTokens) throw new Error("Development media tokens are forbidden in production.");
  const livekitPublicUrl = env.LIVEKIT_PUBLIC_URL ?? "ws://localhost:7880";
  const mediaUrl = new URL(livekitPublicUrl);
  if (!["ws:", "wss:"].includes(mediaUrl.protocol) || mediaUrl.username || mediaUrl.password ||
      (production && mediaUrl.protocol !== "wss:")) {
    throw new Error("LIVEKIT_PUBLIC_URL must use WS (development) or WSS (production).");
  }
  const ipLimit = Number(env.RATE_LIMIT_IP_MAX ?? "60");
  if (!Number.isSafeInteger(ipLimit) || ipLimit < 1 || ipLimit > 10_000) {
    throw new Error("RATE_LIMIT_IP_MAX must be an integer between 1 and 10000.");
  }
  const trustedProxies = (env.TRUSTED_PROXY_IPS ?? "").split(",").map((ip) => ip.trim()).filter(Boolean);
  if (trustedProxies.some((ip) => !isIPv4(ip))) {
    throw new Error("TRUSTED_PROXY_IPS must contain individual IPv4 addresses.");
  }
  return {
    environment: environment as SecurityConfig["environment"], allowedOrigins: origins,
    trustedProxies, allowDevMediaTokens, livekitPublicUrl, ipLimit,
    livekitApiKey: env.LIVEKIT_API_KEY, livekitApiSecret: env.LIVEKIT_API_SECRET,
  };
}
