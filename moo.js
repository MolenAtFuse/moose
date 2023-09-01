const mootils = require("./mootils");

const NL = mootils.NL;
const NL2 = mootils.NL2;
const listToStr = mootils.listToStr;


class Thing {
    constructor(id) {
        this.id = id;
        //this.title = 'A Formless Idea';
        //this.description = 'A greyish lump of soft, warm matter. It desperately wants to become something.';
        this.holds = [];
    }

    toExtended() {
        return {};
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
    constructor(id) {
        super(id);
    }

    overview() {
        return `${this.title}. ${listToStr(this.holds, 'is', 'are')} here.`;
    }

    describe() {
        return `${this.title}${NL2}${this.description}${NL2}${listToStr(this.holds, 'is', 'are')} here.`;
    }
}


class Player extends Thing {
    constructor(id, username) {
        super(id);

        this.title = username;
        this.description = 'A mysterious stranger';

        this.locationId = -1;

        this.state = null;
    }

    toExtended() {
        return {
            locationId: this.locationId,
        };
    }
    loadExtended(data) {
        if (data.locationId) {
            this.locationId = data.locationId;
        }
    }

    travelTo(place) {
        if (this.locationId >= 0) {
            allThings.get(this.locationId).thingRemoved(this);
        }

        this.locationId = place.id;
        place.thingAdded(this);
    }
};


// deserialises a thing from the db
const thingFactory = row => {
    const cls = row.class_;

    const extendedJson = row.data ?? "{}";
    const extended = JSON.parse(extendedJson);

    if (cls == 'Thing') {
        const thing = new Thing(row.id);
        thing.title = row.title;
        thing.description = row.description;
        return thing;
    }

    if (cls == 'Place') {
        const place = new Place(row.id);
        place.title = row.title;
        place.description = row.description;
        return place;
    }

    if (cls == 'Player') {
        const player = new Player(row.id, row.title);
        player.description = row.description;
        player.loadExtended(extended);
        return player;
    }

    console.error(`unable to create a Thing for row ${JSON.stringify(row)}`);
};


module.exports = {
    Thing,
    Place,
    Player,

    thingFactory,
};