### chess-opening-insights

[![Build Status](https://travis-ci.org/kevinludwig/chess-opening-insights.svg?branch=master)](https://travis-ci.org/kevinludwig/chess-opening-insights)

Analyze your chess.com openings to see where you're winning and losing

### Usage

You need to modify the file `repertoire.js` to include the lines you want classified in your repertoire

```
./insight.js --username <Chess.com username> --months <number of months of games to pull> --color <white or black>
```

### Output

The result from the console log above would be 

```
Other 43% / 9% / 48% (67)
QGD Catalan 64% / 7% / 29% (14)
Slav 57% / 14% / 29% (14)
Modern 56% / 11% / 33% (9)
Marshall Defense 60% / 0% / 40% (5)
KID Fianchetto 100% / 0% / 0% (4)
Englund Gambit 75% / 0% / 25% (4)
Old Benoni 75% / 0% / 25% (4)
Owens Defense 100% / 0% / 0% (3)
Albin Counter Gambit 67% / 0% / 33% (3)
Bogo Indian Defense 33% / 0% / 67% (3)
Pirc 33% / 0% / 67% (3)
Queens Indian Defense 100% / 0% / 0% (2)
Benko Gambit 0% / 50% / 50% (2)
Symmetrical Defense 100% / 0% / 0% (1)
Budapest Gambit 100% / 0% / 0% (1)
QGD Tarrasch Defense 100% / 0% / 0% (1)
```

### Run tests

```

npm install
npm test

```
