-- Serialize metadata writers with deletion, enforce canonical cutoff, preserve sealed data.
CREATE FUNCTION guard_audio_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recording recordings%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.object_key,0));
 SELECT * INTO recording FROM recordings WHERE id=NEW.recording_id FOR UPDATE;
 IF recording.status <> 'STAGING' THEN RAISE EXCEPTION 'Recording is not writable' USING ERRCODE='23514'; END IF;
 IF NEW.end_ms > recording.cutoff_ms THEN RAISE EXCEPTION 'Audio exceeds cutoff' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM recording_manifests WHERE recording_id=NEW.recording_id) THEN
   RAISE EXCEPTION 'Manifest already sealed' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM deletion_tombstones WHERE object_key=NEW.object_key) THEN
   RAISE EXCEPTION 'Object key has been erased' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER audio_write_guard BEFORE INSERT OR UPDATE ON audio_segments FOR EACH ROW EXECUTE FUNCTION guard_audio_write();
CREATE FUNCTION guard_transcript_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recording recordings%ROWTYPE;
BEGIN
 SELECT * INTO recording FROM recordings WHERE id=NEW.recording_id FOR UPDATE;
 IF recording.status <> 'COMPLETE' OR NEW.end_ms>recording.cutoff_ms THEN
   RAISE EXCEPTION 'Transcript requires a complete recording within cutoff' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER transcript_write_guard BEFORE INSERT OR UPDATE ON transcript_segments FOR EACH ROW EXECUTE FUNCTION guard_transcript_write();
