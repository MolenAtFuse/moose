const mootils = require("./mootils");

const NL = mootils.NL;
const NL2 = mootils.NL2;
const listToStr = mootils.listToStr;


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



module.exports = {
    Thing,
    Place,
    Player,
};