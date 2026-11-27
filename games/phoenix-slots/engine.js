import { findWins, makeBoard, sumWins } from "../casino-demo-engine.js";

const lines = [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
    [1, 2, 1, 2, 1],
    [1, 0, 1, 0, 1],
    [2, 1, 2, 1, 2],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 2, 2],
    [2, 2, 1, 0, 0],
    [0, 1, 1, 1, 2],
    [2, 1, 1, 1, 0],
    [0, 2, 2, 2, 0],
    [2, 0, 0, 0, 2],
    [1, 0, 0, 0, 1],
    [1, 2, 2, 2, 1],
    [0, 2, 0, 2, 0],
    [2, 0, 2, 0, 2],
    [0, 2, 1, 2, 0],
    [2, 0, 1, 0, 2],
    [0, 0, 2, 0, 0],
    [2, 2, 0, 2, 2],
    [1, 1, 0, 1, 2],
    [1, 1, 2, 1, 0]
];
const pays = {
    Cherry: {"3": 1, "4": 2, "5": 5},
    Lemon: {"3": 1, "4": 3, "5": 6},
    Plum: {"3": 2, "4": 4, "5": 8},
    Bell: {"3": 2, "4": 5, "5": 10},
    Seven: {"3": 3, "4": 8, "5": 15},
    Diamond: {"3": 5, "4": 12, "5": 25},
    BlueOrb: {"2": 1, "3": 3, "4": 8, "5": 20},
    GreenOrb: {"2": 2, "3": 5, "4": 12, "5": 30},
    YellowOrb: {"2": 3, "3": 8, "4": 20, "5": 50}};
const baseWeights = [
    ["Cherry", 18],
    ["Lemon", 18],
    ["Plum", 16],
    ["Bell", 14],
    ["Seven", 12],
    ["Diamond", 10],
    ["BlueOrb", 6],
    ["GreenOrb", 5],
    ["YellowOrb", 4],
    ["RedOrb", 5]
];

const isWild = symbol => symbol === 'RedOrb' || symbol === 'Phoenix';
const cloneBoard = board => board.map(row => [...row]);
let balance = 10000;

export function playPhoenix(bet) {
    if (![10, 25, 50, 100].includes(bet)) return { message: 'Choose a valid bet.' };
    if (balance < bet) return { message: 'Not enough virtual credits. Lower your bet or reopen the demo.' };

    const initialBoard = makeBoard(baseWeights);
    const board = cloneBoard(initialBoard);
    const cascades = [];
    let activePhoenixReels = [];
    let totalWin = 0;

    while (true) {
        const wins = findWins(board, lines, pays, bet, isWild);
        if (!wins.length) break;

        const boardBefore = cloneBoard(board);
        const win = sumWins(wins);
        const expiredPhoenixReels = activePhoenixReels;
        for (const { positions } of wins) {
            for (const { row, reel } of positions) board[row][reel] = null;
        }
        const phoenixReels = [];
        for (let reel = 0; reel < board[0].length; reel++) {
            if (expiredPhoenixReels.includes(reel)) {
                for (const row of board) row[reel] = null;
            } else if (board.every(row => row[reel] === null)) {
                phoenixReels.push(reel);
            }
        }

        const refill = makeBoard(baseWeights);
        for (let reel = 0; reel < board[0].length; reel++) {
            const survivors = board.map(row => row[reel]).filter(symbol => symbol !== null);
            const gap = board.length - survivors.length;
            for (let row = 0; row < board.length; row++) {
                board[row][reel] = phoenixReels.includes(reel) ? 'Phoenix'
                    : row < gap ? refill[row][reel] : survivors[row - gap];
            }
        }

        cascades.push({ boardBefore, boardAfter: cloneBoard(board), wins, win, phoenixReels, expiredPhoenixReels });
        totalWin += win;
        activePhoenixReels = phoenixReels;
    }

    balance += totalWin - bet;
    return { initialBoard, cascades, win: totalWin, balance };
}
