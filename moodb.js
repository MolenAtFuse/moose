const sqlite3 = require('sqlite3').verbose();
const sqlite = require('sqlite');

const moo = require('./moo');
const mooser = require('./mooser');


const DbConfig = {
    filename: './data/moose.db',
    driver: sqlite3.Database,
};


let db = null;
const allThings = new Map();

const init = async () => {    
    console.log('[db] opening db');
    db = await sqlite.open(DbConfig);

    console.log('[db] migrating db');
    await db.migrate();

    console.log('[db] loading things');
    try {
        await db.each('SELECT * FROM thing', [], (err, row) => {
            if (err) {
                throw err;
            }

            const thing = moo.thingFactory(row);
            allThings.set(thing.id, thing);
        });

    } catch (e) {
        console.error(e);
    }
    console.log(`[db] loaded ${allThings.size} things`);
};


const getById = id => {
    return allThings.get(id);
};


const findThingByTitle = title => {
    for (let thing of allThings.values()) {
        if (thing.title == title) {
            return thing;
        }
    }
    return null;
};


const authenticateUser = async (username, pwdHash) => {
    console.log(`[db] authUser ${username}`);

    const row = await db.get('SELECT * FROM user WHERE username = ?', username);

    if (!row) {
        throw new Error(`unknown user: '${username}`);
    }

    if (row.pwdhash != pwdHash) {
        throw new Error('bad password');
    }

    const player = getById(row.id);
    if (!player) {
        throw new Error(`corrupted db: user id ${row.id} has no matching Player`);
    }

    return player;
};


module.exports = {
    init,

    getById,
    findThingByTitle,

    authenticateUser,
};