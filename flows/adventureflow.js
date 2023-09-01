const moodb = require('../moodb');
const mooser = require('../mooser');
const mootils = require('../mootils');


const NL = mootils.NL;
const NL2 = mootils.NL2;




class AdventureFlow {
    constructor (conn, state) {
        conn.write(` adventure time${NL}`)
        conn.write(`****************${NL2}`)

        const currLocation = moodb.getById(state.player.locationId);
        conn.write(currLocation.describe() + NL2);

        conn.write('> ');
    }

    processInput(input, conn, state) {
        input = input.trim();
        conn.write(`i'm afraid i don't know how to ${input}${NL}`);
        conn.write('> ');
    }
}



module.exports = {
    AdventureFlow,
};
