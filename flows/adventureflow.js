const moodb = require('../moodb');
const mootils = require('../mootils');


const NL = mootils.NL;
const NL2 = mootils.NL2;


// thanks stackoverflow: https://stackoverflow.com/a/18647776
const tokenise = input => {
    const tokenRe = /[^\s"]+|"([^"]*)"/g;
    const tokens = [];

    for (;;) {
        const match = tokenRe.exec(input);
        if (!match) {
            break;
        }

        //Index 1 in the array is the captured group if it exists
        //Index 0 is the matched text, which we use if no captured group exists
        tokens.push(match[1] ? match[1] : match[0]);
    }

    return tokens;
};


const eatOptional = (optional, tokens) => {
    if (tokens.length == 0) {
        return;
    }
    
    if (tokens[0].toLowerCase() === optional.toLowerCase()) {
        tokens.shift();
    }
};



const infoCommands = {
    'look': async (tokens, state) => {
        eatOptional('at', tokens);

        state.conn.write(NL + state.currLocation.describe() + NL2);
    },
};

const buildingCommands = {

    '@dig': async (tokens, state) => {

    },
};

const allCommands = {
    ...infoCommands,
    ...buildingCommands,
};


class AdventureFlow {
    constructor (conn, state) {
        conn.write(` adventure time${NL}`)
        conn.write(`****************${NL2}`)

        state.currLocation = moodb.getById(state.player.locationId);
        conn.write(state.currLocation.describe() + NL2);

        conn.write('> ');
    }

    async processInput(input, conn, state) {
        const tokens = tokenise(input.trim());
        console.log(tokens);

        if (tokens.length > 0) {
            const command = tokens.shift();
            if (typeof allCommands[command] !== 'undefined') {
                await allCommands[command](tokens, state);
            }
            else if (state.currLocation.exits.has(command)) {
                // TODO: move there!
            }
            else {
                conn.write(`i'm afraid i don't know how to ${input}${NL}`);
            }
        }

        conn.write(`> `);
    }
}



module.exports = {
    AdventureFlow,
};
