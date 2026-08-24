PRAGMA application_id = 0x44534850;
PRAGMA user_version = 17;

CREATE TABLE persistence_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  store_id TEXT NOT NULL
) STRICT;
INSERT INTO persistence_state VALUES (1, '00000000-0000-4000-8000-000000000017');

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  cwd TEXT,
  parent_session TEXT,
  seed_length INTEGER,
  origin TEXT,
  delegation_depth INTEGER,
  agent_preset TEXT,
  incarnation TEXT NOT NULL,
  revision INTEGER NOT NULL
) STRICT;

CREATE TABLE events (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  time INTEGER NOT NULL,
  data ANY NOT NULL,
  source_event_seqs ANY,
  surface_op TEXT,
  ignorable INTEGER CHECK (ignorable IS NULL OR ignorable IN (0, 1)),
  PRIMARY KEY (session_id, seq)
) STRICT;

INSERT INTO sessions VALUES ('v17-session', 1, 17, '/v17', NULL, NULL, NULL, NULL, NULL, '00000000-0000-4000-8000-000000000117', 0);
