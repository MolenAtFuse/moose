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
                this.phase = 'loginpass';
                state.hideInput = true;
            }
        }
        else if (this.phase == 'loginpass') {
            if (input.length > 0) {
                const user = mooser.loginUser(this.username, input);
                if (user) {
                    console.log(`${state.connId}: logged in user ${this.username}, id ${user.id}`);

                    const player = moodb.getById(user.id);

                    if (player.locationId < 0) {
                        player.travelTo(moodb.entryLocation);
                    }

                    state.user = user;
                    state.player = player;

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


module.exports = {
    LoginFlow,
}
