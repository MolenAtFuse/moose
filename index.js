import { createHash } from 'node:crypto';
import { createServer } from 'node:net';

const PORT = 8889;
const NL = '\r\n';
const NL2 = NL + NL;

const TelnetEnableEcho = new Uint8Array([255, 252, 1]);
const TelnetDisableEcho = new Uint8Array([255, 251, 1]);

const WelcomeMsg =  '' +
'-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-\r\n' +
'\r\n' +
'          welcome to MOOse\r\n' +
'       please tip your servers\r\n' +
'\r\n' +
'local time now is ... past your bedtime\r\n' +
'\r\n' +
'-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-\r\n\r\n';


const listToStr = (list, sing='', plur='') => {
    if (list.length > 0 && typeof list[0] !== 'string') {
        return listToStr(list.map(thing => thing.title), sing, plur);
    }

    if (list.length == 1) {
        return sing ? `${list[0]} ${sing}` : list[0];
    }
    if (list.length == 0) {
        return sing ? `Nothing ${sing}` : 'Nothing';
    }
    const head = list.slice(0, list.length-1).join(', ');
    const tail = list[list.length-1];
    if (plur) {
        return `${head} and ${tail} ${plur}`;
    }
    return `${head} and ${tail}`;
};


class Thing {
    constructor(id) {
        this.id = id;
        this.title = 'A Formless Idea';
        this.description = 'A greyish lump of soft, warm matter. It desperately wants to become something.';
        this.holds = [];
    }

    overview() {
        return `${this.title}. Contains ${listToStr(this.holds)}.`;
    }

    describe() {
        return `${this.title}${NL2}${this.description}. It contains ${listToStr(this.holds)}.`;
    }

    thingAdded(thing) {
        this.holds.push(thing);
    }
    thingRemoved(thing) {
        const ix = this.holds.indexOf(thing);
        if (ix >= 0) {
            this.holds = this.holds.splice(ix, 1);
        }
    }
}

class Place extends Thing {
    constructor(id, title, description) {
        super(id);
        this.title = title;
        this.description = description;
    }

    overview() {
        return `${this.title}. ${listToStr(this.holds, 'is', 'are')} here.`;
    }

    describe() {
        return `${this.title}${NL2}${this.description}${NL2}${listToStr(this.holds, 'is', 'are')} here.`;
    }
}


const getPasswordHash = (username, password) => {
    const hash = createHash('sha256');
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

class Player extends Thing {
    constructor(userAccount) {
        super(userAccount.id);

        this.title = userAccount.username;
        this.description = 'A mysterious stranger';

        this.locationId = -1;

        this.state = null;
    }

    travelTo(place) {
        if (this.locationId >= 0) {
            allThings.get(this.locationId).thingRemoved(this);
        }

        this.locationId = place.id;
        place.thingAdded(this);
    }
};


/// database shiz -------------
const defaultPlaces = [
    new Place(1, 'The Void', 'An unspeakable amount of nothing surrounds you, although you feel the energy of potential creation crackling just beneath the surface.'),
    new Place(2, 'The Lobby', 'The lobby of a grand hotel. The marble floor and columns are polished and cool. Chairs are tucked around low tables, with copious lush plants providing privacy and peace.'),
];
const registeredUsers = { 'molen' : new UserAccount(99, 'molen', 'hi') };
let nextFreeId = 100;
const allThings = new Map([
    ...defaultPlaces.map(place => [place.id, place]),
    ...Object.values(registeredUsers).map(account => [ account.id, new Player(account) ]),
]);

console.log(`loaded ${allThings.size} things`);
/// ---------------------------

const findThingByTitle = title => {
    for (let thing of allThings.values()) {
        if (thing.title == title) {
            return thing;
        }
    }
    return null;
};

const entryLocation = findThingByTitle('The Lobby');


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
        conn.write('would you like to *login* to an existing account, or *create* a new one?' + NL);
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
                conn.write(`i'm afraid i don't know how to ${input}${NL}`);
            }
        }
        else if (this.phase == 'loginuser') {
            if (input.length > 0) {
                this.username = input;
                conn.write(`okedoke! what's your password? > `);
                //conn.write(TelnetDisableEcho);
                this.phase = 'loginpass';
                state.hideInput = true;
            }
        }
        else if (this.phase == 'loginpass') {
            if (input.length > 0) {
                const user = loginUser(this.username, input);
                if (user) {
                    console.log(`${state.connId}: logged in user ${this.username}, id ${user.id}`);

                    const player = allThings.get(user.id);

                    if (player.locationId < 0) {
                        player.travelTo(entryLocation);
                    }

                    state.user = user;
                    state.player = player;

                    //conn.write(TelnetEnableEcho);
                    state.hideInput = false;
                    conn.write(`welcome back ${this.username}!${NL}${NL}`);

                    return new AdventureFlow(conn, state);
                }
                else {
                    conn.write(`oh no, that login didn't work. try again!${NL}${NL}`);
                    return new LoginFlow(conn, state);
                }
            }
        }
    }
};

class AdventureFlow {
    constructor (conn, state) {
        conn.write(` adventure time${NL}`)
        conn.write(`****************${NL2}`)

        const currLocation = allThings.get(state.player.locationId);
        conn.write(currLocation.describe() + NL2);

        conn.write('> ');
    }

    processInput(input, conn, state) {
        input = input.trim();
        conn.write(`i'm afraid i don't know how to ${input}${NL}`);
        conn.write('> ');
    }
}



const server = createServer((c) => {
    const connId = `${c.remoteAddress}:${c.remotePort}`;
    console.log(`client connected: ${connId}`);
    c.write(WelcomeMsg);
    //c.write(TelnetEnableEcho);

    const state = { conn:c, connId };
    let flow = new LoginFlow(c, state);

    let line = '';

    c.on('end', () => {
        console.log(`client disconnected: ${connId}`);
    });
    c.on('data', d=>{
        // just ignore any telnet commands and hope that's ok
        if (d[0] == 255) {
            console.log(`${connId}: IAC: ${d.toString('hex')}`);
            return;
        }
        
        line += d;

        if (state.hideInput) {
            const backspace = new Uint8Array([8]);
            for (let i=0; i<d.length; ++i) {
                c.write(backspace);
            }
            for (let i=0; i<d.length; ++i) {
                c.write('*');
            }
        }

        // TODO: handle d containing multiple lines
        if (line.endsWith('\n')) {
            line = line.trim();
            
            //console.log(`${connId}: '${line}'`);
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
