import util from 'node:util';
import axios from 'axios';
import pgnParser from 'pgn-parser';
import ECO from 'chess-eco-codes';
import ChessJs from 'chess.js';
import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import repertoire from './repertoire.js';

const parser = await util.promisify(pgnParser)();
const chess = new ChessJs.Chess();
const optionList = [
    {name: 'help', alias: 'h', type: Boolean, description: 'get some help'},
    {name: 'eco', alias: 'e', type: Boolean, description: 'classify by ECO'},
    {name: 'depth', alias: 'd', type: Number, description: 'half-move depth to look for matches', defaultValue: 20},
    {name: 'source', alias: 's', type: String, description: 'lichess, chess.com, or both', defaultValue: 'both'},
    {name: 'username', alias: 'u', type: String, description: 'Chess.com or lichess username'},
    {name: 'username-chesscom', type: String, description: 'Chess.com username'},
    {name: 'username-lichess', type: String, description: 'lichess username'},
    {name: 'months', alias: 'm', type: Number, description: 'number of months of games to fetch', defaultValue: 3},
    {name: 'color', alias: 'c', type: String, description: 'white or black', defaultValue: 'white'}
];
const options = commandLineArgs(optionList);

const computeRepertoireFEN = (lines) => {
    for (const line of lines) {
        const [g] = parser.parse(line.moves);
        for (const {move} of g.moves) {
            chess.move(move);
        }
        line.fen = chess.fen();
        chess.reset();
    }
};

const computeRate = (w, l, d) => {
    const total = w + l + d;
    const sw = Math.round((w / total).toPrecision(2) * 100);
    const sl = Math.round((l / total).toPrecision(2) * 100);
    const sd = Math.round((d / total).toPrecision(2) * 100);
    return `${sw}% / ${sd}% / ${sl}%`;
}

const withWinRates = (obj) => Object.entries(obj).reduce((acc, [k, v]) => {
    acc[k] = v;
    acc[k].rate = computeRate(v['1-0'] || 0, v['0-1'] || 0, v['1/2-1/2'] || 0);
    return acc;
}, {});

const updateResult = (result, line, gameResult) => {
    const key = line?.name ?? "Other";
    
    result[key] = result[key] ?? {total: 0};
    result[key][gameResult] = result[key][gameResult] ?? 0;

    result[key].total += 1;
    result[key][gameResult] += 1;
}

const printResult = (result) => {
    Object.entries(result).sort((a, b) => {
        const t1 = a[1].total;
        const t2 = b[1].total;
        if (t1 < t2) return 1;
        else if (t1 > t2) return -1;
        else return 0;
    }).forEach(([k, v]) => {
        console.log(k.padEnd(40), v.rate.padEnd(15), `(${v.total})`);  
    });
}

async function lastNMonthsFromChessCom(archives, username, color, n) {
    let pgnData = "";
    for (const url of archives.slice(-n)) {
        const {data} = await axios.get(url);
        pgnData += data.games
            .filter(g => g.rules === 'chess' && g[color].username.toLowerCase() === username.toLowerCase())
            .reduce((acc, cur) => acc.concat("", cur.pgn), "");
    }
    return pgnData;
}

async function fetchPgnFromChessCom(username, color, months) {
    const {data} = await axios.get(`https://api.chess.com/pub/player/${username}/games/archives`);
    return lastNMonthsFromChessCom(data.archives, username, color, months);
}

async function fetchPgnFromLiChess(username, color, months) {
    const max = 5000;
    const perfType = 'blitz,rapid,classical,correspondence';
    const d = new Date();
    d.setMonth(d.getMonth() - (months-1));
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    const since = d.getTime();

    const {data} = await axios.get(`https://lichess.org/api/games/user/${username}`, {
        params: {
            color, perfType, since, max
        }
    });
    return data;
}

try {
    if (options.help) {
        console.log(commandLineUsage([
            {header: 'Insights', content: 'Insight into opening variation results'},
            {header: 'Options', optionList}
        ]));
    } else {
        if (!options.eco) {
            computeRepertoireFEN(repertoire.white);
            computeRepertoireFEN(repertoire.black);
        }

        let pgnData = '';
        if (['chess.com', 'both'].includes(options.source)) {
            pgnData = await fetchPgnFromChessCom(options['username-chesscom'] ?? options.username, options.color, options.months);
        }
        if (['lichess', 'both'].includes(options.source)) {
            pgnData += await fetchPgnFromLiChess(options['username-lichess'] ?? options.username, options.color, options.months);
        }
            
        const games = parser.parse(pgnData);
        const result = {};
        for (const game of games) {
            let line = null;
            for (const {move} of game.moves.slice(0, options.depth)) {
                chess.move(move);
                const l = options.eco ? ECO(chess.fen()) : repertoire[options.color].find(elem => elem.fen === chess.fen());
                if (l) {
                   line = l;
                }
            }
            /* What games are being grouped into "Other"? 
            if (!line) console.log(game.moves.slice(0,12).map(m => m.move).join(' ')); */

            updateResult(result, line, game.result);
            chess.reset();
        }
        printResult(withWinRates(result));
    }
} catch(ex) {
    console.log(ex);
}
