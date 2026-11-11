-- One row per device in a room: its sealed piece and when it last changed.
CREATE TABLE IF NOT EXISTS pieces (
  room    TEXT NOT NULL,
  device  TEXT NOT NULL,
  piece   TEXT NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY (room, device)
);
CREATE INDEX IF NOT EXISTS pieces_updated ON pieces (updated);
