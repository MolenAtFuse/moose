const sqlite3 = require('sqlite3').verbose();
const sqlite = require('sqlite');

// NB. moo loaded after exports defined to fix circular deps


const DbConfig = {
    filename: './data/moose.db',
    driver: sqlite3.Database,
};


let db = null;
let dbReady = false;
const allThings = new Map();



const loadAllTheThings = async (db) => {
    console.log('[db] loading things');

    try {
        await db.each('SELECT * FROM thing', [], (err, row) => {
            if (err) {
                throw err;
            }

            const thing = moo.thingFactory(row);
            allThings.set(+thing.id, thing);
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

    // foreign key constraints are disabled by default so we need to enable them
    await db.run('PRAGMA foreign_keys = ON');

    console.log('[db] migrating db');
    await db.migrate();

    await loadAllTheThings(db);
    await linkHolders(db);

    dbReady = true;

    console.log('[db] running initPostLoad on everything');
    for (const thing of allThings.values()) {
        thing.initPostLoad();
    }
};




const getById = id => {
    return allThings.get(+id);
};


const findThingByTitle = title => {
    for (let thing of allThings.values()) {
        if (thing.title == title) {
            return thing;
        }
    }
    return null;
};


const forAllThings = (fn) => {
    for (const thing of allThings.values()) {
        fn(thing);
    }
};




const newThing = async (class_, title, description, state) => {
    const ownerId = (state && state.player) ? state.player.id : null;
    console.log(`creating ${title} for owner id ${ownerId}`);
    const res = await db.run(`INSERT INTO thing (ownerId, class_, title, description) VALUES (?,?,?,?)`, ownerId, class_, title, description);
    const thingId = res.lastID;

    // this feels silly
    const row = await db.get('SELECT * FROM thing WHERE id=?', thingId);
    const thing = moo.thingFactory(row);
    allThings.set(thing.id, thing);

    console.log(`created new ${class_} "${title}" id ${thingId} for player ${state ? state.player.title : '<none>'}`);
    
    return thing;
};

const nixThing = async (id, state) => {
    id = +id;

    console.log(`nixing thing ${id} for player ${state.player.title}`);

    const res = await db.run(`DELETE FROM thing WHERE id = ?`, id);
    allThings.delete(id);

    if (res.changes !== 1) {
        throw new Error(`removed unexpected number of rows: ${res.changes}`);
    }
};



const saveThing = async (row) => {
    try {
        const res = await db.run('UPDATE thing SET ownerId=?, title=?, description=?, data=? WHERE id=?',
            [row.ownerId, row.title, row.description, row.extended, row.id]);

        if (res.changes !== 1) {
            throw new Error(`removed unexpected number of rows: ${res.changes}`);
        }
    }
    catch (err) {
        console.error(err);
        throw err;
    }
}




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

    const player = await newThing('Player', username, 'A mysterious stranger');
    console.log(`[db] ... created Player '${username}' as id ${player.id}`);

    await db.run('INSERT INTO user (id, username, pwdhash) VALUES (?,?,?)', player.id, username, pwdHash);

    return player;
};



const isUsernameTaken = async (username) => {
    const row = await db.get('SELECT * FROM user WHERE username = ?', username);
    return (typeof row !== 'undefined');
};


const forAllUsers = async(fn) => {
    try {
        await db.each('SELECT id, username FROM user', [], (err, row) => {
            if (err) {
                throw err;
            }

            fn(row.id, row.username);
        });

    } catch (e) {
        console.error(e);
    } 
};




const addHold = async (holderId, heldId) => {
    // TODO: add a unique constraint to make sure we don't mess this up
    await db.run('INSERT INTO hold (holderId, heldId) VALUES (?,?)', [holderId, heldId]);
};

const removeHold = async (holderId, heldId) => {
    await db.run('DELETE FROM hold WHERE holderId=? AND heldId=?', [holderId, heldId]);
};



module.exports = {
    init,
    dbReady,

    getById,
    findThingByTitle,

    forAllThings,

    newThing,
    nixThing,

    saveThing,

    authenticateUser,
    createUser,
    isUsernameTaken,
    forAllUsers,

    addHold,
    removeHold,
};


const moo = require('./moo');

