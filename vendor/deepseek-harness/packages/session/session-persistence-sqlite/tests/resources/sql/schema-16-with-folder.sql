PRAGMA application_id = 0x44534850;
PRAGMA user_version = 16;

CREATE TABLE persistence_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  store_id TEXT NOT NULL
) STRICT;
INSERT INTO persistence_state VALUES (1, '00000000-0000-4000-8000-000000000016');

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;
INSERT INTO folders VALUES ('folder-16', 'Legacy folder', NULL, 16, 16);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  cwd TEXT,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
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
  data TEXT NOT NULL,
  surface_op TEXT,
  ignorable INTEGER,
  PRIMARY KEY (session_id, seq)
) STRICT;

CREATE INDEX sessions_folder_id_idx ON sessions(folder_id);
INSERT INTO sessions VALUES ('v16-session', 1, 16, '/v16', 'folder-16', NULL, NULL, NULL, NULL, NULL, '00000000-0000-4000-8000-000000000116', 0);
INSERT INTO events VALUES ('v16-session', 0, 'turn/start', 16, '{}', NULL, NULL);
