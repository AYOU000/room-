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

function isLoopback(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "[::1]" ||
    (isIPv4(url.hostname) && url.hostname.startsWith("127."));
}

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
        !["http:", "https:"].includes(url.protocol) ||
        (url.protocol === "http:" && (production || !isLoopback(url)))) {
      throw new Error("ALLOWED_ORIGINS must contain exact origins; HTTP is only allowed on development loopback.");
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
      (mediaUrl.protocol === "ws:" && (production || !isLoopback(mediaUrl)))) {
    throw new Error("LIVEKIT_PUBLIC_URL must use WSS outside development loopback.");
  }
  if (production && (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET ||
      Buffer.byteLength(env.LIVEKIT_API_SECRET) < 32 ||
      env.LIVEKIT_API_KEY.startsWith("replace-with-") || env.LIVEKIT_API_SECRET.startsWith("replace-with-"))) {
    throw new Error("Production requires a non-placeholder LiveKit key and at least 32 bytes of secret material.");
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
