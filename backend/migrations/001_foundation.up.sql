CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username varchar(32) NOT NULL UNIQUE CHECK (length(username) >= 3),
 email text NOT NULL UNIQUE, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE topics (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL UNIQUE, description text, category text);
CREATE TABLE rooms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), creator_id uuid NOT NULL REFERENCES users(id), topic_id uuid REFERENCES topics(id),
 custom_topic text NOT NULL, status text NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING','READY','SOLO_ROUND','OPEN_ROUND','EVALUATION','COMPLETED','CANCELLED','ABANDONED','EVALUATION_FAILED')),
 solo_duration_sec integer NOT NULL CHECK (solo_duration_sec BETWEEN 300 AND 600),
 open_duration_sec integer NOT NULL CHECK (open_duration_sec BETWEEN 300 AND 900),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE participants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL REFERENCES rooms(id), user_id uuid NOT NULL REFERENCES users(id),
 side text NOT NULL CHECK (side IN ('PRO','CON')), is_ready boolean NOT NULL DEFAULT false,
 connection_status text NOT NULL DEFAULT 'DISCONNECTED' CHECK (connection_status IN ('CONNECTED','DISCONNECTED')),
 joined_at timestamptz NOT NULL DEFAULT now(), UNIQUE(room_id,user_id), UNIQUE(room_id,side), UNIQUE(room_id,id)
);
CREATE TABLE rounds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL REFERENCES rooms(id), type text NOT NULL CHECK (type IN ('SOLO','OPEN')),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACTIVE','COMPLETED')),
 started_at timestamptz, ends_at timestamptz, ended_at timestamptz,
 CHECK (ends_at IS NULL OR (started_at IS NOT NULL AND ends_at > started_at)),
 CHECK (status = 'PENDING' OR (started_at IS NOT NULL AND ends_at IS NOT NULL)),
 UNIQUE(room_id,type), UNIQUE(room_id,id)
);
CREATE INDEX rounds_expiry_idx ON rounds(ends_at) WHERE status='ACTIVE';
CREATE TABLE scores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL, round_id uuid NOT NULL, participant_id uuid NOT NULL,
 factual_score numeric(5,2) NOT NULL CHECK(factual_score BETWEEN 0 AND 100),
 persuasion_score numeric(5,2) NOT NULL CHECK(persuasion_score BETWEEN 0 AND 100),
 round_score numeric(5,2) GENERATED ALWAYS AS (round((factual_score+persuasion_score)/2,2)) STORED,
 feedback jsonb NOT NULL DEFAULT '{}', evaluated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(round_id,participant_id),
 FOREIGN KEY(room_id,round_id) REFERENCES rounds(room_id,id), FOREIGN KEY(room_id,participant_id) REFERENCES participants(room_id,id)
);
CREATE TABLE results (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL, participant_id uuid NOT NULL,
 solo_score numeric(5,2) NOT NULL CHECK(solo_score BETWEEN 0 AND 100), open_score numeric(5,2) NOT NULL CHECK(open_score BETWEEN 0 AND 100),
 final_score numeric(5,2) GENERATED ALWAYS AS (round((solo_score+open_score)/2,2)) STORED,
 outcome text NOT NULL CHECK(outcome IN ('WIN','LOSS','DRAW')), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(room_id,participant_id), FOREIGN KEY(room_id,participant_id) REFERENCES participants(room_id,id)
);
CREATE INDEX participants_history_idx ON participants(user_id,joined_at DESC,id);
CREATE TABLE recording_consents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL, participant_id uuid NOT NULL,
 policy_version text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), withdrawn_at timestamptz,
 CHECK(withdrawn_at IS NULL OR withdrawn_at >= granted_at),
 FOREIGN KEY(room_id,participant_id) REFERENCES participants(room_id,id), UNIQUE(room_id,participant_id,id)
);
CREATE TABLE recordings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL, round_id uuid NOT NULL, participant_id uuid NOT NULL, consent_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'STAGING' CHECK(status IN ('STAGING','COMPLETE','FAILED','DELETING','DELETED')),
 mime_type text NOT NULL CHECK(mime_type IN ('audio/webm','audio/ogg','audio/mp4','audio/wav')),
 cutoff_ms bigint NOT NULL CHECK(cutoff_ms > 0), created_at timestamptz NOT NULL DEFAULT now(), retention_until timestamptz NOT NULL,
 FOREIGN KEY(room_id,round_id) REFERENCES rounds(room_id,id),
 FOREIGN KEY(room_id,participant_id) REFERENCES participants(room_id,id),
 FOREIGN KEY(room_id,participant_id,consent_id) REFERENCES recording_consents(room_id,participant_id,id),
 UNIQUE(room_id,id), UNIQUE(room_id,round_id,participant_id,id)
);
CREATE INDEX recordings_retention_idx ON recordings(retention_until) WHERE status NOT IN ('DELETING','DELETED');
CREATE TABLE audio_tracks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL, recording_id uuid NOT NULL,
 round_id uuid NOT NULL, participant_id uuid NOT NULL, media_track_id text NOT NULL,
 FOREIGN KEY(room_id,round_id,participant_id,recording_id) REFERENCES recordings(room_id,round_id,participant_id,id),
 UNIQUE(recording_id,media_track_id), UNIQUE(room_id,recording_id,id)
);
CREATE TABLE audio_segments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL, recording_id uuid NOT NULL, track_id uuid NOT NULL,
 sequence integer NOT NULL CHECK(sequence >= 0), start_ms bigint NOT NULL CHECK(start_ms >= 0), end_ms bigint NOT NULL CHECK(end_ms > start_ms),
 object_key text NOT NULL UNIQUE CHECK(object_key ~ '^recordings/[A-Za-z0-9/_-]+\.[a-z0-9]+$'),
 sha256 char(64) NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), bytes bigint NOT NULL CHECK(bytes > 0),
 FOREIGN KEY(room_id,recording_id,track_id) REFERENCES audio_tracks(room_id,recording_id,id), UNIQUE(track_id,sequence), UNIQUE(track_id,start_ms)
);
CREATE TABLE recording_manifests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL, recording_id uuid NOT NULL UNIQUE,
 version integer NOT NULL CHECK(version > 0), manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
 sha256 char(64) NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), sealed_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(room_id,recording_id) REFERENCES recordings(room_id,id)
);
CREATE TABLE transcript_segments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL, recording_id uuid NOT NULL, track_id uuid NOT NULL,
 sequence integer NOT NULL CHECK(sequence >= 0), start_ms bigint NOT NULL CHECK(start_ms >= 0), end_ms bigint NOT NULL CHECK(end_ms > start_ms),
 language text NOT NULL, content text NOT NULL, provider text NOT NULL, model_version text NOT NULL,
 FOREIGN KEY(room_id,recording_id,track_id) REFERENCES audio_tracks(room_id,recording_id,id), UNIQUE(track_id,sequence)
);
CREATE INDEX transcript_room_cursor_idx ON transcript_segments(room_id,recording_id,start_ms,id);
CREATE INDEX transcript_search_idx ON transcript_segments USING gin(to_tsvector('simple',content));
CREATE TABLE jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, dedupe_key text NOT NULL UNIQUE, payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RUNNING','SUCCEEDED','FAILED')),
 available_at timestamptz NOT NULL DEFAULT now(), owner text, lease_until timestamptz, fence bigint NOT NULL DEFAULT 0,
 attempts integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 5 CHECK(max_attempts > 0), last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 CHECK((status='RUNNING') = (owner IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX jobs_claim_idx ON jobs(available_at,created_at) WHERE status IN ('PENDING','RUNNING');
CREATE TABLE outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, dedupe_key text NOT NULL UNIQUE, payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz
);
CREATE INDEX outbox_pending_idx ON outbox(created_at) WHERE delivered_at IS NULL;
-- No cascading FK: tombstones must survive metadata removal and restores.
CREATE TABLE deletion_tombstones (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recording_id uuid NOT NULL, object_key text NOT NULL UNIQUE,
 reason text NOT NULL CHECK(reason IN ('RETENTION','CONSENT','USER_REQUEST','ORPHAN')),
 requested_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX tombstones_pending_idx ON deletion_tombstones(requested_at) WHERE deleted_at IS NULL;
