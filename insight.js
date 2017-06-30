#!/usr/local/bin/node
const fs = require('fs'),
      util = require('util'),
      ECO = require('chess-eco-codes'),
      pgnParser = require('pgn-parser'),
      Chess = require('chess.js').Chess,
      chess = new Chess()
      readFile = util.promisify(fs.readFile),
      makeParser = util.promisify(pgnParser);

const gameResultMap = {
    '1-0': 'win',
    '0-1': 'loss',
    '1/2-1/2': 'draw'
};

async function run() {
    const pgnData = await readFile(process.argv[2], 'utf-8');

    const parser = await makeParser();
    const games = parser.parse(pgnData);

    const result = {};

    for (game of games) {
        let ecoCode = null;
        for ({move} of game.moves.slice(0, 20)) {
            chess.move(move);
            const code = ECO(chess.fen());
            if (code) {
                ecoCode = code;
            }
        }
        if (ecoCode) {
            const key = ecoCode.code + ' ' + ecoCode.name;
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
        chess.reset();
    }
    console.log(JSON.stringify(result, null, 4));

    const group = Object.entries(result).filter(([k, v]) => {
        console.log("key:",k);
        return /English/.test(k) //&& /symmetrical/.test(k); 
    }).reduce((acc, [k, v]) => {
        if (v.win) {
            acc.win = acc.win ? acc.win + v.win : v.win;
        }
        if (v.loss) {
            acc.loss = acc.loss ? acc.loss + v.loss : v.loss;
        }
        if (v.draw) {
            acc.draw = acc.draw ? acc.draw + v.draw : v.draw;
        }
        return acc;
    }, {});
    console.log('English Symmetrical variants', JSON.stringify(group, null, 4));
}

try {
    run();
} catch(ex) {
    console.log(ex);
}
