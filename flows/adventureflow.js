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


const parseCommand = (tokens, pattern) => {
    const ogtokens = [...tokens];

    const patToks = tokenise(pattern);
    const parsed = {};

    while (patToks.length > 0) {
        const ptok = patToks.shift();

        if (tokens.length == 0 && !ptok.startsWith('?')) {
            throw new Error('not enough words');
        }

        const intok = tokens.shift();

        if (ptok.startsWith('$')) {
            parsed[ptok.substring(1)] = intok;
        }
        else if (ptok.startsWith('?')) {
            const tokName = ptok.substring(1);
            const matches = (intok == tokName);
            parsed[tokName] = matches;

            if (!matches) {
                tokens.unshift(intok);
            }
        }
        else {
            if (intok != ptok) {
                throw new Error(`expected '${ptok}' but you said '${intok}'`);
            }
        }
    }

    console.log(`[parser] interpreted ${ogtokens.join('|')} into ${JSON.stringify(parsed)} using '${pattern}'`);

    return parsed;
};



const infoCommands = {
    'look': async (tokens, state) => {
        eatOptional('at', tokens);

        state.conn.write(NL + state.currLocation.describe() + NL2);
    },
};

const buildingCommands = {

    // @dig e,east [oneway] to "Empty Cupboard"
    '@dig': async (tokens, state) => {
        const parsed = parseCommand(tokens, '$directions ?oneway to $destination');
        const directions = parsed.directions.split(',');

        // check for no dupe exits
        const here = state.currLocation;
        for (const dir of directions) {
            if (here.exits.has(dir)) {
                throw new Error(`this room already has an exit from '${dir}'`);
            }
        }

        // TODO: check for dupe destination place name

        const portal = await moodb.newThing('Thing', '<portal>', `Portal from ${here.title} to ${parsed.destination}`);
        const there = await moodb.newThing('Place', parsed.destination, `The mist here is so thick you can't see anything`);
    },
};

const allCommands = {
    ...infoCommands,
    ...buildingCommands,
};


class AdventureFlow {
    constructor (conn, state) {
        state.hideInput = false;
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
            console.log(state.currLocation);
            const command = tokens.shift();
            if (typeof allCommands[command] !== 'undefined') {
                try {
                    await allCommands[command](tokens, state);
                }
                catch (err) {
                    console.log(err);
                    conn.write(`i didn't quite understand that: ${err.message}`);
                }
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
