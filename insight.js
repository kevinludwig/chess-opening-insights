const util = require('node:util'),
      axios = require('axios'),
      pgnParser = require('pgn-parser'),
      Chess = require('chess.js').Chess,
      chess = new Chess()
      makeParser = util.promisify(pgnParser);

const repertoire = [
   {moves: "1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 c5 5. cxd5 exd5 6. Nc3 Nc6 7. Bg2 *", name: "QGD Tarrasch Defense"},
   {moves: "1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 *", name: "QGD Catalan"},
   {moves: "1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 *", name: "QGA"},
   {moves: "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Qc2 *", name: "Slav"},
   {moves: "1. d4 Nf6 2. c4 e5 3. dxe5 Ng4 4. Bf4 *", name: "Budapest Gambit"},
   {moves: "1. d4 e5 2. dxe5 *", name: "Englund Gambit"},
   {moves: "1. d4 d5 2. c4 e5 3. dxe5 d4 4. Nf3 Nc6 5. a3 *", name: "Albin Counter Gambit"},
   {moves: "1.  d4 d5 2. c4 Nc6 3. Nf3 Bg4 4. cxd5 *", name: "Chigorin"},
   {moves: "1. d4 d5 2. c4 Nf6 3. cxd5 Nxd5 4. e4 *", name: "Marshall Defense"},
   {moves: "1. d4 d5 2. c4 c5 3. cxd5 Qxd5 4. Nf3 cxd4 5. Nc3 *", name: "Symmetrical Defense"},
   {moves: "1. d4 d5 2. c4 Bf5 3. cxd5 Bxb1 *", name: "Baltic Defense"},
   {moves: "1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. g3 *", name: "Queens Indian Defense"},
   {moves: "1. d4 Nf6 2. c4 e6 3. Nf3 Bb4+ 4. Bd2 *", name: "Bogo Indian Defense"},
   {moves: "1. d4 Nf6 2. c4 e6 3. Nf3 c5 4. d5 exd5 5. cxd5 d6 6. Nc3 g6 7. g3 Bg7 8. Bg2 O-O 9. O-O *", name: "Modern Benoni Defense"},
   {moves: "1. d4 Nf6 2. c4 c5 3. d5 b5 4. Qc2 *", name: "Benko Gambit"},
   {moves: "1. d4 Nf6 2. c4 g6 3. Nf3 Bg7 4. g3 O-O 5. Bg2 d6 6. Nc3 *", name: "KID Fianchetto"},
   {moves: "1. d4 Nf6 2. c4 g6 3. Nf3 Bg7 4. g3 O-O 5. Bg2 d5 6. cxd5 Nxd5 7. O-O *", name: "Grunfeld Defense"},
   {moves: "1. d4 f5 2. g3 Nf6 3. Bg2 e6 4. c4 d5 5. Nf3 c6 6. O-O Bd6 7. Qc2 O-O 8. Nbd2 *", name: "Dutch Stonewall Defense"},
   {moves: "1. d4 f5 2. g3 Nf6 3. Bg2 e6 4. c4 Be7 5. Nf3 d6 6. O-O O-O *", name: "Dutch Classical Defense"},
   {moves: "1. d4 f5 2. g3 Nf6 3. Bg2 g6 *", name: "Dutch Lenningrad Defense"},
   {moves: "1. d4 d6 2. e4 *", name: "Pirc"},
   {moves: "1. d4 g6 2. e4 Bg7 *", name: "Modern"},
   {moves: "1. d4 b6 2. e4 Bb7 *", name: "Owens Defense"},
   {moves: "1. d4 c5 2. d5 *", name: "Old Benoni"}
];

const gameResultMap = {
    '1-0': 'win',
    '0-1': 'loss',
    '1/2-1/2': 'draw'
};

function lookupInBook(fen, repertoire) {
    return repertoire.find(elem => elem.fen === fen);
}

function winPercentage(w, l, d) {
    const total = w + l + d;
    const sw = Math.floor(+(w / total).toPrecision(2) * 100) + "%";
    const sl = Math.floor(+(l / total).toPrecision(2) * 100) + "%";
    const sd = Math.floor(+(d / total).toPrecision(2) * 100) + "%";
    return sw + " / " + sd + " / " + sl;
}

function withPercentages(obj) {
    return Object.entries(obj).reduce((acc, [k, v]) => {
        acc[k] = v;
        acc[k].rate = winPercentage(v.win || 0, v.loss || 0, v.draw || 0);
        return acc;
    }, {});
}

function updateResult(result, line) {
    const key = line?.name ?? "Other";
    const gameResult = gameResultMap[game.result];
    
    if (result[key]) {
        result[key].total += 1;
    } else {
        result[key] = {total: 1};
    }
    
    if (result[key][gameResult]) {
        result[key][gameResult] += 1;
    } else {
        result[key][gameResult] = 1;
    }
}

function printResult(result) {
    Object.entries(result).sort((a, b) => {
        const t1 = a[1].total;
        const t2 = b[1].total;
        if (t1 < t2) return 1;
        else if (t1 > t2) return -1;
        else return 0;
    }).forEach(([k, v]) => {
        console.log(k, v.rate, "(" + v.total + ")");  
    });
}

async function lastNMonths(archives, username, color, n) {
    let pgnData = "";
    for (url of archives.slice(-n)) {
        const {data} = await axios.get(url);
        pgnData += data.games
            .filter(g => g.rules === 'chess' && g.white.username === username)
            .reduce((acc, cur) => acc.concat("", cur.pgn), "");
    }
    return pgnData;
}

async function run() {
    const username = "KevinTheSnipe";
    const color = "white";
    const {data} = await axios.get("https://api.chess.com/pub/player/" + username + "/games/archives");
    const pgnData = await lastNMonths(data.archives, username, color, 12);

    const parser = await makeParser();

    const result = {};

    /* calculate fen in each repertoire line */
    for (line of repertoire) {
        const [g] = parser.parse(line.moves);
        for ({move} of g.moves) {
            chess.move(move);
        }
        line.fen = chess.fen();
        chess.reset();
    }

    const games = parser.parse(pgnData);
    for (game of games) {
        let line = null;
        for ({move} of game.moves.slice(0, 20)) {
            chess.move(move);
            const l = lookupInBook(chess.fen(), repertoire);
            if (l) {
                line = l;
            }
        }
        updateResult(result, line);
        chess.reset();
    }
    printResult(withPercentages(result));
}

try {
    run();
} catch(ex) {
    console.log(ex);
}
