const first = ([x, ...xs]) => x;
const rest = ([x, ...xs]) => xs;
function sublist(list, item) {
    if (!list?.length) return null;
    else if (first(list) === item) return list;
    else return sublist(rest(list), item);
}
console.log(sublist(null));
console.log(sublist([]));
console.log(sublist([1], 5));
console.log(sublist([1, 2, 3, 4, 5], 3));