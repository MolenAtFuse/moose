const crypto = require('node:crypto');
const net = require('node:net');

const PORT = 8889;

const WelcomeMsg =  '' +
'-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-\r\n' +
'\r\n' +
'          welcome to MOOse\r\n' +
'       please tip your servers\r\n' +
'\r\n' +
'local time now is ... past your bedtime\r\n' +
'\r\n' +
'-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-\r\n\r\n';



const getPasswordHash = (username, password) => {
    const hash = crypto.createHash('sha256');
    hash.update(`${username}!${password}`);
    const hashed = hash.digest('hex');
    console.log(`HASHING '${username}!${password}' => '${hashed}'`);
    return hashed;
};


class UserAccount {
    constructor(username, password) {
        this.username = username;
        this.pwdHash = getPasswordHash(username, password);
    };
};


const registeredUsers = { 'molen' : new UserAccount('molen', 'hi') };

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

class LoginFlow {
    constructor(conn, state) {
        conn.write('would you like to *login* to an existing account, or *create* a new one?\r\n');
        conn.write('> ');

        this.phase = 'loginorcreate'
    }

    processInput(input, conn, state) {
        input = input.trim();
        if (this.phase == 'loginorcreate') {
            if (input == 'login') {
                conn.write('lovely! who\'s logging in? > ');
                this.phase = 'loginuser';
            }
            else if (input == 'create') {
                conn.write('lovely! what should i call you? > ');
                this.phase = 'createuser';
            }
            else {
                conn.write(`i'm afraid i don't know how to ${input}\r\n`);
            }
        }
        else if (this.phase == 'loginuser') {
            if (input.length > 0) {
                this.username = input;
                conn.write(`okedoke! what's your password? > `);
                this.phase = 'loginpass';
            }
        }
        else if (this.phase == 'loginpass') {
            if (input.length > 0) {
                const user = loginUser(this.username, input);
                if (user) {
                    console.log(`${state.connId}: logged in user ${this.username}`);
                    state.user = user;
                    conn.write(`welcome back ${this.username}!\r\n\r\n`);

                    return new AdventureFlow(conn, state);
                }
                else {
                    conn.write(`oh no, that login didn't work. try again!\r\n\r\n`);
                    return new LoginFlow(conn, state);
                }
            }
        }
    }
};

class AdventureFlow {
    constructor (conn, state) {
        conn.write(`adventure time!\r\n`)
        conn.write('> ');
    }

    processInput(input, conn, state) {
        input = input.trim();
        conn.write(`i'm afraid i don't know how to ${input}\r\n`);
        conn.write('> ');
    }
}



const server = net.createServer((c) => {
    const connId = `${c.remoteAddress}:${c.remotePort}`;
    console.log(`client connected: ${connId}`);
    c.write(WelcomeMsg);

    const state = { conn:c, connId };
    let flow = new LoginFlow(c, state);

    let line = '';

    c.on('end', () => {
        console.log(`client disconnected: ${connId}`);
    });
    c.on('data', d=>{
        line += d;

        // TODO: handle d containing multiple lines
        if (line.endsWith('\n')) {
            line = line.trim();
            
            console.log(`${connId}: '${line}'`);
            if (flow) {
                const newFlow = flow.processInput(line, c, state);
                if (newFlow) {
                    console.log(`${connId}: switching flow to ${newFlow.constructor.name}`);
                    flow = newFlow;
                }
            }

            line = '';
        }
    });
});

server.on('error', err=> {
    throw err;
});

server.listen(PORT, () => {
    console.log(`server listening on port ${PORT}`);
});
