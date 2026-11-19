import { findWins, makeBoard, sumWins, choose } from "../casino-demo-engine.js";

const lines = [
    [0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
    [0, 0, 1, 2, 2],
    [2, 2, 1, 0, 0],
    [1, 0, 0, 0, 1],
    [1, 2, 2, 2, 1],
    [0, 1, 1, 1, 0]
];
const pays = {
    J: {"3": 2, "4": 4, "5": 8},
    Q: {"3": 2, "4": 5, "5": 10},
    K: {"3": 3, "4": 6, "5": 12},
    A: {"3": 3, "4": 7, "5": 15},
    Tackle: {"3": 5, "4": 12, "5": 25},
    Boat: {"3": 7, "4": 18, "5": 40},
    Fish: {"3": 4, "4": 10, "5": 22}};
const baseWeights = [
    ["J", 18],
    ["Q", 17],
    ["K", 16],
    ["A", 15],
    ["Tackle", 11],
    ["Boat", 9],
    ["Fish", 10],
    ["Scatter", 4]
];
const bonusWeights = [
    ["J", 16],
    ["Q", 15],
    ["K", 14],
    ["A", 13],
    ["Tackle", 10],
    ["Boat", 8],
    ["Fish", 15],
    ["Fisherman", 7]
];

const fishMultipliers = [1, 1, 2, 2, 3, 5, 5, 10, 20, 50];
const collectorTiers = [[4, 2], [8, 3], [12, 10]];
let balance = 10000;
let freeSpinsRemaining = 0;
let bonusBet = 0;
let collectorCount = 0;
let collectorMultiplier = 1;

export function playReelCatch(bet, isFreeSpin) {
    if (isFreeSpin) {
        if (freeSpinsRemaining === 0) return { message: 'No free spins are available.' };
        bet = bonusBet;
        freeSpinsRemaining--;
    } else {
        if (freeSpinsRemaining > 0) return { message: 'Finish the free spins before placing another bet.' };
        if (!Number.isInteger(bet) || bet < 10 || bet > 1000 || bet % 10 !== 0) {
            return { message: 'Choose a valid bet.' };
        }
        if (balance < bet) return { message: 'Not enough virtual credits. Lower your bet or reopen the demo.' };
        balance -= bet;
        collectorCount = 0;
        collectorMultiplier = 1;
    }

    const board = makeBoard(isFreeSpin ? bonusWeights : baseWeights);
    const wins = findWins(board, lines, pays, bet / lines.length);
    const lineWin = sumWins(wins);
    const scatterCount = board.flat().filter(symbol => symbol === 'Scatter').length;
    const bonusTriggered = !isFreeSpin && scatterCount >= 3;
    const fishPrizes = [];
    let fishermenLanded = 0;
    let extraFreeSpins = 0;
    if (isFreeSpin) {
        board.forEach((symbols, row) => symbols.forEach((symbol, reel) => {
            if (symbol === 'Fisherman') fishermenLanded++;
            if (symbol === 'Fish') fishPrizes.push({ row, reel, value: bet * choose(fishMultipliers) });
        }));
        const previousCount = collectorCount;
        collectorCount += fishermenLanded;
        for (const [threshold, multiplier] of collectorTiers) {
            if (previousCount < threshold && collectorCount >= threshold) {
                collectorMultiplier = multiplier;
                extraFreeSpins += 5;
            }
        }
        freeSpinsRemaining += extraFreeSpins;
    }
    if (bonusTriggered) {
        freeSpinsRemaining = 10;
        bonusBet = bet;
    }

    const fishermanLanded = fishermenLanded > 0;
    const collectorWin = fishermanLanded
        ? fishPrizes.reduce((total, { value }) => total + value, 0) * collectorMultiplier
        : 0;
    const win = lineWin + collectorWin;
    balance += win;
    return {
        board, wins, fishPrizes, lineWin, collectorWin, win, balance, scatterCount, bonusTriggered,
        isFreeSpin, freeSpinsRemaining, extraFreeSpins, collectorCount, collectorMultiplier,
        fishermanLanded, fishermenLanded
    };
}
