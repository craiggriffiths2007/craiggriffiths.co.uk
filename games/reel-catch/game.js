import { playReelCatch } from "./engine.js";

(() => {
    const symbolInfo = {
        J: { image: 'assets/reelcatch/j.png', name: 'J', cls: 'symbol-J' },
        Q: { image: 'assets/reelcatch/q.png', name: 'Q', cls: 'symbol-Q' },
        K: { image: 'assets/reelcatch/k.png', name: 'K', cls: 'symbol-K' },
        A: { image: 'assets/reelcatch/a.png', name: 'A', cls: 'symbol-A' },
        Tackle: { image: 'assets/reelcatch/tackle.png', name: 'TACKLE', cls: 'symbol-Tackle' },
        Boat: { image: 'assets/reelcatch/boat.png', name: 'BOAT', cls: 'symbol-Boat' },
        Fish: { image: 'assets/reelcatch/fish.png', name: 'FISH', cls: 'symbol-Fish' },
        Fisherman: { image: 'assets/reelcatch/fisherman.png', name: 'COLLECTOR', cls: 'symbol-Fisherman' },
        Scatter: { image: 'assets/reelcatch/scatter.png', name: 'BONUS', cls: 'symbol-Scatter' }
    };

    const cells = [...document.querySelectorAll('.catch-cell')];
    const spinButton = document.getElementById('spinButton');
    const spinButtonText = document.getElementById('spinButtonText');
    const autoButton = document.getElementById('autoButton');
    const betSelect = document.getElementById('bet');
    const balance = document.getElementById("balance");
    const winMessage = document.getElementById('winMessage');
    const freeSpinsEl = document.getElementById('freeSpins');
    const collectorMultiplierEl = document.getElementById('collectorMultiplier');
    const collectorFill = document.getElementById('collectorFill');
    const freeSpinsStatus = document.getElementById('freeSpinsStatus');
    const collectorStatus = document.getElementById('collectorStatus');


    let freeSpins = 0;
    let spinning = false;
    let autoPlaying = false;

    // Original Reel Catch audio: light underwater theme plus reel/coin effects.
    const catchTheme = new Audio('assets/reelcatch-theme.ogg');
    catchTheme.loop = true;
    catchTheme.volume = 0.20;
    const catchSfx = {
        spin: new Audio('assets/reel-spin.ogg'),
        stop: new Audio('assets/reel-stop.ogg'),
        win: new Audio('assets/reel-win.ogg'),
        bonus: new Audio('assets/reel-bonus.ogg')
    };
    catchSfx.spin.volume = 0.22;
    catchSfx.stop.volume = 0.32;
    catchSfx.win.volume = 0.48;
    catchSfx.bonus.volume = 0.52;
    let gameMuted = false;
    let musicStarted = false;
    const audioButton = document.getElementById('gameAudioButton');

    function startCatchMusic() {
        if (musicStarted || gameMuted) return;
        musicStarted = true;
        catchTheme.play().catch(() => { musicStarted = false; });
    }
    function playCatchSound(name) {
        if (gameMuted) return;
        const source = catchSfx[name];
        if (!source) return;
        const sound = source.cloneNode();
        sound.volume = source.volume;
        sound.play().catch(() => { });
    }
    audioButton.addEventListener('click', () => {
        gameMuted = !gameMuted;
        catchTheme.muted = gameMuted;
        audioButton.textContent = gameMuted ? '🔇' : '🔊';
        if (!gameMuted) startCatchMusic();
    });

    betSelect.disabled = freeSpins > 0;
    autoButton.disabled = freeSpins <= 0;

    function getCell(row, reel) {
        return document.querySelector(`.catch-cell[data-row="${row}"][data-reel="${reel}"]`);
    }

    function clearEffects() {
        cells.forEach(cell => {
            cell.classList.remove('winner', 'collector-hit', 'scatter-hit');

            const prize = cell.querySelector('.fish-prize');
            prize.textContent = '';
            prize.classList.remove('visible');
        });

        document.querySelectorAll('.winner-symbol').forEach(symbol => {
            symbol.classList.remove('winner-symbol');
        });
    }

    function setSymbol(cell, symbol) {
        const info = symbolInfo[symbol] ?? symbolInfo.Fish;
        const holder = cell.querySelector('.catch-symbol');
        holder.className = `catch-symbol ${info.cls}`;
        holder.innerHTML = `<img class="symbol-image" src="${info.image}" alt="${info.name}" draggable="false">`;
    }

    function randomDisplaySymbol(isBonus = false) {
        const normalSymbols = [
            'J',
            'Q',
            'K',
            'A',
            'Tackle',
            'Boat',
            'Fish',
            'Scatter'
        ];

        const bonusSymbols = [
            'J',
            'Q',
            'K',
            'A',
            'Tackle',
            'Boat',
            'Fish',
            'Fisherman'
        ];

        const symbols = isBonus
            ? bonusSymbols
            : normalSymbols;

        return symbols[
            Math.floor(Math.random() * symbols.length)
        ];
    }

    function initialiseBubbles() {
        const columns = document.querySelectorAll('.reel-bubbles');

        columns.forEach((column, columnIndex) => {
            column.innerHTML = '';

            // More individual bubbles = smoother, continuous flow.
            const bubbleCount = 10;

            for (let i = 0; i < bubbleCount; i++) {
                const bubble = document.createElement('span');
                bubble.className = 'reel-bubble';

                const size = 5 + Math.random() * 7;
                const x = 25 + Math.random() * 50;

                // Slightly different speed for every bubble.
                const speed = 14 + Math.random() * 8;

                // Spread bubbles evenly through the animation,
                // with a small per-column offset.
                const delay =
                    -((i / bubbleCount) * speed)
                    - (columnIndex * 1.35);

                const wanderSpeed = 3.5 + Math.random() * 3;
                const wanderDelay = -(Math.random() * wanderSpeed);

                bubble.style.setProperty('--size', `${size}px`);
                bubble.style.setProperty('--x', `${x}%`);
                bubble.style.setProperty('--speed', `${speed}s`);
                bubble.style.setProperty('--delay', `${delay}s`);
                bubble.style.setProperty('--wander-speed', `${wanderSpeed}s`);
                bubble.style.setProperty('--wander-delay', `${wanderDelay}s`);
                bubble.style.setProperty('--opacity', 0.3 + Math.random() * 0.35);

                column.appendChild(bubble);
            }
        });
    }


    function initialiseRandomBoard() {
        for (let reel = 0; reel < 5; reel++) {
            const reelEl = document.querySelector(
                `.catch-reel[data-reel="${reel}"]`
            );

            const strip = reelEl.querySelector('.catch-spin-strip');

            const isBonus = freeSpins > 0;

            const initialSymbols = [
                randomDisplaySymbol(isBonus),
                randomDisplaySymbol(isBonus),
                randomDisplaySymbol(isBonus)
            ];

            // Update the underlying cells.
            for (let row = 0; row < 3; row++) {
                setSymbol(
                    getCell(row, reel),
                    initialSymbols[row]
                );
            }

            // IMPORTANT: give the resting strip the same cell height
            // that it receives during an actual spin.
            const cellHeight = reelEl.getBoundingClientRect().height / 3;

            strip.style.setProperty(
                '--reel-cell-height',
                `${cellHeight}px`
            );

            strip.innerHTML = initialSymbols
                .map(symbolMarkup)
                .join('');

            strip.style.transition = 'none';
            strip.style.transform = 'translate3d(0, 0, 0)';
            strip.classList.add('visible');

            reelEl.classList.add('has-resting-strip');
        }
    }


    function symbolMarkup(symbol) {
        const info = symbolInfo[symbol] ?? symbolInfo.Fish;
        return `<div class="catch-strip-symbol ${info.cls}"><img class="symbol-image" src="${info.image}" alt="${info.name}" draggable="false"></div>`;
    }

    function fillSpinStrip(strip, finalSymbols, isBonus) {
        const symbols = [...finalSymbols];

        for (let i = 0; i < 32; i++) {
            symbols.push(
                randomDisplaySymbol(isBonus)
            );
        }

        strip.innerHTML =
            symbols.map(symbolMarkup).join('');

        return symbols.length;
    }

    async function animateOneReel(
        reel,
        board,
        startDelay,
        duration,
        isBonus) {
        const reelEl = document.querySelector(`.catch-reel[data-reel="${reel}"]`);
        const strip = reelEl.querySelector('.catch-spin-strip');
        const windowEl = reelEl.querySelector('.catch-reel-window');
        const finalSymbols = [board[0][reel], board[1][reel], board[2][reel]];

        await delay(startDelay);

        const symbolCount =
            fillSpinStrip(
                strip,
                finalSymbols,
                isBonus);
        const cellHeight = reelEl.getBoundingClientRect().height / 3;
        const startY = -cellHeight * (symbolCount - 3);
        strip.style.setProperty('--reel-cell-height', `${cellHeight}px`);

        strip.style.transition = 'none';
        strip.style.transform = `translate3d(0, ${startY}px, 0)`;
        strip.classList.add('visible');
        windowEl.classList.add('reel-spinning');
        reelEl.classList.add('is-spinning');

        // Force the starting transform to be painted before the transition begins.
        strip.getBoundingClientRect();

        strip.style.transition = `transform ${duration}ms linear`;
        strip.style.transform = 'translate3d(0, 0, 0)';

        await delay(duration);

        // Keep the animated strip as the resting reel.  There is no visual
        // hand-off to a second layer, which removes the end-of-spin flicker.
        // The underlying cells are still synchronised for win/prize overlays.
        for (let row = 0; row < 3; row++) {
            setSymbol(getCell(row, reel), board[row][reel]);
        }

        strip.style.transition = 'none';
        strip.style.transform = 'translate3d(0, 0, 0)';
        strip.classList.add('visible');
        windowEl.classList.remove('reel-spinning');
        reelEl.classList.add('has-resting-strip');
        reelEl.classList.remove('is-spinning');
        reelEl.classList.add('reel-settle');
        playCatchSound('stop');

        setTimeout(() => {
            reelEl.classList.remove('reel-settle');
        }, 260);
    }

    async function animateReels(board, isBonus) {
        // Big-Bass-style cadence: the reels launch almost together, then stop
        // distinctly from left to right. Later reels travel a little longer.
        const spins = [];
        for (let reel = 0; reel < 5; reel++) {
            spins.push(animateOneReel(
                reel,
                board,
                reel * 40,
                1400 + (reel * 220),
                isBonus
            ));
        }

        await Promise.all(spins);
    }

    function showFishPrizes(prizes, collected) {
        prizes.forEach(prize => {
            const cell = getCell(prize.row, prize.reel);
            const badge = cell.querySelector('.fish-prize');
            badge.textContent = prize.value;
            badge.classList.add('visible');
            if (collected) cell.classList.add('collector-hit');
        });
    }

    function highlightWins(wins) {
        wins.forEach(win => {
            win.positions.forEach(pos => {
                // Underlying cell
                getCell(pos.row, pos.reel)?.classList.add('winner');

                // Visible symbol on the resting spin strip
                const reelEl = document.querySelector(
                    `.catch-reel[data-reel="${pos.reel}"]`
                );

                const stripSymbols = reelEl
                    ?.querySelectorAll('.catch-spin-strip .catch-strip-symbol');

                // The first three symbols in the strip are the final symbols.
                stripSymbols?.[pos.row]?.classList.add('winner-symbol');
            });
        });
    }

    function updateBonusUi(data) {
        freeSpins = data.freeSpinsRemaining;
        freeSpinsEl.textContent = freeSpins;
        collectorMultiplierEl.textContent = `x${data.collectorMultiplier}`;
        collectorFill.style.width = `${Math.min(data.collectorCount, 12) / 12 * 100}%`;

        const bonusVisible = freeSpins > 0;
        freeSpinsStatus.classList.toggle('visible', bonusVisible);
        collectorStatus.classList.toggle('visible', bonusVisible);

        betSelect.disabled = bonusVisible;
        autoButton.disabled = !bonusVisible;
        spinButtonText.textContent = bonusVisible ? 'FREE SPIN' : 'SPIN';
    }

    async function playSpin() {
        if (spinning) return;
        spinning = true;
        spinButton.disabled = true;
        autoButton.disabled = true;
        clearEffects();
        winMessage.textContent = freeSpins > 0 ? 'Free spin...' : 'Casting...';
        startCatchMusic();
        playCatchSound('spin');

        try {
            const data = playReelCatch(Number(betSelect.value), freeSpins > 0);
            if (data.message) {
                winMessage.textContent = data.message;
                return;
            }

            await animateReels(data.board, data.isFreeSpin);

            data.board.flatMap((row, rowIndex) => row.map((symbol, reelIndex) => ({ symbol, rowIndex, reelIndex })))
                .filter(x => x.symbol === 'Scatter')
                .forEach(x => getCell(x.rowIndex, x.reelIndex).classList.add('scatter-hit'));

            showFishPrizes(data.fishPrizes, data.fishermanLanded);
            highlightWins(data.wins);
            balance.textContent = data.balance;
            updateBonusUi(data);

            if (data.extraFreeSpins > 0 || data.bonusTriggered) {
                playCatchSound('bonus');
            } else if (data.win > 0 || data.collectorWin > 0) {
                playCatchSound('win');
            }

            if (data.extraFreeSpins > 0) {
                winMessage.textContent = `COLLECTOR UPGRADE! x${data.collectorMultiplier} + ${data.extraFreeSpins} FREE SPINS`;
            } else if (data.bonusTriggered) {
                winMessage.textContent = 'BONUS! 10 FREE SPINS AWARDED';
            } else if (data.collectorWin > 0) {
                winMessage.textContent = `FISH COLLECTED ${data.collectorWin} • TOTAL WIN ${data.win}`;
            } else if (data.win > 0) {
                winMessage.textContent = `WIN ${data.win} CREDITS`;
            } else if (data.isFreeSpin && data.fishermanLanded) {
                winMessage.textContent = 'Fisherman landed — no cash fish this spin';
            } else {
                winMessage.textContent = data.isFreeSpin ? `${data.freeSpinsRemaining} free spins remaining` : 'No win — cast again';
            }

            if (autoPlaying && freeSpins > 0) {
                await delay(850);
                spinning = false;
                await playSpin();
                return;
            }

            if (freeSpins <= 0) {
                autoPlaying = false;
                autoButton.classList.remove('active');
                autoButton.textContent = 'AUTO';
            }
        } catch (error) {
            console.error(error);
            winMessage.textContent = 'Something went wrong while spinning.';
            autoPlaying = false;
        } finally {
            spinning = false;
            spinButton.disabled = false;
            autoButton.disabled = freeSpins <= 0;
        }
    }

    initialiseRandomBoard();
    initialiseBubbles();
    spinButton.addEventListener('click', playSpin);
    autoButton.addEventListener('click', async () => {
        if (freeSpins <= 0 || spinning) return;
        autoPlaying = !autoPlaying;
        autoButton.classList.toggle('active', autoPlaying);
        autoButton.textContent = autoPlaying ? 'STOP' : 'AUTO';
        if (autoPlaying) await playSpin();
    });

    function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
})();
