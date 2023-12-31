

const listToStr = (list, sing='', plur='') => {
    if (list.length > 0 && typeof list[0] !== 'string') {
        return listToStr(list.map(thing => thing.title), sing, plur);
    }

    if (list.length == 1) {
        return sing ? `${list[0]} ${sing}` : list[0];
    }
    if (list.length == 0) {
        return sing ? `Nothing ${sing}` : 'Nothing';
    }
    const head = list.slice(0, list.length-1).join(', ');
    const tail = list[list.length-1];
    if (plur) {
        return `${head} and ${tail} ${plur}`;
    }
    return `${head} and ${tail}`;
};


const allTheUnderline = '====================================================================================================';
const underline = str => {
    return (str + '\n' + allTheUnderline.substring(0, str.length) + '\n');
};


module.exports = {
    listToStr,

    underline,
};
