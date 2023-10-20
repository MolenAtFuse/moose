const crypto = require('node:crypto');

const activeUserStates = new Map();


const getPasswordHash = (username, password) => {
    const hash = crypto.createHash('sha256');
    hash.update(`${username}!${password}`);
    const hashed = hash.digest('hex');
    return hashed;
};


const onUserLoggedIn = (player, state) => {
    if (typeof player.id !== 'undefined') {
        activeUserStates.set(player.id, state);
        console.log(`player '${player.title}' is now active. there are ${activeUserStates.size} active users`);
    }
    else {
        console.error(`tried to log in wonky player ${JSON.stringify(player)}`);
    }
};

const onUserLoggedOut = (player) => {
    if (typeof player.id === 'undefined') {
        console.error(`trying to log out wonky player ${JSON.stringify(player)}`);
        return;
    }

    if (activeUserStates.delete(player.id)) {
        console.log(`player '${player.title}' is no longer active. there are ${activeUserStates.size} active users`);
    }
    else {
        console.error(`tried to log out inactive player ${JSON.stringify(player)}`);
    }

    player.state = null;
};


const forAllActiveUsers = (func) => {
    for (const state of activeUserStates.values()) {
        func(state);
    }
};


module.exports = {
    getPasswordHash,

    onUserLoggedIn,
    onUserLoggedOut,

    forAllActiveUsers,
};