import { playPhoenix } from "./engine.js";

const spinButton =
            document.getElementById("spinButton");

        const balance =
            document.getElementById("balance");

        const winMessage =
            document.getElementById("winMessage");

        const sleep = ms =>
            new Promise(resolve => setTimeout(resolve, ms));


       function initialiseRandomBoard() {

            const symbols = [
                "bell",
                "blueorb",
                "cherry",
                "diamond",
                "greenorb",
                "lemon",
                "plum",
                "redorb",
                "seven",
                "yelloworb"
            ];

            for (let row = 0; row < 3; row++) {
                for (let reel = 0; reel < 5; reel++) {

                    const cell =
                        getCell(row, reel);

                    const symbol =
                        symbols[
                            Math.floor(
                                Math.random() * symbols.length
                            )
                        ];

                    setSymbol(cell, symbol);
                }
            }
        }

initialiseRandomBoard();

        // Measure the live reel geometry instead of assuming every cell is
        // 100px + 8px gap. This keeps cascades and Phoenix overlays aligned
        // when the board is scaled down on a phone.
        function getRowPitch() {
            const top = getCell(0, 0)?.getBoundingClientRect();
            const middle = getCell(1, 0)?.getBoundingClientRect();

            if (top && middle)
                return middle.top - top.top;

            return 108;
        }

        // Original Phoenix audio. Browsers only allow music to start after
        // the player's first interaction, so the theme begins on first spin.
        const phoenixTheme = new Audio('assets/phoenix-theme.ogg');
        phoenixTheme.loop = true;
        phoenixTheme.volume = 0.22;

        const phoenixSfx = {
            drop: new Audio('assets/phoenix-drop.ogg'),
            win: new Audio('assets/phoenix-win.ogg'),
            flare: new Audio('assets/phoenix-flare.ogg')
        };
        phoenixSfx.drop.volume = 0.34;
        phoenixSfx.win.volume = 0.48;
        phoenixSfx.flare.volume = 0.42;

        let gameMuted = false;
        let musicStarted = false;
        const audioButton = document.getElementById('gameAudioButton');

        function startPhoenixMusic() {
            if (musicStarted || gameMuted) return;
            musicStarted = true;
            phoenixTheme.play().catch(() => { musicStarted = false; });
        }

        function playPhoenixSound(name) {
            if (gameMuted) return;
            const source = phoenixSfx[name];
            if (!source) return;
            const sound = source.cloneNode();
            sound.volume = source.volume;
            sound.play().catch(() => { });
        }

        audioButton.addEventListener('click', () => {
            gameMuted = !gameMuted;
            phoenixTheme.muted = gameMuted;
            audioButton.textContent = gameMuted ? '🔇' : '🔊';
            if (!gameMuted) startPhoenixMusic();
        });

        // True once a real board has been displayed.  On later spins the
        // existing symbols fall away before the next board drops in.
        let boardHasLanded = false;

        spinButton.addEventListener("click", async () => {

            spinButton.disabled = true;
            winMessage.textContent = "";
            startPhoenixMusic();
            playPhoenixSound('drop');

            const bet =
                document.getElementById("bet").value;

            try {
        const data = playPhoenix(Number(bet));
        if (data.message) {
            winMessage.textContent = data.message;
            return;
        }

        // Secrets-of-the-Phoenix style spin: the symbols already on
                // screen fall away first, leaving the reel area briefly clear.
                if (boardHasLanded) {
                    await animateBoardExit();
                }

                // Remove any Phoenix left over from the previous spin after its
                // reel has fallen away with the rest of the board.
                clearPhoenix();

                // New symbols then fall in from above, slightly staggered from
                // reel to reel and with a small landing bounce.
                await animateInitialBoard(
                    data.initialBoard);

                boardHasLanded = true;

                await sleep(500);

                let runningWin = 0;

                // Play each cascade one at a time
                for (const cascade of data.cascades) {

                    runningWin += cascade.win;

                    winMessage.textContent =
                        `WIN ${cascade.win} credits`;
                    playPhoenixSound('win');

                    await playCascade(cascade);
                }

                balance.textContent =
                    data.balance;

                if (data.win > 0) {
                    winMessage.textContent =
                        `TOTAL WIN ${data.win} credits`;
                }
                else {
                    winMessage.textContent =
                        "No win";
                }
            }
            catch (error) {
                console.error(error);

                winMessage.textContent =
                    "Something went wrong.";
            }
            finally {
                spinButton.disabled = false;
            }
        });

        async function playCascade(cascade) {
            clearPaylines();

            // Start all winning symbols pulsing
            highlightWins(cascade.wins);

            // Show ALL winning paylines at the same time
            for (const win of cascade.wins) {
                drawPayline(win);
            }

            // Show the total for this cascade
            winMessage.textContent =
                `WIN ${cascade.win} credits`;

            // Leave all paylines visible together
            await sleep(700);

            clearPaylines();

            await sleep(150);

            await removeWinningSymbols(
                cascade.wins);

            await sleep(100);

            // Any Phoenixes that were active for this
            // cascade now expire visually
            await removePhoenixes(
                cascade.expiredPhoenixReels);

            // Existing normal symbols fall down
            await animateDrop(
                cascade.boardBefore,
                cascade.wins);

            await sleep(50);

            // Start new Phoenixes rising immediately,
            // at the same time as the replacement symbols
            if (cascade.phoenixReels &&
                cascade.phoenixReels.length > 0) {

                for (const reel of cascade.phoenixReels) {
                    showPhoenix(reel);
                }
            }

            // Normal replacement symbols fall in
            // WHILE the Phoenix is rising.
            // Phoenix reels themselves are skipped.
            await animateNewSymbols(
                cascade.boardAfter,
                cascade.wins,
                cascade.phoenixReels);

            // Give the Phoenix animation a little extra
            // time to finish if one appeared
            if (cascade.phoenixReels &&
                cascade.phoenixReels.length > 0) {

                await sleep(400);
            }

            // Synchronise the normal board with the server result
            showBoard(cascade.boardAfter);

            // Phoenix reels are represented by the large overlay,
            // so don't show the three underlying Phoenix images.
            if (cascade.phoenixReels &&
                cascade.phoenixReels.length > 0) {
                hidePhoenixCells(
                    cascade.phoenixReels);
            }

            clearPaylines();

            await sleep(500);
        }

        function hidePhoenixCells(reels) {
            for (const reel of reels) {
                for (let row = 0; row < 3; row++) {
                    getCell(row, reel).innerHTML = "";
                }
            }
        }

        async function animateBoardExit() {
            clearPaylines();
            clearHighlights();

            const cellsToDrop = [...document.querySelectorAll(".slot-cell")];

            // Drop each reel away with a tiny offset so the board does not
            // disappear as one rigid rectangle.
            for (const cell of cellsToDrop) {
                const reel = Number(cell.dataset.reel);
                const row = Number(cell.dataset.row);

                cell.style.transition = "none";
                cell.style.opacity = "1";
                cell.style.transform = "translateY(0)";

                void cell.offsetWidth;

                const delay =
                    (reel * 0.035) +
                    (row * 0.012);

                cell.style.transition =
                    `transform 0.32s cubic-bezier(.55,.05,.85,.35) ${delay}s, ` +
                    `opacity 0.18s linear ${delay + 0.12}s`;

                cell.style.transform =
                    "translateY(360px)";

                cell.style.opacity = "0";
            }

            // Phoenix overlays are not normal cells, so send them down too.
            document
                .querySelectorAll("#phoenixOverlay .phoenix-symbol")
                .forEach((phoenix, index) => {
                    phoenix.style.animation = "none";
                    phoenix.style.transition =
                        `transform 0.34s cubic-bezier(.55,.05,.85,.35) ${index * 0.04}s, ` +
                        `opacity 0.18s linear ${0.12 + (index * 0.04)}s`;
                    phoenix.style.transform =
                        "translateX(-20px) translateY(380px) scale(1)";
                    phoenix.style.opacity = "0";
                });

            await sleep(520);

            for (const cell of cellsToDrop) {
                cell.innerHTML = "";
                cell.classList.remove("winning", "removed");
                cell.style.transition = "none";
                cell.style.transform = "translateY(0)";
                cell.style.opacity = "1";
            }
        }

        async function animateInitialBoard(board) {
            // Populate the new result first, but keep every symbol above the
            // visible reel area until its own drop begins.
            for (let row = 0; row < 3; row++) {
                for (let reel = 0; reel < 5; reel++) {
                    const cell = getCell(row, reel);

                    setSymbol(cell, board[row][reel]);

                    cell.classList.remove(
                        "winning",
                        "removed");

                    cell.style.opacity = "1";
                    cell.style.transition = "none";

                    // Each reel begins at a slightly different height.
                    // The grid itself now supplies the live row spacing while
                    // the symbols fall into their final cells.
                    const reelStart =
                        -390 -
                        (reel * 24) -
                        (Math.random() * 90);

                    const rowVariation =
                        (row * -18) -
                        (Math.random() * 22);

                    cell.style.transform =
                        `translateY(${reelStart + rowVariation}px)`;
                }
            }

            // Make sure the off-screen starting frame is painted.
            void document.body.offsetWidth;

            // Drop left-to-right, but keep enough overlap that it feels like
            // one gravity-driven event rather than five separate reel spins.
            for (let reel = 0; reel < 5; reel++) {
                for (let row = 0; row < 3; row++) {
                    const cell = getCell(row, reel);

                    const delay =
                        (reel * 0.075) +
                        (row * 0.018) +
                        (Math.random() * 0.025);

                    cell.style.transition =
                        `transform 0.46s cubic-bezier(.22,.82,.32,1.08) ${delay}s`;

                    cell.style.transform =
                        "translateY(0)";
                }
            }

            await sleep(900);
        }

        async function animateDrop(boardBefore, wins) {
            const removed = new Set();

            for (const win of wins) {
                for (const position of win.positions) {
                    removed.add(
                        `${position.row}-${position.reel}`);
                }
            }

            const reelWindow =
                document.querySelector(".reel-window");

            const windowRect =
                reelWindow.getBoundingClientRect();

            /*
             * Animate surviving symbols as temporary floating copies.
             *
             * This avoids the old behaviour where the source cell was cleared
             * and the symbol was recreated in its destination cell before the
             * browser had painted the starting transform. That could look like
             * the symbol vanished and then reappeared.
             */
            const movers = [];
            const finalCells = [];

            for (let reel = 0; reel < 5; reel++) {
                const survivors = [];

                // Collect surviving symbols bottom-to-top.
                for (let row = 2; row >= 0; row--) {
                    const key =
                        `${row}-${reel}`;

                    if (!removed.has(key)) {
                        survivors.push({
                            symbol: boardBefore[row][reel],
                            oldRow: row
                        });
                    }
                }

                let targetRow = 2;

                for (const survivor of survivors) {
                    const sourceCell =
                        getCell(survivor.oldRow, reel);

                    const targetCell =
                        getCell(targetRow, reel);

                    const targetRect =
                        targetCell.getBoundingClientRect();

                    const sourceImg =
                        sourceCell.querySelector(".slot-symbol");

                    if (sourceImg) {
                        // Measure the IMAGE itself, not the 120px cell.
                        // Using the cell size made the temporary mover expand
                        // from the normal 108px symbol up to the full cell size.
                        const sourceImgRect =
                            sourceImg.getBoundingClientRect();

                        const mover =
                            sourceImg.cloneNode(true);

                        mover.classList.add("survivor-mover");

                        mover.style.position = "absolute";
                        mover.style.left =
                            `${sourceImgRect.left - windowRect.left}px`;
                        mover.style.top =
                            `${sourceImgRect.top - windowRect.top}px`;
                        mover.style.width =
                            `${sourceImgRect.width}px`;
                        mover.style.height =
                            `${sourceImgRect.height}px`;
                        mover.style.objectFit = "contain";
                        mover.style.pointerEvents = "none";
                        mover.style.zIndex = "25";
                        mover.style.margin = "0";

                        reelWindow.appendChild(mover);

                        // Destination images are centred inside their cells,
                        // so move the temporary copy to that centred position.
                        const targetLeft =
                            targetRect.left +
                            ((targetRect.width - sourceImgRect.width) / 2);

                        const targetTop =
                            targetRect.top +
                            ((targetRect.height - sourceImgRect.height) / 2);

                        const deltaX =
                            targetLeft - sourceImgRect.left;

                        const deltaY =
                            targetTop - sourceImgRect.top;

                        movers.push({
                            element: mover,
                            deltaX,
                            deltaY,
                            delay: (2 - targetRow) * 55
                        });
                    }

                    finalCells.push({
                        row: targetRow,
                        reel,
                        symbol: survivor.symbol
                    });

                    // Keep a direct reference to the destination so this mover
                    // can hand off to the real symbol on the exact frame it lands.
                    movers[movers.length - 1].targetRow = targetRow;
                    movers[movers.length - 1].targetReel = reel;

                    targetRow--;
                }
            }

            /*
             * Hide the normal reel cells only after all floating copies have
             * been created, so there is never a blank frame between the old
             * and moving symbols.
             */
            for (let row = 0; row < 3; row++) {
                for (let reel = 0; reel < 5; reel++) {
                    const cell = getCell(row, reel);

                    cell.innerHTML = "";
                    cell.classList.remove(
                        "winning",
                        "removed");

                    cell.style.transition = "none";
                    cell.style.transform = "translateY(0)";
                    cell.style.opacity = "1";
                }
            }

            // Put the survivors in their final cells but keep them hidden until
            // the floating copies have landed.
            for (const item of finalCells) {
                const cell =
                    getCell(item.row, item.reel);

                setSymbol(
                    cell,
                    item.symbol);

                const img =
                    cell.querySelector(".slot-symbol");

                if (img)
                    img.style.visibility = "hidden";
            }

            const animations =
                movers.map(({
                    element,
                    deltaX,
                    deltaY,
                    delay,
                    targetRow,
                    targetReel
                }) => {

                    const animation =
                        element.animate(
                            [
                                {
                                    transform:
                                        "translate(0px, 0px)"
                                },
                                {
                                    transform:
                                        `translate(${deltaX}px, ${deltaY}px)`
                                }
                            ],
                            {
                                duration: 450,
                                delay,
                                easing:
                                    "cubic-bezier(.22,.8,.3,1)",
                                fill: "forwards"
                            });

                    return animation.finished
                        .catch(() => { })
                        .then(() => {
                            /*
                             * Hand off from the floating copy to the real symbol
                             * before removing the copy.  Previously every real
                             * survivor stayed hidden until ALL movers had
                             * finished, while earlier movers were already being
                             * removed.  That produced the visible flash/flicker.
                             */
                            const targetCell =
                                getCell(targetRow, targetReel);

                            const realImg =
                                targetCell?.querySelector(".slot-symbol");

                            if (realImg)
                                realImg.style.visibility = "";

                            // Let the revealed real image paint underneath the
                            // identical floating copy, then remove the copy.
                            return new Promise(resolve => {
                                requestAnimationFrame(() => {
                                    element.remove();
                                    resolve();
                                });
                            });
                        });
                });

            await Promise.all(animations);
        }


        async function animateNewSymbols(
            boardAfter,
            wins,
            phoenixReels) {

            const removed = new Set();
            const phoenixSet = new Set(phoenixReels ?? []);

            for (const win of wins) {
                for (const position of win.positions) {
                    removed.add(
                        `${position.row}-${position.reel}`);
                }
            }

            const animations = [];

            for (let reel = 0; reel < 5; reel++) {

                // This reel is becoming a Phoenix, so normal
                // replacement symbols are not dropped into it.
                if (phoenixSet.has(reel))
                    continue;

                let removedCount = 0;

                for (let row = 0; row < 3; row++) {
                    if (removed.has(`${row}-${reel}`)) {
                        removedCount++;
                    }
                }

                if (removedCount === 0)
                    continue;

                for (let row = 0; row < removedCount; row++) {

                    const cell = getCell(row, reel);

                    setSymbol(
                        cell,
                        boardAfter[row][reel]);

                    cell.classList.remove(
                        "winning",
                        "removed");

                    cell.style.opacity = "1";
                    cell.style.transition = "none";
                    cell.style.transform = "translateY(0)";

                    /*
                     * Start the replacement above the actual visible reel
                     * window, based on its live position.  This guarantees the
                     * symbol can only travel DOWN into its target cell, even
                     * when the reel dimensions change on desktop/mobile.
                     */
                    const reelRect =
                        document.querySelector(".reel-window")
                            .getBoundingClientRect();

                    const cellRect =
                        cell.getBoundingClientRect();

                    const distanceAboveWindow =
                        (cellRect.top - reelRect.top) +
                        cellRect.height +
                        45 +
                        (Math.random() * 70);

                    let rowDelay = 0;

                    if (row === removedCount - 1) {
                        rowDelay = Math.random() * 50;
                    }
                    else if (row === removedCount - 2) {
                        rowDelay = 80 + (Math.random() * 100);
                    }
                    else {
                        rowDelay = 180 + (Math.random() * 140);
                    }

                    const reelDelay =
                        Math.random() * 120;

                    const delay =
                        reelDelay + rowDelay;

                    /*
                     * Use Web Animations rather than changing CSS transition
                     * states.  That avoids the browser occasionally painting a
                     * replacement at its resting position first and then
                     * interpolating from the wrong frame.
                     */
                    const animation =
                        cell.animate(
                            [
                                {
                                    transform:
                                        `translateY(-${distanceAboveWindow}px)`
                                },
                                {
                                    transform:
                                        "translateY(0)"
                                }
                            ],
                            {
                                duration: 650,
                                delay: delay,
                                easing:
                                    "cubic-bezier(.22,.8,.3,1)",
                                fill: "both"
                            });

                    animations.push(
                        animation.finished
                            .catch(() => { })
                            .then(() => {
                                animation.cancel();
                                cell.style.transform =
                                    "translateY(0)";
                                cell.style.transition = "";
                            }));
                }
            }

            await Promise.all(animations);
        }


        function showBoard(board) {
            for (let row = 0; row < 3; row++) {
                for (let reel = 0; reel < 5; reel++) {
                    const cell =
                        getCell(row, reel);

                    cell.style.transition = "none";
                    cell.style.transform = "translateY(0)";
                    cell.style.opacity = "1";

                    setSymbol(
                        cell,
                        board[row][reel]);

                    cell.classList.remove(
                        "winning",
                        "removed");

                    void cell.offsetWidth;

                    cell.style.transition = "";
                }
            }
        }

        function highlightWins(wins) {
            for (const win of wins) {
                for (const position of win.positions) {
                    const cell =
                        getCell(
                            position.row,
                            position.reel);

                    cell.classList.add("winning");
                }
            }
        }

        async function removeWinningSymbols(wins) {
            const processed = new Set();

            const winningCells = [];

            for (const win of wins) {
                for (const position of win.positions) {

                    const key =
                        `${position.row}-${position.reel}`;

                    if (processed.has(key))
                        continue;

                    processed.add(key);

                    const cell =
                        getCell(
                            position.row,
                            position.reel);

                    winningCells.push(cell);

                    cell.classList.remove("winning");

                    // Add fireball
                    showFireball(cell);

                    // Animate symbol itself
                    const img =
                        cell.querySelector(".slot-symbol");

                    if (img) {
                        img.classList.add("symbol-explode");
                    }
                }
            }

            // Allow explosion animation to play
            await sleep(350);

            // NOW remove all winning symbols
            for (const cell of winningCells) {
                cell.innerHTML = "";
                cell.classList.add("removed");
            }
        }

        function clearHighlights() {
            document
                .querySelectorAll(".slot-cell.winning")
                .forEach(cell => {
                    cell.classList.remove("winning");
                });
        }

        function getCell(row, reel) {
            return document.querySelector(
                `[data-row="${row}"][data-reel="${reel}"]`
            );




        }

        function setSymbol(cell, symbol) {
            if (!symbol) {
                cell.innerHTML = "";
                return;
            }

            // Phoenix is drawn using the large overlay,
            // never as a normal 90x90 reel symbol
            if (symbol.toLowerCase() === "phoenix") {
                cell.innerHTML = "";
                return;
            }

            const fileName =
                symbol.toLowerCase();

            cell.innerHTML =
                `<img src="assets/symbols/${fileName}.png"
                                              class="slot-symbol"
                                              alt="${symbol}">`;
        }

        function clearPaylines() {
            const svg =
                document.getElementById("paylineOverlay");

            if (svg)
                svg.innerHTML = "";
        }

        function drawPayline(win) {
            const svg =
                document.getElementById("paylineOverlay");

            const reelWindow =
                document.querySelector(".reel-window");

            const windowRect =
                reelWindow.getBoundingClientRect();

            const points = [];

            for (const position of win.positions) {
                const cell =
                    getCell(
                        position.row,
                        position.reel);

                const rect =
                    cell.getBoundingClientRect();

                const x =
                    rect.left -
                    windowRect.left +
                    (rect.width / 2);

                const y =
                    rect.top -
                    windowRect.top +
                    (rect.height / 2);

                points.push(`${x},${y}`);
            }

            const polyline =
                document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "polyline");

            polyline.setAttribute(
                "points",
                points.join(" "));

            polyline.setAttribute(
                "fill",
                "none");

            polyline.setAttribute(
                "stroke",
                "#ff2020");

            polyline.setAttribute(
                "stroke-width",
                "6");

            polyline.setAttribute(
                "stroke-linecap",
                "round");

            polyline.setAttribute(
                "stroke-linejoin",
                "round");

            svg.appendChild(polyline);
        }

        async function showPhoenix(reel) {
            playPhoenixSound('flare');
            const overlay =
                document.getElementById("phoenixOverlay");

            // Remove an existing Phoenix on THIS reel only
            const existing =
                overlay.querySelector(
                    `[data-phoenix-reel="${reel}"]`);

            if (existing)
                existing.remove();

            // Hide the 3 normal cells on this reel
            for (let row = 0; row < 3; row++) {
                const cell =
                    getCell(row, reel);

                cell.innerHTML = "";
            }

            const img =
                document.createElement("img");

            img.src =
                "assets/symbols/phoenix.png";

            img.className =
                "phoenix-symbol";

            img.dataset.phoenixReel =
                reel;

            const reelWindow =
                document.querySelector(".reel-window");

            const reelWindowRect =
                reelWindow.getBoundingClientRect();

            const topCellRect =
                getCell(0, reel).getBoundingClientRect();

            // The original desktop Phoenix was 140px over a 100px reel cell.
            // Keep that same 1.4x proportion as the reel shrinks on mobile.
            img.style.left =
                `${topCellRect.left - reelWindowRect.left}px`;

            img.style.width =
                `${topCellRect.width * 1.4}px`;

            img.style.setProperty(
                "--phoenix-x-offset",
                `${-topCellRect.width * 0.2}px`);

            img.style.top =
                "0px";

            overlay.appendChild(img);

            void img.offsetWidth;

            img.classList.add("appear");

            //await sleep(950);
        }

        function clearPhoenix() {
            const overlay =
                document.getElementById("phoenixOverlay");

            overlay.innerHTML = "";
        }

        async function removePhoenix(reel) {
            const overlay =
                document.getElementById("phoenixOverlay");

            const phoenix =
                overlay.querySelector(
                    `[data-phoenix-reel="${reel}"]`);

            if (!phoenix)
                return;

            // Add explosion over the Phoenix
            const explosion =
                document.createElement("div");

            explosion.className =
                "phoenix-explosion";

            const reelWindowRect =
                document.querySelector(".reel-window")
                    .getBoundingClientRect();

            const topCellRect =
                getCell(0, reel).getBoundingClientRect();

            explosion.style.left =
                `${topCellRect.left - reelWindowRect.left + (topCellRect.width / 2)}px`;

            explosion.style.top =
                `${reelWindowRect.height / 2}px`;

            overlay.appendChild(explosion);

            // Animate Phoenix itself
            phoenix.classList.add(
                "phoenix-explode");

            await sleep(500);

            phoenix.remove();
            explosion.remove();
        }

        async function removePhoenixes(reels) {
            if (!reels)
                return;

            await Promise.all(
                reels.map(reel =>
                    removePhoenix(reel)));
        }


        function showFireball(cell) {
            const overlay =
                document.getElementById("explosionOverlay");

            const reelWindow =
                document.querySelector(".reel-window");

            const cellRect =
                cell.getBoundingClientRect();

            const windowRect =
                reelWindow.getBoundingClientRect();

            const fireball =
                document.createElement("div");

            fireball.className =
                "fireball";

            fireball.style.left =
                `${cellRect.left
                - windowRect.left
                + cellRect.width / 2}px`;

            fireball.style.top =
                `${cellRect.top
                - windowRect.top
                + cellRect.height / 2}px`;

            overlay.appendChild(fireball);

            setTimeout(() => {
                fireball.remove();
            }, 500);
        }
