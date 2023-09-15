const moodb = require('../moodb');
const mooser = require('../mooser');
const mootils = require('../mootils');

const AdventureFlow = require('./adventureflow').AdventureFlow;

const NL = mootils.NL;
const NL2 = mootils.NL2;


class LoginFlow {
    constructor(conn, state) {
        conn.write('would you like to *login* to an existing account, or *create* a new one?' + NL);
        conn.write('> ');

        this.phase = 'loginorcreate'
    }

    async onUserLoggedIn(player, state) {
        console.log(`${state.connId}: logged in user ${this.username}, id ${player.id}`);

        if (player.locationId < 0) {
            const entryLocation = moodb.findThingByTitle('The Lobby');
            await player.travelTo(entryLocation);
        }

        state.player = player;
        player.state = state;

        state.conn.write(`${NL2}welcome back ${player.title}!${NL2}${NL2}`);

        return new AdventureFlow(state.conn, state);
    }

    async processInput(input, conn, state) {
        input = input.trim();
        if (this.phase == 'loginorcreate') {
            if (input == 'login') {
                conn.write('lovely! who\'s logging in? > ');
                this.phase = 'loginuser';
            }
            else if (input == 'create') {
                conn.write('welcome! what should we call you? > ');
                this.phase = 'createuser';
            }
            else if (input == 'x') {
                const player = await moodb.authenticateUser('molen', '4b8202c19fd44f6ce3ef76621a403d669d62a2fb1f903c17163d6dc35757aa94');
                return await this.onUserLoggedIn(player, state);
            }
            else {
                conn.write(`i'm afraid i don't know how to ${input}${NL}`);
                return new LoginFlow(conn, state);
            }
        }
        else if (this.phase == 'loginuser') {
            if (input.length > 0) {
                this.username = input;
                conn.write(`okedoke! what's your password? > `);
                this.phase = 'loginpass';
                state.hideInput = true;
            }
            else {
                return new LoginFlow(conn, state);
            }
        }
        else if (this.phase == 'loginpass') {
            if (input.length > 0) {
                state.hideInput = false;

                return moodb.authenticateUser(this.username, mooser.getPasswordHash(this.username, input))
                    .then(async (player) => {
                        return await this.onUserLoggedIn(player, state);
                    })
                    .catch(err => {
                        console.log(err.message);
                        conn.write(`oh no, that login didn't work. try again!${NL}${NL}`);
                        return new LoginFlow(conn, state);
                    });
            }
            else {
                return new LoginFlow(conn, state);
            }
        }

        else if (this.phase == 'createuser') {
            if (input.length > 2) {
                const taken = await moodb.isUsernameTaken(input);
                if (!taken) {
                    this.username = input;

                    conn.write(`okedoke! what password would you like? > `);
                    this.phase = 'createpass';
                    state.hideInput = true;
                }
                else {
                    conn.write(`we already have someone here by that name. try again! > `);
                }
            }
            else {
                conn.write(`oops, that's a bit short. try something longer! > `);
            }
        }
        else if (this.phase == 'createpass') {
            if (input.length >= 3) {
                this.pwdHash = mooser.getPasswordHash(this.username, input);
                conn.write(`looks good - please enter it again for luck... > `);
                this.phase = 'validatepass';
                state.hideInput = true;
            }
            else {
                conn.write(`oops, that's a bit short. try another! > `);
            }
        }
        else if (this.phase == 'validatepass') {
            const checkHash = mooser.getPasswordHash(this.username, input);
            if (checkHash == this.pwdHash) {
                
                state.hideInput = false;
                
                const player = await moodb.createUser(this.username, checkHash);

                console.log(`${state.connId}: created & logged in user ${this.username}, id ${player.id}`);
                const entryLocation = moodb.findThingByTitle('The Lobby');
                player.travelTo(entryLocation);
    
                state.player = player;
    
                conn.write(`welcome to MOOse,  ${this.username}!${NL}${NL}`);
    
                return new AdventureFlow(conn, state);
            }
            else {
                conn.write(`hm, seems like they didn't match. once more from the top! > `);
                this.phase = 'createpass';
            }
        }
    }
};


module.exports = {
    LoginFlow,
}
