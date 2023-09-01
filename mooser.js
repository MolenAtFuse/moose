const crypto = require('node:crypto');


const getPasswordHash = (username, password) => {
    const hash = crypto.createHash('sha256');
    hash.update(`${username}!${password}`);
    const hashed = hash.digest('hex');
    return hashed;
};



// TODO: registerUser(username, pass)


module.exports = {
    getPasswordHash,
};