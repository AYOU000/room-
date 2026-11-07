CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'ACTIVE', 'CANCELLED', 'CLOSED');
CREATE TYPE "SessionState" AS ENUM ('WAITING', 'ACTIVE', 'FINISHING', 'ENDED', 'CANCELLED');
CREATE TYPE "SessionEndReason" AS ENUM ('TIMER', 'USER_END', 'DISCONNECT', 'SERVICE_FAILURE');
CREATE TYPE "EvaluationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNAVAILABLE');

CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "inviteCodeHash" VARCHAR(64) NOT NULL,
    "inviteExpiresAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rooms_durationSeconds_check" CHECK ("durationSeconds" BETWEEN 120 AND 1800)
);

CREATE TABLE "debate_sessions" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "topicSnapshot" VARCHAR(200) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "state" "SessionState" NOT NULL DEFAULT 'WAITING',
    "endReason" "SessionEndReason",
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "evaluationStatus" "EvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "captureComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "debate_sessions_durationSeconds_check" CHECK ("durationSeconds" BETWEEN 120 AND 1800)
);

CREATE TABLE "debate_participants" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "slot" INTEGER NOT NULL,
    "consentAt" TIMESTAMP(3),
    "consentVersion" VARCHAR(64),
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "audioConnected" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_participants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "debate_participants_slot_check" CHECK ("slot" IN (1, 2))
);

CREATE UNIQUE INDEX "rooms_inviteCodeHash_key" ON "rooms"("inviteCodeHash");
CREATE INDEX "rooms_creatorId_createdAt_idx" ON "rooms"("creatorId", "createdAt");
CREATE UNIQUE INDEX "debate_sessions_roomId_key" ON "debate_sessions"("roomId");
CREATE INDEX "debate_sessions_state_endsAt_idx" ON "debate_sessions"("state", "endsAt");
CREATE UNIQUE INDEX "debate_participants_sessionId_userId_key" ON "debate_participants"("sessionId", "userId");
CREATE UNIQUE INDEX "debate_participants_sessionId_slot_key" ON "debate_participants"("sessionId", "slot");
CREATE INDEX "debate_participants_userId_joinedAt_idx" ON "debate_participants"("userId", "joinedAt");

ALTER TABLE "rooms" ADD CONSTRAINT "rooms_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "debate_sessions" ADD CONSTRAINT "debate_sessions_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "debate_participants" ADD CONSTRAINT "debate_participants_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "debate_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "debate_participants" ADD CONSTRAINT "debate_participants_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
