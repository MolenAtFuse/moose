const moo = require('./moo');
const mooser = require('./mooser');


/// database shiz -------------
const defaultPlaces = [
    new moo.Place(1, 'The Void', 'An unspeakable amount of nothing surrounds you, although you feel the energy of potential creation crackling just beneath the surface.'),
    new moo.Place(2, 'The Lobby', 'The lobby of a grand hotel. The marble floor and columns are polished and cool. Chairs are tucked around low tables, with copious lush plants providing privacy and peace.'),
];
let nextFreeId = 100;
const allThings = new Map([
    ...defaultPlaces.map(place => [place.id, place]),
    ...Object.values(mooser.registeredUsers).map(account => [ account.id, new moo.Player(account) ]),
]);

console.log(`loaded ${allThings.size} things`);
/// ---------------------------


const getById = id => {
    return allThings.get(id);
};


const findThingByTitle = title => {
    for (let thing of allThings.values()) {
        if (thing.title == title) {
            return thing;
        }
    }
    return null;
};

const entryLocation = findThingByTitle('The Lobby');


module.exports = {
    getById,

    findThingByTitle,
    
    entryLocation,
};