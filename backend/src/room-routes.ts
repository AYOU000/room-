import { Router, type RequestHandler, type Response } from "express";
import { AppError } from "./security-errors.js";
import {
  createRoomSchema,
  emptyBodySchema,
  joinRoomSchema,
  parseInput,
  readySchema,
  updateRoomSchema,
  uuidSchema,
  validateBody,
} from "./security-validation.js";
import {
  authenticateMember1,
  type RoomLifecycleService,
} from "./room-lifecycle.js";

function authenticatedUserId(res: Response): string {
  const userId = res.locals.authenticatedUserId;
  if (typeof userId !== "string") throw new AppError(503, "SERVICE_UNAVAILABLE");
  const parsed = uuidSchema.safeParse(userId);
  if (!parsed.success) throw new AppError(503, "SERVICE_UNAVAILABLE");
  return parsed.data;
}

function pathUuid(value: unknown): string {
  return parseInput(uuidSchema, value);
}

export function createRoomRouter(options: {
  service: RoomLifecycleService;
  authenticate?: RequestHandler;
  consentVersion?: string;
  now?: () => Date;
}) {
  const router = Router();
  const authenticate = options.authenticate ?? authenticateMember1;
  const consentVersion = options.consentVersion ?? "privacy-v1";
  const now = options.now ?? (() => new Date());

  // Member 1 replaces the default fail-closed middleware with verified auth.
  router.post("/api/rooms", authenticate, validateBody(createRoomSchema), async (req, res) => {
    const body = req.body as ReturnType<typeof createRoomSchema.parse>;
    const created = await options.service.createRoom({
      creatorId: authenticatedUserId(res),
      title: body.title,
      description: body.description,
      durationSeconds: body.durationSeconds,
      now: now(),
    });
    res.status(201).json({ ...created.snapshot, inviteCode: created.inviteCode });
  });

  router.post("/api/rooms/join", authenticate, validateBody(joinRoomSchema), async (req, res) => {
    const body = req.body as ReturnType<typeof joinRoomSchema.parse>;
    const snapshot = await options.service.joinRoom(authenticatedUserId(res), body.inviteCode, now());
    res.status(200).json(snapshot);
  });

  router.patch("/api/rooms/:roomId", authenticate, validateBody(updateRoomSchema), async (req, res) => {
    const body = req.body as ReturnType<typeof updateRoomSchema.parse>;
    const snapshot = await options.service.updateRoom(
      pathUuid(req.params.roomId), authenticatedUserId(res), body, now(),
    );
    res.status(200).json(snapshot);
  });

  router.post("/api/rooms/:roomId/ready", authenticate, validateBody(readySchema), async (req, res) => {
    const body = req.body as ReturnType<typeof readySchema.parse>;
    if (body.consentVersion !== consentVersion) throw new AppError(409, "STATE_CONFLICT");
    const snapshot = await options.service.setReady(
      pathUuid(req.params.roomId), authenticatedUserId(res), body.consentVersion, body.ready, now(),
    );
    res.status(200).json(snapshot);
  });

  router.post("/api/rooms/:roomId/start", authenticate, validateBody(emptyBodySchema), async (req, res) => {
    const snapshot = await options.service.startRoom(
      pathUuid(req.params.roomId), authenticatedUserId(res), consentVersion, now(),
    );
    res.status(200).json(snapshot);
  });

  router.post("/api/sessions/:sessionId/finish", authenticate, validateBody(emptyBodySchema), async (req, res) => {
    const snapshot = await options.service.finishSession(
      pathUuid(req.params.sessionId), authenticatedUserId(res), now(),
    );
    res.status(200).json(snapshot);
  });

  return router;
}

export { authenticateMember1 };
