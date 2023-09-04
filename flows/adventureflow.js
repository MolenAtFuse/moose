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


const returnDirections = new Map([
    ['e', 'w'], ['east', 'west'],
    ['w', 'e'], ['west', 'east'],
    ['s', 'n'], ['south', 'north'],
    ['n', 's'], ['north', 'south'],
    ['u', 'd'], ['up', 'down'],
    ['d', 'u'], ['down', 'up'],
]);
const getReturnDirection = dir => {
    if (returnDirections.has(dir)) {
        return returnDirections.get(dir);
    }
    return undefined;
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
        const cmd = parseCommand(tokens, '$directions ?oneway to $destination');
        const directions = cmd.directions.split(',');

        // check for no dupe exits
        const here = state.currLocation;
        for (const dir of directions) {
            if (here.exits.has(dir)) {
                throw new Error(`this room already has an exit from '${dir}'`);
            }

            if (!cmd.oneway && typeof getReturnDirection(dir) === 'undefined') {
                throw new Error(`i don't know the way back from "${dir}" (hint: add "oneway" after directions if you don't want a return path)`);
            }
        }

        // TODO: check for dupe destination place name

        const there = await moodb.newThing('Place', cmd.destination, `The mist here is so thick you can't see anything`, state);

        for (const dir of directions) {
            await here.addExit(dir, there);

            if (!cmd.oneway) {
                const rtnDir = getReturnDirection(dir);
                await there.addExit(rtnDir, here);
            }
        }
    },
};


const adminCommands = {

    '@@ls': async (tokens, state) => {
        moodb.forAllThings(thing => {
            state.conn.write(`${thing.id}\t${thing.constructor.name}\t${thing.title}${NL}`);
        });
    },

    '@@users': async (tokens, state) => {
        await moodb.forAllUsers((id, username) => {
            state.conn.write(`${id}\t${username}${NL}`);
        });
    },

    '@@nix': async (tokens, state) => {
        const cmd = parseCommand(tokens, '$id $title');
        const thing = moodb.getById(cmd.id);
        if (typeof thing === 'undefined') {
            throw new Error(`we don't have a thing id ${cmd.id}`);
        }
        if (thing.title !== cmd.title) {
            throw new Error(`thing id ${cmd.id} has mismatched title '${thing.title}'`);
        }
        console.log(state);
        await moodb.nixThing(cmd.id, state);
    },

};


const allCommands = {
    ...adminCommands,
    ...infoCommands,
    ...buildingCommands,
};


class AdventureFlow {
    constructor (conn, state) {
        state.hideInput = false;
        conn.write(` adventure time${NL}`)
        conn.write(`****************${NL2}`)

        this.arrivedAtLocation(moodb.getById(state.player.locationId), state);
        state.conn.write('> ');
    }

    arrivedAtLocation(location, state) {
        state.currLocation = location;
        state.conn.write(location.describe() + NL2);
    }

    async processInput(input, conn, state) {
        const tokens = tokenise(input.trim());
        console.log(tokens);

        if (tokens.length > 0) {
            const command = tokens.shift();
            if (typeof allCommands[command] !== 'undefined') {
                try {
                    await allCommands[command](tokens, state);
                }
                catch (err) {
                    console.log(err);
                    conn.write(`i didn't quite understand that ("${err.message}")${NL}`);
                }
            }
            else if (state.currLocation.exits.has(command)) {
                const newPlace = state.currLocation.exits.get(command);
                console.log(`moving to ${newPlace.title}, id ${newPlace.id}`);
                await state.player.travelTo(newPlace);
                this.arrivedAtLocation(newPlace, state);
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
