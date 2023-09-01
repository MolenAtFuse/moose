--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------

CREATE TABLE thing (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL,
    class_        TEXT NOT NULL,
    data          JSON
);

CREATE INDEX thing_ix_title ON thing (title);

CREATE TABLE hold (
    holderId INTEGER NOT NULL,
    heldId INTEGER NOT NULL,
    
    CONSTRAINT holds_fk_holderId FOREIGN KEY (holderId)
        REFERENCES thing (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT holds_fk_heldId FOREIGN KEY (heldId)
        REFERENCES thing (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE user (
    id          INTEGER PRIMARY KEY,
    username    TEXT NOT NULL,
    pwdhash     TEXT NOT NULL,
  
    CONSTRAINT users_fk_id FOREIGN KEY (id)
        REFERENCES thing (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX user_ix_username ON user (username);


INSERT INTO thing (id, class_, title, description, data) VALUES
    (1, 'Player', 'molen', 'A colony of sponges', json('{"locationId":3}'));
INSERT INTO user (id, username,pwdhash) VALUES (1, 'molen', '4b8202c19fd44f6ce3ef76621a403d669d62a2fb1f903c17163d6dc35757aa94');

INSERT INTO thing (id, class_, title, description) VALUES
    (2, 'Place', 'The Void', 'An unspeakable amount of nothing surrounds you, although you feel the energy of potential creation crackling just beneath the surface.'),
    (3, 'Place', 'The Lobby', 'The lobby of a grand hotel. The marble floor and columns are polished and cool. Chairs are tucked around low tables, with copious lush plants providing privacy and peace.');


INSERT INTO hold (holderId, heldId) VALUES
    (3, 1);

--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------

DROP INDEX user_ix_username;
DROP TABLE users;
DROP TABLE holds;
DROP INDEX thing_ix_title;
DROP TABLE things;
