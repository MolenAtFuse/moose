const crypto = require('node:crypto');




const getPasswordHash = (username, password) => {
    const hash = crypto.createHash('sha256');
    hash.update(`${username}!${password}`);
    const hashed = hash.digest('hex');
    return hashed;
};



class UserAccount {
    constructor(id, username, password) {
        this.id = id;   // id matches Player's id
        this.username = username;
        this.pwdHash = getPasswordHash(username, password);
    };
};


const registeredUsers = { 'molen' : new UserAccount(99, 'molen', 'hi') };


const loginUser = (username, pass) => {
    if (username in registeredUsers) {
        const user = registeredUsers[username];
        const pwdHash = getPasswordHash(username, pass);
        if (pwdHash == user.pwdHash) {
            return user;
        }
        else {
            console.log(`bad pwd: '${pwdHash}' vs '${user.pwdHash}'`);
        }
    }
    else {
        console.log(`unknown user: '${username}`);
    }
};


module.exports = {
    UserAccount,
    loginUser,

    registeredUsers,
};