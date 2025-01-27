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
const optionsList = [
    {name: 'help', alias: 'h', type: Boolean, description: 'get some help'},
    {name: 'eco', alias: 'e', type: Boolean, description: 'classify by ECO'},
    {name: 'source', alias: 's', type: String, description: 'lichess or chess.com', defaultValue: 'chess.com'},
    {name: 'username', alias: 'u', type: String, description: 'Chess.com username'},
    {name: 'months', alias: 'm', type: Number, description: 'number of months of games to fetch', defaultValue: 3},
    {name: 'color', alias: 'c', type: String, description: 'white or black', defaultValue: 'white'}
];
const options = commandLineArgs(optionsList);

const gameResultMap = {
    '1-0': 'win',
    '0-1': 'loss',
    '1/2-1/2': 'draw'
};

function winPercentage(w, l, d) {
    const total = w + l + d;
    const sw = Math.round((w / total).toPrecision(2) * 100);
    const sl = Math.round((l / total).toPrecision(2) * 100);
    const sd = Math.round((d / total).toPrecision(2) * 100);
    return `${sw}% / ${sd}% / ${sl}%`;
}

const withPercentages = (obj) => Object.entries(obj).reduce((acc, [k, v]) => {
    acc[k] = v;
    acc[k].rate = winPercentage(v.win || 0, v.loss || 0, v.draw || 0);
    return acc;
}, {});

function updateResult(result, line, gameResult) {
    const key = line?.name ?? "Other";
    
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
        console.log(k, v.rate, `(${v.total})`);  
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
    return lastNMonths(data.archives, username, color, months);
}

async function fetchPgnFromLiChess(username, color, months) {
    const max = 5000;
    const d = new Date();
    d.setMonth(d.getMonth() - (months-1));
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    const since = d.getTime();

    const pgn = await axios.get(`https://lichess.org/api/games/user/${username}`, {
        params: {
            color, since, max
        }
    });
    return pgn;
}

try {
    if (options.help) {
        console.log(commandLineUsage([
            {header: 'Insights', content: 'Insight into opening variation results'},
            {header: 'Options', optionList}
        ]));
    } else {
        /* calculate fen in each repertoire line */
        if (!options.eco) {
            for (const line of repertoire) {
                const [g] = parser.parse(line.moves);
                for (const {move} of g.moves) {
                    chess.move(move);
                }
                line.fen = chess.fen();
                chess.reset();
            }
        }

        const pgnData = options.source === 'chess.com' ? 
            await fetchPgnFromChessCom(options.username, options.color, options.months) : 
            await fetchPgnFromLiChess(options.username, options.color, options.months);
        const games = parser.parse(pgnData);
        const result = {};
        for (const game of games) {
            let line = null;
            for (const {move} of game.moves.slice(0, 20)) {
                chess.move(move);
                const l = options.eco ? ECO(chess.fen()) : repertoire.find(elem => elem.fen === chess.fen());
                if (l) {
                   line = l;
                }
            }
            updateResult(result, line, gameResultMap[game.result]);
            chess.reset();
        }
        printResult(withPercentages(result));
    }
} catch(ex) {
    console.log(ex);
}
