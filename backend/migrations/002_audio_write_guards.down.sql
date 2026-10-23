DROP TRIGGER transcript_write_guard ON transcript_segments;
DROP FUNCTION guard_transcript_write();
DROP TRIGGER audio_write_guard ON audio_segments;
DROP FUNCTION guard_audio_write();
