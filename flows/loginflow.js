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
                moodb.authenticateUser(this.username, mooser.getPasswordHash(this.username, input))
                    .catch(err => {
                        state.hideInput = false;
                        console.log(err);
                        conn.write(`oh no, that login didn't work. try again!${NL}${NL}`);
                        return new LoginFlow(conn, state);
                    })
                    .then(player => {
                        console.log(`${state.connId}: logged in user ${this.username}, id ${player.id}`);
    
                        if (player.locationId < 0) {
                            const entryLocation = moodb.findThingByTitle('The Lobby');
                            player.travelTo(entryLocation);
                        }
    
                        state.player = player;
    
                        state.hideInput = false;
                        conn.write(`welcome back ${this.username}!${NL}${NL}`);
    
                        return new AdventureFlow(conn, state);
                    });
            }
            else {
                return new LoginFlow(conn, state);
            }
        }
    }
};


module.exports = {
    LoginFlow,
}
