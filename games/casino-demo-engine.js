export function choose(items) {
    return items[Math.floor(Math.random() * items.length)];
}

export function makeBoard(weights) {
    const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
    const draw = () => {
        let roll = Math.floor(Math.random() * total);
        for (const [symbol, weight] of weights) {
            roll -= weight;
            if (roll < 0) return symbol;
        }
    };
    return Array.from({ length: 3 }, () => Array.from({ length: 5 }, draw));
}

export function findWins(board, lines, pays, lineBet, isWild = () => false) {
    const wins = [];
    for (const [paylineIndex, line] of lines.entries()) {
        const symbol = line.map((row, reel) => board[row][reel]).find(value => !isWild(value));
        if (!Object.hasOwn(pays, symbol)) continue;

        const positions = [];
        for (const [reel, row] of line.entries()) {
            const current = board[row][reel];
            if (current !== symbol && !isWild(current)) break;
            positions.push({ row, reel });
        }
        const reelsMatched = positions.length;
        const win = lineBet * (pays[symbol][reelsMatched] ?? 0);
        if (win > 0) wins.push({ symbol, reelsMatched, ways: 1, paylineIndex, positions, win });
    }
    return wins;
}

export function sumWins(wins) {
    return wins.reduce((total, { win }) => total + win, 0);
}
