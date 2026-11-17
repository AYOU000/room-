ALTER TABLE debate_sessions ADD COLUMN "eventSequence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "mediaClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mediaGrantExpiresAt" TIMESTAMP(3);
ALTER TABLE debate_participants ADD COLUMN "microphoneReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "audioObservedAt" TIMESTAMP(3), ADD COLUMN "disconnectDeadline" TIMESTAMP(3);
