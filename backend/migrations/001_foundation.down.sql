-- Destructive: export/verify backup and stop all writers before running.
DROP TABLE deletion_tombstones, outbox, jobs, transcript_segments, recording_manifests, audio_segments, audio_tracks,
 recordings, recording_consents, results, scores, rounds, participants, rooms, topics, users;
