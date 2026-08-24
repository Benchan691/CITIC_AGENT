ALTER TABLE events RENAME TO events_v16;
ALTER TABLE sessions RENAME TO sessions_v16;

CREATE TABLE sessions (
  id               TEXT PRIMARY KEY,
  version          INTEGER NOT NULL,
  created_at       INTEGER NOT NULL,
  cwd              TEXT,
  parent_session   TEXT,
  seed_length      INTEGER,
  origin           TEXT,
  delegation_depth INTEGER,
  agent_preset     TEXT,
  incarnation      TEXT NOT NULL,
  revision         INTEGER NOT NULL,
  folder_id        TEXT REFERENCES folders(id) ON DELETE SET NULL
) STRICT;

INSERT INTO sessions
  (id, version, created_at, cwd, parent_session, seed_length, origin,
   delegation_depth, agent_preset, incarnation, revision, folder_id)
SELECT id, version, created_at, cwd, parent_session, seed_length, origin,
       delegation_depth, agent_preset, incarnation, revision, folder_id
FROM sessions_v16;

CREATE TABLE events (
  session_id        TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  seq               INTEGER NOT NULL,
  type              TEXT NOT NULL,
  time              INTEGER NOT NULL,
  data              ANY NOT NULL,
  source_event_seqs ANY,
  surface_op        TEXT,
  ignorable         INTEGER CHECK (ignorable IS NULL OR ignorable IN (0, 1)),
  PRIMARY KEY (session_id, seq)
) STRICT;

INSERT INTO events (session_id, seq, type, time, data, surface_op, ignorable)
SELECT session_id, seq, type, time, data, surface_op, ignorable
FROM events_v16;

DROP TABLE events_v16;
DROP TABLE sessions_v16;

CREATE INDEX sessions_folder_id_idx ON sessions(folder_id);

PRAGMA user_version = 18;
