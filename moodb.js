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


const getById = id => {
    return allThings.get(id);
};


const loadAllTheThings = async (db) => {
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

    console.log(`[db] ...loaded ${allThings.size} things`);
};

const linkHolders = async (db) => {
    console.log('[db] putting everything in its right place');

    try {
        await db.each('SELECT * FROM hold', [], (err, row) => {
            if (err) {
                throw err;
            }

            const holder = getById(row.holderId);
            const held = getById(row.heldId);

            holder.holds.push(held);
        });

    } catch (e) {
        console.error(e);
    }
};


const init = async () => {    
    console.log('[db] opening db');
    db = await sqlite.open(DbConfig);

    console.log('[db] migrating db');
    await db.migrate();

    await loadAllTheThings(db);
    await linkHolders(db);
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


const createUser = async (username, pwdHash) => {
    console.log(`[db] createUser ${username}`);

    // hm, this feels wrong...
    const thing = await db.run(`INSERT INTO thing (class_, title, description) VALUES ('Player',?,'A mysterious stranger')`, username);
    const playerId = thing.lastID;
    console.log(`[db] ... created Player as id ${playerId}`);

    await db.run('INSERT INTO user (id, username, pwdhash) VALUES (?,?,?)', playerId, username, pwdHash);

    // this feels even wronger
    const row = await db.get('SELECT * FROM thing WHERE id=?', playerId);
    const player = moo.thingFactory(row);
    allThings.set(player.id, player);

    return player;
};



const isUsernameTaken = async (username) => {
    const row = await db.get('SELECT * FROM user WHERE username = ?', username);
    return (typeof row !== 'undefined');
};


module.exports = {
    init,

    getById,
    findThingByTitle,

    authenticateUser,
    createUser,
    isUsernameTaken,
};