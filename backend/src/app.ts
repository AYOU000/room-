import express, { type Request } from "express";
import cors from "cors";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { loadSecurityConfig, type SecurityConfig } from "./security/config.js";
import { AppError, errorHandler, notFound } from "./security/errors.js";
import { requestContext, securityHeaders, requireJson, validateOrigin } from "./security/http.js";
import { createRateLimiter } from "./security/rate-limit.js";
import { mediaTokenRequestSchema, validateBody } from "./security/validation.js";

// Members 1 and 2 supply verified authentication, membership, consent and state.
// Never return browser-selected identities from a production authorizer.
export type AuthorizedMedia = { roomName: string; identity: string };
export type MediaAuthorizer = (request: Request) => Promise<AuthorizedMedia>;
export type AuditRecord = {
  requestId: string; method: string; route: string; status: number;
  errorCode?: string; durationMs: number;
};

export function createApp(options: {
  config?: SecurityConfig;
  authorizeMedia?: MediaAuthorizer;
  audit?: (record: AuditRecord) => void;
} = {}) {
  const config = options.config ?? loadSecurityConfig();
  const app = express();
  app.disable("x-powered-by");
  // Only explicitly trusted proxy IPs may influence per-client limits.
  app.set("trust proxy", config.trustedProxies);
  app.use(requestContext(options.audit ?? ((record) => console.info(JSON.stringify(record)))));
  app.use(securityHeaders(config));
  app.use(validateOrigin(config.allowedOrigins));
  app.use(cors({
    origin: (origin, done) => done(null, !!origin && config.allowedOrigins.includes(origin)),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    exposedHeaders: ["X-Request-ID", "Retry-After"],
    maxAge: 600,
  }));
  app.use(createRateLimiter({ limit: config.ipLimit, windowMs: 15 * 60_000 }));
  app.use(requireJson);
  app.use(express.json({ limit: "16kb", strict: true, inflate: false }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "room-api" });
  });

  app.post("/api/rooms/token", validateBody(mediaTokenRequestSchema), async (req, res) => {
    let media: AuthorizedMedia;
    if (options.authorizeMedia) {
      media = await options.authorizeMedia(req);
      const checked = mediaTokenRequestSchema.safeParse(media);
      if (!checked.success) throw new AppError(503, "SERVICE_UNAVAILABLE");
      media = checked.data;
    } else if (config.allowDevMediaTokens && config.environment !== "production") {
      media = req.body;
    } else {
      throw new AppError(503, "MEDIA_AUTHORIZATION_UNAVAILABLE");
    }
    if (!config.livekitApiKey || !config.livekitApiSecret) {
      throw new AppError(503, "SERVICE_UNAVAILABLE");
    }
    const token = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
      identity: media.identity, ttl: "5m",
    });
    token.addGrant({
      roomJoin: true, room: media.roomName,
      canPublish: true, canPublishSources: [TrackSource.MICROPHONE],
      canSubscribe: true, canPublishData: false,
      canUpdateOwnMetadata: false, roomAdmin: false, roomRecord: false,
    });
    res.json({ ...media, token: await token.toJwt(), serverUrl: config.livekitPublicUrl });
  });
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
