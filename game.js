// ========== 常量定义 ==========
const BOARD_SIZE = 15;
const CELL_SIZE = 50;
const PIECE_RADIUS = 20;
const PLAYER_BLACK = 1;
const PLAYER_WHITE = 2;

// ========== 音频管理 ==========
const AudioManager = {
    sounds: {},
    bgm: null,
    currentBGM: null,

    init() {
        // 初始化所有音效
        this.sounds.feishazoushi = new Audio('feishazoushi.mp3');
        this.sounds.jingruzhishui = new Audio('jingruzhishui.mp3');
        this.sounds.libashanxi = new Audio('libashanxi.mp3');
        this.sounds.dongshanzaiqi = new Audio('dongshanzaiqi.mp3');
        this.sounds.diaochenglishan = new Audio('diaochenglishan.mp3');
        this.sounds.wangjinbao = new Audio('wangjinbao.mp3');

        // 初始化背景音乐
        this.sounds.bgm = new Audio('bgm.mp3');
        this.sounds.bgm.loop = true;
        this.sounds.bgm.volume = 0.3;

        // 王金宝专属BGM
        this.sounds.theFinalBattle = new Audio('the-final-battle.mp3');
        this.sounds.theFinalBattle.loop = true;
        this.sounds.theFinalBattle.volume = 0.3;

        // 设置音效音量
        Object.values(this.sounds).forEach(sound => {
            if (sound !== this.sounds.bgm && sound !== this.sounds.theFinalBattle) {
                sound.volume = 0.6; // 音效音量60%
            }
        });
    },

    playSound(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName].currentTime = 0;
            this.sounds[soundName].play().catch(e => {
                console.log('音效播放失败:', e);
            });
        }
    },

    playBGM(bgmType = 'normal') {
        // 停止当前BGM
        this.stopBGM();

        // 选择要播放的BGM
        if (bgmType === 'final') {
            this.currentBGM = this.sounds.theFinalBattle;
        } else {
            this.currentBGM = this.sounds.bgm;
        }

        if (this.currentBGM) {
            this.currentBGM.currentTime = 0;
            this.currentBGM.play().catch(e => {
                console.log('BGM播放失败:', e);
            });
        }
    },

    stopBGM() {
        if (this.currentBGM) {
            this.currentBGM.pause();
            this.currentBGM.currentTime = 0;
        }
    }
};

// ========== 游戏状态 ==========
class GameState {
    constructor() {
        this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
        this.currentPlayer = PLAYER_BLACK; // 玩家先手
        this.gameOver = false;
        this.winner = null;
        this.turnCount = 0;
        this.blockedCells = []; // 被禁止落子的格子 {row, col, turns}
        this.brokenCells = new Set(); // 被摔坏的格子
        this.selectedEnemy = null;
        this.enemyName = null; // 敌人名字
        this.playerSkills = [];
        this.enemySkills = [];
        this.activeSkill = null; // 当前激活的技能
        this.skipNextTurn = false; // 是否跳过下一回合
        this.hasActedThisTurn = false; // 本回合是否已经行动（落子或使用技能）
        this.jingruzhishuiActive = false; // 静如止水是否激活
        this.jingruzhishuiCount = 0; // 静如止水剩余行动次数
        this.jingruzhishuiStrategy = null; // 静如止水策略信息
    }

    reset() {
        this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
        this.currentPlayer = PLAYER_BLACK;
        this.gameOver = false;
        this.winner = null;
        this.turnCount = 0;
        this.blockedCells = [];
        this.brokenCells = new Set();
        this.playerSkills = [];
        this.enemySkills = [];
        this.activeSkill = null;
        this.skipNextTurn = false;
        this.hasActedThisTurn = false;
        this.jingruzhishuiActive = false;
        this.jingruzhishuiCount = 0;
        this.jingruzhishuiStrategy = null;
    }

    placePiece(row, col, player) {
        if (this.isValidMove(row, col)) {
            this.board[row][col] = player;
            return true;
        }
        return false;
    }

    isValidMove(row, col) {
        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
            return false;
        }
        if (this.board[row][col] !== 0) {
            return false;
        }
        if (this.brokenCells.has(`${row},${col}`)) {
            return false;
        }
        // 检查是否被临时禁止
        for (let blocked of this.blockedCells) {
            if (blocked.row === row && blocked.col === col) {
                return false;
            }
        }
        return true;
    }

    checkWin(row, col, player) {
        const directions = [
            [0, 1],   // 横
            [1, 0],   // 竖
            [1, 1],   // 右下斜
            [1, -1]   // 左下斜
        ];

        for (let [dx, dy] of directions) {
            let count = 1;

            // 正方向
            for (let i = 1; i < 5; i++) {
                const newRow = row + dx * i;
                const newCol = col + dy * i;
                if (newRow >= 0 && newRow < BOARD_SIZE &&
                    newCol >= 0 && newCol < BOARD_SIZE &&
                    this.board[newRow][newCol] === player) {
                    count++;
                } else {
                    break;
                }
            }

            // 反方向
            for (let i = 1; i < 5; i++) {
                const newRow = row - dx * i;
                const newCol = col - dy * i;
                if (newRow >= 0 && newRow < BOARD_SIZE &&
                    newCol >= 0 && newCol < BOARD_SIZE &&
                    this.board[newRow][newCol] === player) {
                    count++;
                } else {
                    break;
                }
            }

            if (count >= 5) {
                return true;
            }
        }
        return false;
    }

    nextTurn() {
        this.turnCount++;

        // 更新被禁止的格子
        this.blockedCells = this.blockedCells.filter(blocked => {
            blocked.turns--;
            return blocked.turns > 0;
        });

        // 更新技能冷却
        [...this.playerSkills, ...this.enemySkills].forEach(skill => {
            if (skill.currentCooldown > 0) {
                skill.currentCooldown--;
            }
        });

        // 切换玩家
        if (!this.skipNextTurn) {
            this.currentPlayer = this.currentPlayer === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
        } else {
            this.skipNextTurn = false;
        }

        // 重置行动标记
        this.hasActedThisTurn = false;
    }
}

// ========== 技能系统 ==========
class Skill {
    constructor(name, description, cooldown, effect) {
        this.name = name;
        this.description = description;
        this.cooldown = cooldown;
        this.currentCooldown = 0;
        this.effect = effect;
    }

    canUse() {
        return this.currentCooldown === 0 && !game.gameOver;
    }

    use() {
        if (this.canUse()) {
            this.currentCooldown = this.cooldown;
            return this.effect();
        }
        return false;
    }
}

// 技能定义
const SKILLS = {
    // 飞沙走石：移除对手棋子
    feishazoushi: {
        name: '飞沙走石',
        description: '选中对手的一枚棋子令其消失，敌方下一回合不能在此落子',
        cooldown: 10,
        needsTarget: true,
        targetType: 'opponent'
    },

    // 静如止水：冻结对方
    jingruzhishui: {
        name: '静如止水',
        description: '冻结对方一回合，我方连续进行两个回合',
        cooldown: 16,
        needsTarget: false,
        targetType: null
    },

    // 力拔山兮：摔坏区域
    libashanxi: {
        name: '力拔山兮',
        description: '选中任意3x3的棋盘区域将其摔坏，以后不能在此落子',
        cooldown: 20,
        needsTarget: true,
        targetType: 'area'
    },

    // 东山再起：恢复摔坏区域
    dongshanzhaiqi: {
        name: '东山再起',
        description: '选择我方两颗棋子将所有摔坏区域恢复，选中的棋子消失',
        cooldown: 12,
        needsTarget: true,
        targetType: 'ownPieces'
    },

    // 调呈离山：移动对手棋子
    diaochenglishan: {
        name: '调呈离山',
        description: '选中对手一颗棋子将其移到其他位置，敌方下一回合不能在被移走的位置落子',
        cooldown: 10,
        needsTarget: true,
        targetType: 'moveOpponent'
    }
};

// 角色技能配置
const CHARACTER_SKILLS = {
    zhangcheng: ['feishazoushi', 'jingruzhishui', 'libashanxi', 'dongshanzhaiqi', 'diaochenglishan'],
    ziqi: ['feishazoushi'],
    jinengwu: ['feishazoushi', 'libashanxi', 'diaochenglishan'],
    wangjinbao: ['jingruzhishui', 'dongshanzhaiqi', 'diaochenglishan']
};

// ========== AI系统 ==========
class AI {
    constructor(difficulty, character) {
        this.difficulty = difficulty;
        this.character = character;
    }

    // 评估棋盘位置的分数
    evaluatePosition(board, row, col, player) {
        let score = 0;
        const directions = [[0,1], [1,0], [1,1], [1,-1]];

        for (let [dx, dy] of directions) {
            // 计算这个方向上的威胁程度
            const threat = this.evaluateDirection(board, row, col, dx, dy, player);
            score += threat;
        }

        return score;
    }

    // 评估某个方向的威胁分数
    evaluateDirection(board, row, col, dx, dy, player) {
        // 模拟在(row, col)放置player的棋子
        let count = 1;  // 当前位置
        let openEnds = 0;  // 开口数
        let spaces = 0;  // 空位数

        // 正方向扫描
        let forwardCount = 0;
        let forwardOpen = false;
        for (let i = 1; i <= 5; i++) {
            const r = row + dx * i;
            const c = col + dy * i;

            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || game.brokenCells.has(`${r},${c}`)) {
                break;
            }

            if (board[r][c] === player) {
                forwardCount++;
            } else if (board[r][c] === 0) {
                // 遇到空位，检查是否还有己方棋子
                forwardOpen = true;
                let hasMorePieces = false;
                for (let j = i + 1; j <= 5; j++) {
                    const r2 = row + dx * j;
                    const c2 = col + dy * j;
                    if (r2 < 0 || r2 >= BOARD_SIZE || c2 < 0 || c2 >= BOARD_SIZE || game.brokenCells.has(`${r2},${c2}`)) {
                        break;
                    }
                    if (board[r2][c2] === player) {
                        hasMorePieces = true;
                        break;
                    } else if (board[r2][c2] !== 0) {
                        break;
                    }
                }
                if (!hasMorePieces) {
                    break;
                }
                spaces++;
            } else {
                // 遇到对手棋子
                break;
            }
        }

        // 反方向扫描
        let backwardCount = 0;
        let backwardOpen = false;
        for (let i = 1; i <= 5; i++) {
            const r = row - dx * i;
            const c = col - dy * i;

            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || game.brokenCells.has(`${r},${c}`)) {
                break;
            }

            if (board[r][c] === player) {
                backwardCount++;
            } else if (board[r][c] === 0) {
                backwardOpen = true;
                let hasMorePieces = false;
                for (let j = i + 1; j <= 5; j++) {
                    const r2 = row - dx * j;
                    const c2 = col - dy * j;
                    if (r2 < 0 || r2 >= BOARD_SIZE || c2 < 0 || c2 >= BOARD_SIZE || game.brokenCells.has(`${r2},${c2}`)) {
                        break;
                    }
                    if (board[r2][c2] === player) {
                        hasMorePieces = true;
                        break;
                    } else if (board[r2][c2] !== 0) {
                        break;
                    }
                }
                if (!hasMorePieces) {
                    break;
                }
                spaces++;
            } else {
                break;
            }
        }

        count += forwardCount + backwardCount;
        if (forwardOpen) openEnds++;
        if (backwardOpen) openEnds++;

        // 评分逻辑：特别强调防守四连子
        let score = 0;

        if (count >= 5) {
            // 五连或以上，必胜
            score = 1000000;
        } else if (count === 4) {
            // 四连子
            if (openEnds === 2) {
                // 活四（两端都开），极高优先级
                score = 100000;
            } else if (openEnds === 1) {
                // 冲四（一端开），也是很高优先级
                score = 50000;
            } else {
                // 死四
                score = 100;
            }
        } else if (count === 3) {
            // 三连子
            if (openEnds === 2) {
                // 活三
                score = 5000;
            } else if (openEnds === 1) {
                // 眠三
                score = 1000;
            } else {
                score = 50;
            }
        } else if (count === 2) {
            if (openEnds === 2) {
                score = 500;
            } else if (openEnds === 1) {
                score = 100;
            } else {
                score = 10;
            }
        } else if (count === 1) {
            score = openEnds * 5;
        }

        return score;
    }

    // 王金宝专用：深度搜索（minimax搜索）
    minimaxSearch(depth, alpha, beta, isMaximizing) {
        const opponent = isMaximizing ? PLAYER_WHITE : PLAYER_BLACK;
        const currentPlayer = isMaximizing ? PLAYER_BLACK : PLAYER_WHITE;

        // 检查终止条件
        if (depth === 0) {
            return this.evaluateBoardState();
        }

        // 获取所有可能的走法（按优先级排序以提高剪枝效率）
        const moves = this.getCandidateMoves();

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let move of moves) {
                game.board[move.row][move.col] = PLAYER_WHITE;
                const evaluation = this.minimaxSearch(depth - 1, alpha, beta, false);
                game.board[move.row][move.col] = 0;

                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) {
                    break; // Beta剪枝
                }
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let move of moves) {
                game.board[move.row][move.col] = PLAYER_BLACK;
                const evaluation = this.minimaxSearch(depth - 1, alpha, beta, true);
                game.board[move.row][move.col] = 0;

                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) {
                    break; // Alpha剪枝
                }
            }
            return minEval;
        }
    }

    // 获取候选走法（智能排序，用于剪枝优化）
    getCandidateMoves() {
        const moves = [];

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (!game.isValidMove(row, col)) continue;

                // 计算这个位置的启发式分数
                const score = this.evaluatePosition(game.board, row, col, PLAYER_WHITE) +
                             this.evaluatePosition(game.board, row, col, PLAYER_BLACK);

                moves.push({row, col, score});
            }
        }

        // 按分数降序排序（高分优先搜索）
        moves.sort((a, b) => b.score - a.score);

        // 只返回前15个最优候选（减少搜索树）
        return moves.slice(0, 15);
    }

    // 评估整个棋盘状态
    evaluateBoardState() {
        let score = 0;

        // 评估所有位置对双方的价值
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (game.board[row][col] === PLAYER_WHITE) {
                    score += this.evaluatePosition(game.board, row, col, PLAYER_WHITE);
                } else if (game.board[row][col] === PLAYER_BLACK) {
                    score -= this.evaluatePosition(game.board, row, col, PLAYER_BLACK);
                }
            }
        }

        return score;
    }

    // 检测多重威胁（如双活三）
    detectMultipleThreats(player) {
        const threats = [];
        const directions = [[0,1], [1,0], [1,1], [1,-1]];

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (!game.isValidMove(row, col)) continue;

                // 模拟落子
                game.board[row][col] = player;

                let threeThreatCount = 0;
                let fourThreatCount = 0;

                // 检查这个位置产生的威胁数量
                for (let [dx, dy] of directions) {
                    const score = this.evaluateDirection(game.board, row, col, dx, dy, player);

                    if (score >= 50000) {
                        fourThreatCount++;
                    } else if (score >= 5000) {
                        threeThreatCount++;
                    }
                }

                game.board[row][col] = 0;

                // 双活三或活三+冲四是必杀
                if (threeThreatCount >= 2 || (threeThreatCount >= 1 && fourThreatCount >= 1)) {
                    threats.push({row, col, priority: 'critical', threes: threeThreatCount, fours: fourThreatCount});
                } else if (fourThreatCount >= 1) {
                    threats.push({row, col, priority: 'high', fours: fourThreatCount});
                } else if (threeThreatCount >= 1) {
                    threats.push({row, col, priority: 'medium', threes: threeThreatCount});
                }
            }
        }

        return threats;
    }

    // 查找最佳落子位置
    findBestMove() {
        let bestScore = -1;
        let bestMoves = [];
        const opponent = game.currentPlayer === PLAYER_WHITE ? PLAYER_BLACK : PLAYER_WHITE;

        // 王金宝专属：使用深度搜索
        if (this.character === 'wangjinbao') {
            return this.findBestMoveWangjinbao();
        }

        // 首先检查是否有必须防守的紧急情况（对手四连子）
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (!game.isValidMove(row, col)) continue;

                // 检查对手在这个位置是否能形成五连
                const opponentScore = this.evaluatePosition(game.board, row, col, opponent);
                if (opponentScore >= 50000) {
                    // 对手有冲四或活四，必须立即防守
                    return {row, col};
                }
            }
        }

        // 没有紧急防守需求，正常评估
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (!game.isValidMove(row, col)) continue;

                // 评估进攻分数
                let attackScore = this.evaluatePosition(game.board, row, col, game.currentPlayer);

                // 评估防守分数
                let defenseScore = this.evaluatePosition(game.board, row, col, opponent);

                // 根据AI类型调整权重
                let totalScore;
                if (this.difficulty === 'hard') {
                    // 高级AI优先防守致命威胁
                    if (defenseScore >= 50000) {
                        // 对手有四连，防守优先
                        totalScore = defenseScore * 2;
                    } else if (this.character === 'jinengwu') {
                        // 技能五：更重视进攻
                        totalScore = attackScore * 1.5 + defenseScore * 1.0;
                    } else {
                        totalScore = attackScore * 1.2 + defenseScore * 1.2;
                    }
                } else {
                    // 子棋：基础AI，即使是简单AI也应该防守四连
                    if (defenseScore >= 50000) {
                        totalScore = defenseScore * 1.5;
                    } else {
                        totalScore = attackScore + defenseScore;
                        // 添加随机性，使其更容易失误
                        totalScore *= (0.7 + Math.random() * 0.6);
                    }
                }

                if (totalScore > bestScore) {
                    bestScore = totalScore;
                    bestMoves = [{row, col}];
                } else if (totalScore === bestScore) {
                    bestMoves.push({row, col});
                }
            }
        }

        return bestMoves.length > 0 ? bestMoves[Math.floor(Math.random() * bestMoves.length)] : null;
    }

    // 王金宝专用：极致难度的决策
    findBestMoveWangjinbao() {
        const opponent = PLAYER_BLACK;

        // 开局策略：前3步优先占据中心区域
        if (game.turnCount <= 6) { // 前3回合（每回合双方各落一子）
            const centerPositions = [
                {row: 7, col: 7},   // 天元
                {row: 6, col: 7}, {row: 8, col: 7}, {row: 7, col: 6}, {row: 7, col: 8}, // 天元周围
                {row: 6, col: 6}, {row: 6, col: 8}, {row: 8, col: 6}, {row: 8, col: 8}, // 对角
                {row: 5, col: 7}, {row: 9, col: 7}, {row: 7, col: 5}, {row: 7, col: 9}  // 扩展
            ];

            for (let pos of centerPositions) {
                if (game.isValidMove(pos.row, pos.col)) {
                    // 检查这个位置是否靠近玩家棋子
                    let hasNearbyPlayerPiece = false;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            if (dr === 0 && dc === 0) continue;
                            const nr = pos.row + dr;
                            const nc = pos.col + dc;
                            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                                if (game.board[nr][nc] === PLAYER_BLACK) {
                                    hasNearbyPlayerPiece = true;
                                    break;
                                }
                            }
                        }
                        if (hasNearbyPlayerPiece) break;
                    }

                    // 开局优先选择靠近玩家或中心的位置
                    if (hasNearbyPlayerPiece || game.turnCount <= 2) {
                        return pos;
                    }
                }
            }
        }

        // 优先级1: 检查是否能直接获胜
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (!game.isValidMove(row, col)) continue;

                game.board[row][col] = PLAYER_WHITE;
                if (game.checkWin(row, col, PLAYER_WHITE)) {
                    game.board[row][col] = 0;
                    return {row, col};
                }
                game.board[row][col] = 0;
            }
        }

        // 优先级2: 检测双方的多重威胁
        const aiThreats = this.detectMultipleThreats(PLAYER_WHITE);
        const playerThreats = this.detectMultipleThreats(PLAYER_BLACK);

        // 如果能制造必杀棋（双活三或活三+冲四）
        const criticalAttack = aiThreats.find(t => t.priority === 'critical');
        if (criticalAttack) {
            return {row: criticalAttack.row, col: criticalAttack.col};
        }

        // 如果玩家有必杀威胁，必须防守
        const criticalDefense = playerThreats.find(t => t.priority === 'critical');
        if (criticalDefense) {
            return {row: criticalDefense.row, col: criticalDefense.col};
        }

        // 优先级3: 防守对手的活四或冲四
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (!game.isValidMove(row, col)) continue;

                const opponentScore = this.evaluatePosition(game.board, row, col, opponent);
                if (opponentScore >= 50000) {
                    return {row, col};
                }
            }
        }

        // 优先级4: 制造活四威胁
        const highAttack = aiThreats.find(t => t.priority === 'high');
        if (highAttack) {
            return {row: highAttack.row, col: highAttack.col};
        }

        // 优先级5: 使用深度搜索找最佳位置（2层搜索）
        let bestMove = null;
        let bestEval = -Infinity;

        const candidates = this.getCandidateMoves();

        for (let move of candidates.slice(0, 10)) { // 只搜索前10个候选
            game.board[move.row][move.col] = PLAYER_WHITE;

            // 检查是否胜利
            if (game.checkWin(move.row, move.col, PLAYER_WHITE)) {
                game.board[move.row][move.col] = 0;
                return {row: move.row, col: move.col};
            }

            const evaluation = this.minimaxSearch(2, -Infinity, Infinity, false);
            game.board[move.row][move.col] = 0;

            if (evaluation > bestEval) {
                bestEval = evaluation;
                bestMove = {row: move.row, col: move.col};
            }
        }

        return bestMove || candidates[0];
    }

    // AI决定是否使用技能
    shouldUseSkill() {
        if (this.difficulty === 'easy') {
            // 子棋很少使用技能
            return Math.random() < 0.15;
        } else if (this.character === 'wangjinbao') {
            // 王金宝：更具战略性地使用技能
            return this.shouldWangjinbaoUseSkill();
        } else {
            // 高级AI会更聪明地使用技能
            return Math.random() < 0.4;
        }
    }

    // 王金宝的技能使用决策（更战略性）
    shouldWangjinbaoUseSkill() {
        // 分析当前局势
        const playerThreats = this.detectMultipleThreats(PLAYER_BLACK);
        const aiThreats = this.detectMultipleThreats(PLAYER_WHITE);

        // 如果玩家有严重威胁（双活三或活三+冲四），高概率使用技能防守
        if (playerThreats.some(t => t.priority === 'critical')) {
            return Math.random() < 0.85; // 85%概率使用技能
        }

        // 如果玩家有中等威胁（活三或冲四）
        if (playerThreats.some(t => t.priority === 'high' || t.priority === 'medium')) {
            return Math.random() < 0.55; // 55%概率使用技能
        }

        // 如果自己有良好的进攻机会
        if (aiThreats.some(t => t.priority === 'medium')) {
            return Math.random() < 0.45; // 45%概率使用技能进攻
        }

        // 中后期（回合数>20）更倾向使用技能
        if (game.turnCount > 20) {
            return Math.random() < 0.35;
        }

        return Math.random() < 0.20;
    }

    // 检测是否有活四（两端开口的四连）
    detectActiveFour(player) {
        const directions = [[0,1], [1,0], [1,1], [1,-1]];

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (game.board[row][col] !== player) continue;

                for (let [dx, dy] of directions) {
                    let count = 1;
                    let positions = [{row, col}];

                    // 正方向
                    for (let i = 1; i < 4; i++) {
                        const r = row + dx * i;
                        const c = col + dy * i;
                        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE &&
                            game.board[r][c] === player && !game.brokenCells.has(`${r},${c}`)) {
                            count++;
                            positions.push({row: r, col: c});
                        } else {
                            break;
                        }
                    }

                    // 反方向
                    for (let i = 1; i < 4; i++) {
                        const r = row - dx * i;
                        const c = col - dy * i;
                        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE &&
                            game.board[r][c] === player && !game.brokenCells.has(`${r},${c}`)) {
                            count++;
                            positions.push({row: r, col: c});
                        } else {
                            break;
                        }
                    }

                    if (count === 4) {
                        // 找到四连子，检查两端
                        positions.sort((a, b) => {
                            const valA = a.row * dx + a.col * dy;
                            const valB = b.row * dx + b.col * dy;
                            return valA - valB;
                        });

                        const first = positions[0];
                        const last = positions[3];

                        // 检查前端
                        const frontRow = first.row - dx;
                        const frontCol = first.col - dy;
                        const frontValid = frontRow >= 0 && frontRow < BOARD_SIZE &&
                                          frontCol >= 0 && frontCol < BOARD_SIZE &&
                                          game.isValidMove(frontRow, frontCol);

                        // 检查后端
                        const backRow = last.row + dx;
                        const backCol = last.col + dy;
                        const backValid = backRow >= 0 && backRow < BOARD_SIZE &&
                                         backCol >= 0 && backCol < BOARD_SIZE &&
                                         game.isValidMove(backRow, backCol);

                        // 活四：至少一端开口
                        if (frontValid || backValid) {
                            return {
                                hasFour: true,
                                positions: positions,
                                frontEnd: frontValid ? {row: frontRow, col: frontCol} : null,
                                backEnd: backValid ? {row: backRow, col: backCol} : null,
                                direction: {dx, dy}
                            };
                        }
                    }
                }
            }
        }

        return {hasFour: false};
    }

    // 检测是否有活三（可以连成五子的三连）
    detectActiveThree(player) {
        const directions = [[0,1], [1,0], [1,1], [1,-1]];

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (game.board[row][col] !== player) continue;

                for (let [dx, dy] of directions) {
                    // 检查是否有三连子
                    let count = 1;
                    let positions = [{row, col}];

                    // 正方向
                    for (let i = 1; i < 3; i++) {
                        const r = row + dx * i;
                        const c = col + dy * i;
                        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE &&
                            game.board[r][c] === player && !game.brokenCells.has(`${r},${c}`)) {
                            count++;
                            positions.push({row: r, col: c});
                        } else {
                            break;
                        }
                    }

                    // 反方向
                    for (let i = 1; i < 3; i++) {
                        const r = row - dx * i;
                        const c = col - dy * i;
                        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE &&
                            game.board[r][c] === player && !game.brokenCells.has(`${r},${c}`)) {
                            count++;
                            positions.push({row: r, col: c});
                        } else {
                            break;
                        }
                    }

                    if (count === 3) {
                        // 找到三连子，检查两端
                        positions.sort((a, b) => {
                            const valA = a.row * dx + a.col * dy;
                            const valB = b.row * dx + b.col * dy;
                            return valA - valB;
                        });

                        const first = positions[0];
                        const last = positions[2];

                        // 检查前端
                        const frontRow = first.row - dx;
                        const frontCol = first.col - dy;
                        const frontValid = frontRow >= 0 && frontRow < BOARD_SIZE &&
                                          frontCol >= 0 && frontCol < BOARD_SIZE &&
                                          game.isValidMove(frontRow, frontCol);

                        // 检查后端
                        const backRow = last.row + dx;
                        const backCol = last.col + dy;
                        const backValid = backRow >= 0 && backRow < BOARD_SIZE &&
                                         backCol >= 0 && backCol < BOARD_SIZE &&
                                         game.isValidMove(backRow, backCol);

                        // 检查前端延伸（是否有足够空间连成五子）
                        let frontSpace = 0;
                        if (frontValid) {
                            frontSpace = 1;
                            for (let i = 2; i <= 2; i++) {
                                const r = first.row - dx * i;
                                const c = first.col - dy * i;
                                if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE &&
                                    game.isValidMove(r, c)) {
                                    frontSpace++;
                                } else {
                                    break;
                                }
                            }
                        }

                        // 检查后端延伸
                        let backSpace = 0;
                        if (backValid) {
                            backSpace = 1;
                            for (let i = 2; i <= 2; i++) {
                                const r = last.row + dx * i;
                                const c = last.col + dy * i;
                                if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE &&
                                    game.isValidMove(r, c)) {
                                    backSpace++;
                                } else {
                                    break;
                                }
                            }
                        }

                        // 判断是否是活三或有足够空间的眠三
                        if ((frontValid && backValid) || (frontSpace >= 2) || (backSpace >= 2)) {
                            return {
                                hasThree: true,
                                positions: positions,
                                frontEnd: frontValid ? {row: frontRow, col: frontCol} : null,
                                backEnd: backValid ? {row: backRow, col: backCol} : null,
                                frontSpace: frontSpace,
                                backSpace: backSpace,
                                direction: {dx, dy}
                            };
                        }
                    }
                }
            }
        }

        return {hasThree: false};
    }

    // 尝试用技能应对玩家的活四
    tryCounterActiveFour(fourInfo) {
        // 优先使用静如止水堵住开口（放宽条件：至少有一端开口即可）
        const jingruzhishuiSkill = game.enemySkills.find(s => s.id === 'jingruzhishui');
        if (jingruzhishuiSkill && jingruzhishuiSkill.canUse() && (fourInfo.frontEnd || fourInfo.backEnd)) {
            game.jingruzhishuiStrategy = {reason: 'defense_four', data: fourInfo};
            game.jingruzhishuiActive = true;
            game.jingruzhishuiCount = 2;
            jingruzhishuiSkill.currentCooldown = jingruzhishuiSkill.cooldown;

            showMessage(`${game.enemyName}使用了静如止水！堵住你的活四`, 'warning');
            AudioManager.playSound('jingruzhishui');
            game.hasActedThisTurn = true;
            drawBoard();
            updateUI();

            setTimeout(() => {
                this.makeMove();
            }, 800);
            return true;
        }

        // 尝试用调呈离山移动其中一颗棋子（修复变量名拼写）
        const diaochenglishan = game.enemySkills.find(s => s.id === 'diaochenglishan');
        if (diaochenglishan && diaochenglishan.canUse() && fourInfo.positions.length > 0) {
            const targetPos = fourInfo.positions[Math.floor(fourInfo.positions.length / 2)];
            // 寻找远离活四的空位，优先选择远距离，但如果找不到就降低要求
            let newPos = null;
            const minDistances = [5, 4, 3, 2, 1]; // 尝试从远到近
            
            for (let minDist of minDistances) {
                for (let row = 0; row < BOARD_SIZE; row++) {
                    for (let col = 0; col < BOARD_SIZE; col++) {
                        if (game.isValidMove(row, col)) {
                            const dist = Math.abs(row - targetPos.row) + Math.abs(col - targetPos.col);
                            if (dist >= minDist) {
                                newPos = {row, col};
                                break;
                            }
                        }
                    }
                    if (newPos) break;
                }
                if (newPos) break;
            }

            if (newPos) {
                game.board[targetPos.row][targetPos.col] = 0;
                game.board[newPos.row][newPos.col] = PLAYER_BLACK;
                game.blockedCells.push({row: targetPos.row, col: targetPos.col, turns: 2});
                diaochenglishan.currentCooldown = diaochenglishan.cooldown;

                showMessage(`${game.enemyName}使用了调呈离山！移动你的棋子`, 'warning');
                AudioManager.playSound('diaochenglishan');
                game.hasActedThisTurn = true;
                drawBoard();
                updateUI();
                game.nextTurn();
                return true;
            }
        }

        // 尝试用飞沙走石移除其中一颗棋子
        const feishazoushiSkill = game.enemySkills.find(s => s.id === 'feishazoushi');
        if (feishazoushiSkill && feishazoushiSkill.canUse() && fourInfo.positions.length > 0) {
            const targetPos = fourInfo.positions[Math.floor(fourInfo.positions.length / 2)];
            game.board[targetPos.row][targetPos.col] = 0;
            game.blockedCells.push({row: targetPos.row, col: targetPos.col, turns: 2});
            feishazoushiSkill.currentCooldown = feishazoushiSkill.cooldown;

            showMessage(`${game.enemyName}使用了飞沙走石！移除你的关键棋子`, 'warning');
            AudioManager.playSound('feishazoushi');
            game.hasActedThisTurn = true;
            drawBoard();
            updateUI();
            game.nextTurn();
            return true;
        }

        // 尝试用力拔山兮砸坏活四区域
        const libashanxiSkill = game.enemySkills.find(s => s.id === 'libashanxi');
        if (libashanxiSkill && libashanxiSkill.canUse() && fourInfo.positions.length > 0) {
            const centerPos = fourInfo.positions[Math.floor(fourInfo.positions.length / 2)];

            // 3x3区域：从-1到1
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    const r = centerPos.row + i;
                    const c = centerPos.col + j;
                    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
                        const key = `${r},${c}`;
                        game.brokenCells.add(key);
                        if (game.board[r][c] !== 0) {
                            game.board[r][c] = 0;
                        }
                    }
                }
            }

            libashanxiSkill.currentCooldown = libashanxiSkill.cooldown;
            showMessage(`${game.enemyName}使用了力拔山兮！摧毁你的活四区域`, 'warning');
            AudioManager.playSound('libashanxi');
            game.hasActedThisTurn = true;
            drawBoard();
            updateUI();
            game.nextTurn();
            return true;
        }

        return false;
    }

    // AI使用飞沙走石
    useFeishazoushi(skill) {
        const opponentPieces = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (game.board[row][col] === PLAYER_BLACK) {
                    opponentPieces.push({row, col});
                }
            }
        }

        if (opponentPieces.length > 0) {
            // 选择一个重要的对手棋子移除
            const target = opponentPieces[Math.floor(Math.random() * opponentPieces.length)];
            game.board[target.row][target.col] = 0;
            game.blockedCells.push({row: target.row, col: target.col, turns: 2}); // 禁止2回合
            skill.currentCooldown = skill.cooldown;
            showMessage(`${game.enemyName}使用了${skill.name}！`, 'warning');
            AudioManager.playSound('feishazoushi');
            return true;
        }
        return false;
    }

    // AI使用静如止水
    useJingruzhishui(skill) {
        game.jingruzhishuiActive = true;
        game.jingruzhishuiCount = 2;
        skill.currentCooldown = skill.cooldown;
        showMessage(`${game.enemyName}使用了${skill.name}！你的下一回合被冻结`, 'warning');
        AudioManager.playSound('jingruzhishui');
        return true;
    }

    // AI使用力拔山兮
    useLibashanxi(skill) {
        const playerPieces = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (game.board[row][col] === PLAYER_BLACK) {
                    playerPieces.push({row, col});
                }
            }
        }

        if (playerPieces.length > 0) {
            // 选择一个玩家棋子密集的区域
            const target = playerPieces[Math.floor(Math.random() * playerPieces.length)];
            const startRow = Math.max(0, target.row - 1);
            const startCol = Math.max(0, target.col - 1);

            if (startRow <= BOARD_SIZE - 3 && startCol <= BOARD_SIZE - 3) {
                for (let r = startRow; r < startRow + 3 && r < BOARD_SIZE; r++) {
                    for (let c = startCol; c < startCol + 3 && c < BOARD_SIZE; c++) {
                        game.brokenCells.add(`${r},${c}`);
                        game.board[r][c] = 0;
                    }
                }
                skill.currentCooldown = skill.cooldown;
                showMessage(`${game.enemyName}使用了${skill.name}！摔坏了一片区域`, 'warning');
                AudioManager.playSound('libashanxi');
                return true;
            }
        }
        return false;
    }

    // AI使用东山再起
    useDongshanzhaiqi(skill) {
        if (game.brokenCells.size === 0) {
            return false;
        }

        // 王金宝专用：更智能的东山再起
        if (this.character === 'wangjinbao') {
            return this.useSmartDongshanzhaiqi(skill);
        }

        const aiPieces = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (game.board[row][col] === PLAYER_WHITE) {
                    aiPieces.push({row, col});
                }
            }
        }

        if (aiPieces.length >= 2) {
            // 随机选择两颗棋子
            const piece1 = aiPieces[Math.floor(Math.random() * aiPieces.length)];
            let piece2;
            do {
                piece2 = aiPieces[Math.floor(Math.random() * aiPieces.length)];
            } while (piece1.row === piece2.row && piece1.col === piece2.col && aiPieces.length > 1);

            game.brokenCells.clear();
            game.board[piece1.row][piece1.col] = 0;
            game.board[piece2.row][piece2.col] = 0;
            skill.currentCooldown = skill.cooldown;
            showMessage(`${game.enemyName}使用了${skill.name}！恢复了所有摔坏区域`, 'warning');
            AudioManager.playSound('dongshanzaiqi');
            return true;
        }
        return false;
    }

    // 王金宝专用：智能东山再起
    useSmartDongshanzhaiqi(skill) {
        if (game.brokenCells.size === 0) {
            return false;
        }

        // 只有在摔坏区域包含关键位置时才使用
        let hasValuableBrokenCells = false;
        game.brokenCells.forEach(cellKey => {
            const [row, col] = cellKey.split(',').map(Number);
            
            // 检查这个位置对双方是否重要
            const originalCell = game.board[row][col];
            game.board[row][col] = 0; // 临时清空以便评估
            
            const aiValue = this.evaluatePosition(game.board, row, col, PLAYER_WHITE);
            const playerValue = this.evaluatePosition(game.board, row, col, PLAYER_BLACK);
            
            game.board[row][col] = originalCell;
            
            // 如果这个位置对任何一方都有价值，说明值得恢复
            if (aiValue >= 1000 || playerValue >= 1000) {
                hasValuableBrokenCells = true;
            }
        });

        if (!hasValuableBrokenCells) {
            return false; // 摔坏区域不重要，不值得牺牲棋子
        }

        const aiPieces = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (game.board[row][col] === PLAYER_WHITE) {
                    const value = this.evaluatePosition(game.board, row, col, PLAYER_WHITE);
                    aiPieces.push({row, col, value});
                }
            }
        }

        if (aiPieces.length < 2) {
            return false;
        }

        // 选择价值最低的两颗棋子
        aiPieces.sort((a, b) => a.value - b.value);
        const piece1 = aiPieces[0];
        const piece2 = aiPieces[1];

        // 只有当牺牲的价值小于恢复的价值时才使用
        if (piece1.value + piece2.value > 10000) {
            return false; // 牺牲代价太大
        }

        game.brokenCells.clear();
        game.board[piece1.row][piece1.col] = 0;
        game.board[piece2.row][piece2.col] = 0;
        skill.currentCooldown = skill.cooldown;
        showMessage(`${game.enemyName}使用了${skill.name}！战略性恢复区域`, 'warning');
        AudioManager.playSound('dongshanzaiqi');
        return true;
    }

    // AI使用调呈离山
    useDiaochenglishan(skill) {
        // 王金宝专用：更智能的调呈离山
        if (this.character === 'wangjinbao') {
            return this.useSmartDiaochenglishan(skill);
        }

        const opponentPieces = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (game.board[row][col] === PLAYER_BLACK) {
                    opponentPieces.push({row, col});
                }
            }
        }

        if (opponentPieces.length > 0) {
            const from = opponentPieces[Math.floor(Math.random() * opponentPieces.length)];

            // 找一个有效的目标位置
            const validMoves = [];
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    if (game.isValidMove(row, col)) {
                        validMoves.push({row, col});
                    }
                }
            }

            if (validMoves.length > 0) {
                const to = validMoves[Math.floor(Math.random() * validMoves.length)];
                game.board[to.row][to.col] = game.board[from.row][from.col];
                game.board[from.row][from.col] = 0;
                game.blockedCells.push({row: from.row, col: from.col, turns: 2}); // 禁止2回合
                skill.currentCooldown = skill.cooldown;
                showMessage(`${game.enemyName}使用了${skill.name}！移动了你的棋子`, 'warning');
                AudioManager.playSound('diaochenglishan');
                return true;
            }
        }
        return false;
    }

    // 王金宝专用：智能调呈离山
    useSmartDiaochenglishan(skill) {
        // 找出玩家威胁最大的棋子
        let bestTarget = null;
        let maxThreatReduction = -1;

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (game.board[row][col] !== PLAYER_BLACK) continue;

                // 计算移除这颗棋子能减少多少威胁
                const originalThreat = this.evaluatePosition(game.board, row, col, PLAYER_BLACK);

                // 暂时移除
                game.board[row][col] = 0;
                const newThreat = 0;
                const threatReduction = originalThreat - newThreat;
                game.board[row][col] = PLAYER_BLACK;

                if (threatReduction > maxThreatReduction) {
                    maxThreatReduction = threatReduction;
                    bestTarget = {row, col};
                }
            }
        }

        if (!bestTarget) return false;

        // 找一个最差的位置放置这颗棋子（离其他棋子远）
        let worstDestination = null;
        let minScore = Infinity;

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (!game.isValidMove(row, col)) continue;

                // 临时放置
                game.board[row][col] = PLAYER_BLACK;
                const score = this.evaluatePosition(game.board, row, col, PLAYER_BLACK);
                game.board[row][col] = 0;

                // 选择最低分的位置
                if (score < minScore) {
                    minScore = score;
                    worstDestination = {row, col};
                }
            }
        }

        if (worstDestination) {
            game.board[worstDestination.row][worstDestination.col] = game.board[bestTarget.row][bestTarget.col];
            game.board[bestTarget.row][bestTarget.col] = 0;
            game.blockedCells.push({row: bestTarget.row, col: bestTarget.col, turns: 2});
            skill.currentCooldown = skill.cooldown;
            showMessage(`${game.enemyName}使用了${skill.name}！精准破坏你的阵型`, 'warning');
            AudioManager.playSound('diaochenglishan');
            return true;
        }

        return false;
    }

    // AI尝试使用技能（不包括静如止水，静如止水由优先级系统管理）
    tryUseSkill() {
        const availableSkills = game.enemySkills.filter(s => s.canUse() && s.id !== 'jingruzhishui');
        if (availableSkills.length === 0) return false;

        const skill = availableSkills[Math.floor(Math.random() * availableSkills.length)];

        let result = false;
        if (skill.id === 'feishazoushi') {
            result = this.useFeishazoushi(skill);
        } else if (skill.id === 'libashanxi') {
            result = this.useLibashanxi(skill);
        } else if (skill.id === 'dongshanzhaiqi') {
            result = this.useDongshanzhaiqi(skill);
        } else if (skill.id === 'diaochenglishan') {
            result = this.useDiaochenglishan(skill);
        }

        return result;
    }

    makeMove() {
        // 如果正在静如止水效果中，智能落子
        if (game.jingruzhishuiActive && game.jingruzhishuiCount > 0) {
            // 获取静如止水的策略信息
            const strategyInfo = game.jingruzhishuiStrategy;
            let move = null;

            if (strategyInfo && strategyInfo.reason === 'attack') {
                // 进攻策略：在三连子的两端落子
                const data = strategyInfo.data;
                if (game.jingruzhishuiCount === 2 && data.frontEnd) {
                    move = data.frontEnd;
                } else if (game.jingruzhishuiCount === 1 && data.backEnd) {
                    move = data.backEnd;
                } else if (game.jingruzhishuiCount === 2 && !data.frontEnd && data.backEnd) {
                    move = data.backEnd;
                } else if (game.jingruzhishuiCount === 1 && data.backSpace >= 2) {
                    const {dx, dy} = data.direction;
                    const last = data.positions[data.positions.length - 1];
                    move = {
                        row: last.row + dx * 2,
                        col: last.col + dy * 2
                    };
                }
            } else if (strategyInfo && (strategyInfo.reason === 'defense' || strategyInfo.reason === 'defense_four')) {
                // 防守策略：堵住玩家三连子或活四的两端
                const data = strategyInfo.data;
                if (game.jingruzhishuiCount === 2 && data.frontEnd) {
                    move = data.frontEnd;
                } else if (game.jingruzhishuiCount === 1 && data.backEnd) {
                    move = data.backEnd;
                } else if (game.jingruzhishuiCount === 2 && !data.frontEnd && data.backEnd) {
                    // 只有一端开口，堵住这端
                    move = data.backEnd;
                } else if (game.jingruzhishuiCount === 1 && !data.backEnd && data.frontEnd) {
                    // 只有前端开口
                    move = data.frontEnd;
                }
            }

            // 如果没有策略信息或策略失败，使用最佳落子
            if (!move || !game.isValidMove(move.row, move.col)) {
                move = this.findBestMove();
            }

            if (move) {
                game.placePiece(move.row, move.col, game.currentPlayer);
                game.jingruzhishuiCount--;

                if (game.checkWin(move.row, move.col, game.currentPlayer)) {
                    game.gameOver = true;
                    game.winner = game.currentPlayer;
                    endGame();
                    return;
                }

                drawBoard();
                updateUI();

                // 如果还有剩余次数，继续落子
                if (game.jingruzhishuiCount > 0) {
                    setTimeout(() => {
                        this.makeMove();
                    }, 800);
                } else {
                    // 静如止水效果结束，切换回合
                    game.jingruzhishuiActive = false;
                    game.jingruzhishuiStrategy = null;
                    game.nextTurn();
                    updateUI();
                }
            }
            return;
        }

        // ===== 优先级1: 检查是否可以直接落子获胜 =====
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (!game.isValidMove(row, col)) continue;

                game.board[row][col] = PLAYER_WHITE;
                const wouldWin = game.checkWin(row, col, PLAYER_WHITE);
                game.board[row][col] = 0;

                if (wouldWin) {
                    // 可以直接获胜，立即落子
                    game.hasActedThisTurn = true;
                    game.placePiece(row, col, game.currentPlayer);
                    game.gameOver = true;
                    game.winner = game.currentPlayer;
                    endGame();
                    return;
                }
            }
        }

        // ===== 优先级2: 高级AI检查是否可以用静如止水获胜 =====
        if (this.difficulty === 'hard') {
            const aiThree = this.detectActiveThree(PLAYER_WHITE);
            const jingruzhishuiSkill = game.enemySkills.find(s => s.id === 'jingruzhishui');

            if (aiThree.hasThree && jingruzhishuiSkill && jingruzhishuiSkill.canUse()) {
                // 使用静如止水获胜
                game.jingruzhishuiStrategy = {reason: 'attack', data: aiThree};
                game.jingruzhishuiActive = true;
                game.jingruzhishuiCount = 2;
                jingruzhishuiSkill.currentCooldown = jingruzhishuiSkill.cooldown;

                showMessage(`${game.enemyName}使用了静如止水！准备连续进攻`, 'warning');
                AudioManager.playSound('jingruzhishui');
                game.hasActedThisTurn = true;
                drawBoard();
                updateUI();

                setTimeout(() => {
                    this.makeMove();
                }, 800);
                return;
            }
        }

        // ===== 优先级3: 高级AI检查玩家是否有活四，必须应对 =====
        if (this.difficulty === 'hard') {
            const playerFour = this.detectActiveFour(PLAYER_BLACK);
            if (playerFour.hasFour) {
                // 首先尝试用技能应对活四
                if (this.tryCounterActiveFour(playerFour)) {
                    return;
                }
                
                // 如果技能用不了，必须通过落子防守（堵住开口）
                if (playerFour.frontEnd && game.isValidMove(playerFour.frontEnd.row, playerFour.frontEnd.col)) {
                    game.hasActedThisTurn = true;
                    game.placePiece(playerFour.frontEnd.row, playerFour.frontEnd.col, game.currentPlayer);
                    if (game.checkWin(playerFour.frontEnd.row, playerFour.frontEnd.col, game.currentPlayer)) {
                        game.gameOver = true;
                        game.winner = game.currentPlayer;
                        endGame();
                    } else {
                        game.nextTurn();
                        updateUI();
                    }
                    return;
                } else if (playerFour.backEnd && game.isValidMove(playerFour.backEnd.row, playerFour.backEnd.col)) {
                    game.hasActedThisTurn = true;
                    game.placePiece(playerFour.backEnd.row, playerFour.backEnd.col, game.currentPlayer);
                    if (game.checkWin(playerFour.backEnd.row, playerFour.backEnd.col, game.currentPlayer)) {
                        game.gameOver = true;
                        game.winner = game.currentPlayer;
                        endGame();
                    } else {
                        game.nextTurn();
                        updateUI();
                    }
                    return;
                }
            }
        }

        // ===== 优先级4: 高级AI检查玩家是否有活三，用静如止水防守 =====
        if (this.difficulty === 'hard') {
            const playerThree = this.detectActiveThree(PLAYER_BLACK);
            const jingruzhishuiSkill = game.enemySkills.find(s => s.id === 'jingruzhishui');

            if (playerThree.hasThree && jingruzhishuiSkill && jingruzhishuiSkill.canUse()) {
                // 使用静如止水防守
                game.jingruzhishuiStrategy = {reason: 'defense', data: playerThree};
                game.jingruzhishuiActive = true;
                game.jingruzhishuiCount = 2;
                jingruzhishuiSkill.currentCooldown = jingruzhishuiSkill.cooldown;

                showMessage(`${game.enemyName}使用了静如止水！堵住你的威胁`, 'warning');
                AudioManager.playSound('jingruzhishui');
                game.hasActedThisTurn = true;
                drawBoard();
                updateUI();

                setTimeout(() => {
                    this.makeMove();
                }, 800);
                return;
            }
        }

        // ===== 其他常规逻辑：随机使用技能 =====
        if (this.shouldUseSkill()) {
            const result = this.tryUseSkill();
            if (result) {
                game.hasActedThisTurn = true;
                drawBoard();
                updateUI();

                // 如果使用了静如止水，继续落子
                if (game.jingruzhishuiActive) {
                    setTimeout(() => {
                        this.makeMove();
                    }, 800);
                } else {
                    // 其他技能，切换回合
                    game.nextTurn();
                    updateUI();
                }
                return;
            }
        }

        // ===== 正常落子 =====
        const move = this.findBestMove();
        if (move) {
            game.hasActedThisTurn = true;
            game.placePiece(move.row, move.col, game.currentPlayer);
            if (game.checkWin(move.row, move.col, game.currentPlayer)) {
                game.gameOver = true;
                game.winner = game.currentPlayer;
                endGame();
            } else {
                game.nextTurn();
                updateUI();
            }
        }
    }
}

// ========== 全局变量 ==========
let game = new GameState();
let canvas, ctx;
let ai = null;
let skillTargetSelection = {
    active: false,
    skill: null,
    targets: [],
    maxTargets: 1,
    targetType: null
};

// ========== 初始化 ==========
window.onload = function() {
    canvas = document.getElementById('board');
    ctx = canvas.getContext('2d');

    // 初始化音频管理器
    AudioManager.init();

    // 设置事件监听
    setupEventListeners();

    // 显示选择界面
    showEnemySelection();
};

function setupEventListeners() {
    // 敌人选择
    document.querySelectorAll('.enemy-card .select-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const card = e.target.closest('.enemy-card');
            const enemy = card.dataset.enemy;
            startGame(enemy);
        });
    });

    // 棋盘点击
    canvas.addEventListener('click', handleBoardClick);

    // 返回按钮
    document.getElementById('backBtn').addEventListener('click', () => {
        showEnemySelection();
    });

    // 游戏结束按钮
    document.getElementById('restartBtn').addEventListener('click', () => {
        startGame(game.selectedEnemy);
    });

    document.getElementById('backToSelectBtn').addEventListener('click', () => {
        showEnemySelection();
    });

    // 取消技能
    document.getElementById('cancelSkillBtn').addEventListener('click', () => {
        cancelSkill();
    });
}

function showEnemySelection() {
    document.getElementById('enemySelection').style.display = 'block';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';

    // 停止背景音乐
    AudioManager.stopBGM();
}

function showGameScreen() {
    document.getElementById('enemySelection').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    document.getElementById('gameOverScreen').style.display = 'none';
}

function startGame(enemy) {
    game.reset();
    game.selectedEnemy = enemy;

    // 设置AI
    const enemyConfig = {
        ziqi: { difficulty: 'easy', name: '子棋' },
        jinengwu: { difficulty: 'hard', name: '技能五' },
        wangjinbao: { difficulty: 'hard', name: '王金宝' }
    };

    const config = enemyConfig[enemy];
    game.enemyName = config.name; // 设置敌人名字
    ai = new AI(config.difficulty, enemy);

        // 如果选择王金宝，播放特殊音效和BGM
        if (enemy === 'wangjinbao') {
            AudioManager.playSound('wangjinbao');
            // 播放王金宝专属BGM
            AudioManager.playBGM('final');
            // 显示特殊警告
            setTimeout(() => {
                showMessage('⚔️ THE FINAL CHALLENGE AWAITS ⚔️ - Souls-like Difficulty - Prepare for Near-Perfect Strategy', 'warning');
            }, 100);
        } else {
            // 播放普通背景音乐
            AudioManager.playBGM('normal');
        }

    // 设置技能
    setupSkills();

    // 更新UI
    document.getElementById('enemyName').textContent = config.name;

    showGameScreen();
    drawBoard();
    updateUI();
}

function setupSkills() {
    // 玩家技能
    game.playerSkills = CHARACTER_SKILLS.zhangcheng.map(skillId => {
        const skillDef = SKILLS[skillId];
        return createSkill(skillId, skillDef, PLAYER_BLACK);
    });

    // 敌人技能
    const enemySkillIds = CHARACTER_SKILLS[game.selectedEnemy];
    game.enemySkills = enemySkillIds.map(skillId => {
        const skillDef = SKILLS[skillId];
        return createSkill(skillId, skillDef, PLAYER_WHITE);
    });

    // 渲染技能按钮
    renderSkills();
}

function createSkill(id, skillDef, player) {
    const skill = {
        id: id,
        name: skillDef.name,
        description: skillDef.description,
        cooldown: skillDef.cooldown,
        currentCooldown: 0,
        player: player,
        canUse: function() {
            return this.currentCooldown === 0 &&
                   !game.gameOver &&
                   game.currentPlayer === this.player &&
                   !game.hasActedThisTurn;
        },
        use: function() {
            if (!this.canUse()) return false;

            const skillImpl = SKILLS[id];

            if (skillImpl.needsTarget) {
                // 需要选择目标
                activateSkillTargetSelection(this);
                return true;
            } else {
                // 不需要目标，直接执行
                return executeSkill(this);
            }
        }
    };

    return skill;
}

function renderSkills() {
    const playerSkillsDiv = document.getElementById('playerSkills');
    const enemySkillsDiv = document.getElementById('enemySkills');

    playerSkillsDiv.innerHTML = '';
    enemySkillsDiv.innerHTML = '';

    game.playerSkills.forEach(skill => {
        const btn = createSkillButton(skill);
        playerSkillsDiv.appendChild(btn);
    });

    game.enemySkills.forEach(skill => {
        const btn = createSkillButton(skill);
        btn.disabled = true; // AI技能按钮禁用
        enemySkillsDiv.appendChild(btn);
    });
}

function createSkillButton(skill) {
    const btn = document.createElement('button');
    btn.className = 'skill-btn';
    btn.innerHTML = `${skill.name}${skill.currentCooldown > 0 ? `<span class="skill-cooldown">(${skill.currentCooldown})</span>` : ''}`;
    btn.title = skill.description;
    btn.disabled = !skill.canUse();

    if (skill.player === PLAYER_BLACK) {
        btn.addEventListener('click', () => {
            if (skill.canUse()) {
                skill.use();
            }
        });
    }

    return btn;
}

function activateSkillTargetSelection(skill) {
    const skillDef = SKILLS[skill.id];
    game.activeSkill = skill;

    skillTargetSelection.active = true;
    skillTargetSelection.skill = skill;
    skillTargetSelection.targets = [];
    skillTargetSelection.targetType = skillDef.targetType;

    // 根据技能类型设置目标数量
    if (skill.id === 'dongshanzhaiqi') {
        skillTargetSelection.maxTargets = 2;
    } else if (skill.id === 'libashanxi') {
        skillTargetSelection.maxTargets = 1;
        skillTargetSelection.selectingArea = true;
    } else {
        skillTargetSelection.maxTargets = 1;
    }

    showMessage(`请选择${skill.name}的目标 - ${getTargetSelectionHint(skill)}`, 'info');
}

function showSkillDialog(skill) {
    const dialog = document.getElementById('skillDialog');
    const title = document.getElementById('skillDialogTitle');
    const message = document.getElementById('skillDialogMessage');

    title.textContent = skill.name;
    message.textContent = skill.description + '\n\n' + getTargetSelectionHint(skill);

    dialog.style.display = 'flex';
}

function hideSkillDialog() {
    document.getElementById('skillDialog').style.display = 'none';
}

function getTargetSelectionHint(skill) {
    const hints = {
        feishazoushi: '请在棋盘上点击要移除的对手棋子',
        libashanxi: '请在棋盘上点击要摔坏的3x3区域的中心位置',
        dongshanzhaiqi: '请依次点击两颗我方棋子',
        diaochenglishan: '请先点击要移动的对手棋子，然后点击目标位置'
    };

    return hints[skill.id] || '请在棋盘上选择目标';
}

function handleBoardClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.round(x / CELL_SIZE) - 1;
    const row = Math.round(y / CELL_SIZE) - 1;

    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;

    // 如果正在选择技能目标
    if (skillTargetSelection.active) {
        handleSkillTargetClick(row, col);
        return;
    }

    // 正常落子
    if (game.currentPlayer === PLAYER_BLACK && !game.gameOver) {
        // 如果不在静如止水效果中，检查是否已行动
        if (!game.jingruzhishuiActive && game.hasActedThisTurn) {
            showMessage('本回合已经行动过了', 'error');
            return;
        }

        if (game.placePiece(row, col, PLAYER_BLACK)) {
            drawBoard();

            if (game.checkWin(row, col, PLAYER_BLACK)) {
                game.gameOver = true;
                game.winner = PLAYER_BLACK;
                endGame();
                return;
            }

            // 如果在静如止水效果中
            if (game.jingruzhishuiActive && game.jingruzhishuiCount > 0) {
                game.jingruzhishuiCount--;

                if (game.jingruzhishuiCount === 0) {
                    // 静如止水效果结束，切换回合
                    game.jingruzhishuiActive = false;
                    game.hasActedThisTurn = false;
                    game.nextTurn();
                    updateUI();

                    // AI回合
                    if (game.currentPlayer === PLAYER_WHITE && !game.gameOver) {
                        setTimeout(() => {
                            ai.makeMove();
                            drawBoard();
                        }, 500);
                    }
                } else {
                    // 还可以继续落子
                    showMessage(`静如止水效果中，还可以落子${game.jingruzhishuiCount}次`, 'info');
                    updateUI();
                }
            } else {
                // 正常落子，切换回合
                game.hasActedThisTurn = true;
                game.nextTurn();
                updateUI();

                // AI回合
                if (game.currentPlayer === PLAYER_WHITE && !game.gameOver) {
                    setTimeout(() => {
                        ai.makeMove();
                        drawBoard();
                    }, 500);
                }
            }
        } else {
            showMessage('无法在此位置落子', 'error');
        }
    }
}

function handleSkillTargetClick(row, col) {
    const skill = skillTargetSelection.skill;
    const skillDef = SKILLS[skill.id];

    if (skill.id === 'feishazoushi') {
        // 飞沙走石：移除对手棋子
        if (game.board[row][col] === PLAYER_WHITE) {
            skillTargetSelection.targets = [{row, col}];
            executeSkill(skill);
        } else {
            showMessage('请选择对手的棋子', 'error');
        }
    } else if (skill.id === 'libashanxi') {
        // 力拔山兮：选择3x3区域的中心
        if (row >= 1 && row <= BOARD_SIZE - 2 && col >= 1 && col <= BOARD_SIZE - 2) {
            skillTargetSelection.targets = [{row, col}];
            executeSkill(skill);
        } else {
            showMessage('选择的区域超出棋盘范围（需要至少1格边距）', 'error');
        }
    } else if (skill.id === 'dongshanzhaiqi') {
        // 东山再起：选择两颗我方棋子
        if (game.board[row][col] === PLAYER_BLACK) {
            if (!skillTargetSelection.targets.some(t => t.row === row && t.col === col)) {
                skillTargetSelection.targets.push({row, col});

                if (skillTargetSelection.targets.length === 2) {
                    executeSkill(skill);
                } else {
                    showMessage('已选择1颗棋子，请再选择1颗', 'info');
                    drawBoard();
                    highlightSelectedPieces();
                }
            }
        } else {
            showMessage('请选择我方的棋子', 'error');
        }
    } else if (skill.id === 'diaochenglishan') {
        // 调呈离山：先选择对手棋子，再选择目标位置
        if (skillTargetSelection.targets.length === 0) {
            if (game.board[row][col] === PLAYER_WHITE) {
                skillTargetSelection.targets.push({row, col});
                showMessage('请选择目标位置', 'info');
                drawBoard();
                highlightSelectedPieces();
            } else {
                showMessage('请选择对手的棋子', 'error');
            }
        } else {
            if (game.isValidMove(row, col)) {
                skillTargetSelection.targets.push({row, col});
                executeSkill(skill);
            } else {
                showMessage('无法移动到此位置', 'error');
            }
        }
    }
}

function highlightSelectedPieces() {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;

    skillTargetSelection.targets.forEach(target => {
        const x = (target.col + 1) * CELL_SIZE;
        const y = (target.row + 1) * CELL_SIZE;
        ctx.beginPath();
        ctx.arc(x, y, PIECE_RADIUS + 5, 0, Math.PI * 2);
        ctx.stroke();
    });
}

function executeSkill(skill) {
    const targets = skillTargetSelection.targets;
    let success = false;
    let shouldSwitchTurn = true; // 默认切换回合

    if (skill.id === 'feishazoushi') {
        // 飞沙走石
        const target = targets[0];
        game.board[target.row][target.col] = 0;
        game.blockedCells.push({row: target.row, col: target.col, turns: 2}); // 禁止2回合
        showMessage(`使用${skill.name}！移除了对手的棋子`, 'success');
        AudioManager.playSound('feishazoushi');
        success = true;
    } else if (skill.id === 'jingruzhishui') {
        // 静如止水 - 激活连续行动
        game.jingruzhishuiActive = true;
        game.jingruzhishuiCount = 2;
        showMessage(`使用${skill.name}！对手被冻结，你可以连下两回合`, 'success');
        AudioManager.playSound('jingruzhishui');
        success = true;
        shouldSwitchTurn = false; // 不切换回合
    } else if (skill.id === 'libashanxi') {
        // 力拔山兮：以选中位置为中心的3x3区域
        const target = targets[0];
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const r = target.row + i;
                const c = target.col + j;
                if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
                    game.brokenCells.add(`${r},${c}`);
                    game.board[r][c] = 0;
                }
            }
        }
        showMessage(`使用${skill.name}！摔坏了一片区域`, 'success');
        AudioManager.playSound('libashanxi');
        success = true;
    } else if (skill.id === 'dongshanzhaiqi') {
        // 东山再起
        if (game.brokenCells.size === 0) {
            showMessage('当前没有被摔坏的区域', 'error');
            cancelSkill();
            return false;
        }
        game.brokenCells.clear();
        targets.forEach(target => {
            game.board[target.row][target.col] = 0;
        });
        showMessage(`使用${skill.name}！恢复了所有摔坏的区域`, 'success');
        AudioManager.playSound('dongshanzaiqi');
        success = true;
    } else if (skill.id === 'diaochenglishan') {
        // 调呈离山
        const from = targets[0];
        const to = targets[1];
        game.board[to.row][to.col] = game.board[from.row][from.col];
        game.board[from.row][from.col] = 0;
        game.blockedCells.push({row: from.row, col: from.col, turns: 2}); // 禁止2回合
        showMessage(`使用${skill.name}！移动了对手的棋子`, 'success');
        AudioManager.playSound('diaochenglishan');
        success = true;
    }

    if (success) {
        skill.currentCooldown = skill.cooldown;
        cancelSkill();

        // 如果是静如止水，重置行动标记，允许玩家落子
        if (!shouldSwitchTurn && skill.id === 'jingruzhishui') {
            game.hasActedThisTurn = false;
            drawBoard();
            updateUI();
            return true;
        }

        game.hasActedThisTurn = true;

        // 如果需要切换回合，执行nextTurn
        if (shouldSwitchTurn) {
            game.nextTurn();
        }

        drawBoard();
        updateUI();

        // 如果当前是AI回合，让AI行动
        if (game.currentPlayer === PLAYER_WHITE && !game.gameOver) {
            setTimeout(() => {
                ai.makeMove();
                drawBoard();
            }, 800);
        }
    }

    return success;
}

function cancelSkill() {
    skillTargetSelection.active = false;
    skillTargetSelection.skill = null;
    skillTargetSelection.targets = [];
    game.activeSkill = null;
    hideSkillDialog();
    showMessage('', 'info');
    drawBoard();
}

function drawBoard() {
    // 清空画布
    ctx.fillStyle = '#dcb35c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制网格
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;

    for (let i = 0; i < BOARD_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(CELL_SIZE, (i + 1) * CELL_SIZE);
        ctx.lineTo(BOARD_SIZE * CELL_SIZE, (i + 1) * CELL_SIZE);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo((i + 1) * CELL_SIZE, CELL_SIZE);
        ctx.lineTo((i + 1) * CELL_SIZE, BOARD_SIZE * CELL_SIZE);
        ctx.stroke();
    }

    // 绘制天元等标记点
    const starPoints = [
        [3, 3], [3, 11], [7, 7], [11, 3], [11, 11]
    ];
    ctx.fillStyle = '#000';
    starPoints.forEach(([row, col]) => {
        ctx.beginPath();
        ctx.arc((col + 1) * CELL_SIZE, (row + 1) * CELL_SIZE, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // 绘制棋子
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const piece = game.board[row][col];
            if (piece !== 0) {
                const x = (col + 1) * CELL_SIZE;
                const y = (row + 1) * CELL_SIZE;

                ctx.beginPath();
                ctx.arc(x, y, PIECE_RADIUS, 0, Math.PI * 2);

                if (piece === PLAYER_BLACK) {
                    const gradient = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, PIECE_RADIUS);
                    gradient.addColorStop(0, '#4a4a4a');
                    gradient.addColorStop(1, '#000');
                    ctx.fillStyle = gradient;
                } else {
                    const gradient = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, PIECE_RADIUS);
                    gradient.addColorStop(0, '#fff');
                    gradient.addColorStop(1, '#d0d0d0');
                    ctx.fillStyle = gradient;
                }

                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    // 绘制摔坏的区域
    ctx.fillStyle = 'rgba(139, 69, 19, 0.5)';
    game.brokenCells.forEach(cellKey => {
        const [row, col] = cellKey.split(',').map(Number);
        const x = (col + 1) * CELL_SIZE;
        const y = (row + 1) * CELL_SIZE;

        ctx.fillRect(x - CELL_SIZE/2, y - CELL_SIZE/2, CELL_SIZE, CELL_SIZE);

        // 绘制X标记
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - CELL_SIZE/3, y - CELL_SIZE/3);
        ctx.lineTo(x + CELL_SIZE/3, y + CELL_SIZE/3);
        ctx.moveTo(x + CELL_SIZE/3, y - CELL_SIZE/3);
        ctx.lineTo(x - CELL_SIZE/3, y + CELL_SIZE/3);
        ctx.stroke();
    });

    // 绘制被禁止的格子
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    game.blockedCells.forEach(blocked => {
        const x = (blocked.col + 1) * CELL_SIZE;
        const y = (blocked.row + 1) * CELL_SIZE;
        ctx.fillRect(x - CELL_SIZE/2, y - CELL_SIZE/2, CELL_SIZE, CELL_SIZE);
    });

    // 如果正在选择技能目标，高亮显示已选择的棋子
    if (skillTargetSelection.active && skillTargetSelection.targets.length > 0) {
        highlightSelectedPieces();
    }
}

function updateUI() {
    // 更新回合指示
    const turnIndicator = document.getElementById('turnIndicator');
    if (game.currentPlayer === PLAYER_BLACK) {
        turnIndicator.textContent = '⚔️ 你的回合 ⚔️';
        turnIndicator.style.background = 'linear-gradient(135deg, rgba(139, 0, 0, 0.8) 0%, rgba(40, 20, 20, 0.9) 100%)';
    } else {
        turnIndicator.textContent = '☠️ AI的回合 ☠️';
        turnIndicator.style.background = 'linear-gradient(135deg, rgba(40, 10, 10, 0.9) 0%, rgba(139, 0, 0, 0.8) 100%)';
    }

    // 更新技能按钮
    renderSkills();
}

function showMessage(text, type = 'info') {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
}

function endGame() {
    const gameOverScreen = document.getElementById('gameOverScreen');
    const gameOverTitle = document.getElementById('gameOverTitle');
    const gameOverMessage = document.getElementById('gameOverMessage');

    if (game.winner === PLAYER_BLACK) {
        gameOverTitle.textContent = '⚔️ VICTORY ⚔️';
        gameOverMessage.textContent = 'You have proven your worth! The ancient challenge has been conquered.';
    } else {
        if (game.selectedEnemy === 'wangjinbao') {
            gameOverTitle.textContent = '☠️ DEFEATED ☠️';
            gameOverMessage.textContent = 'The Legendary Wang Jinbao has proven superior. Return when you are worthy...';
        } else {
            gameOverTitle.textContent = '☠️ DEFEATED ☠️';
            const enemyNames = {
                ziqi: '子棋',
                jinengwu: '技能五',
                wangjinbao: '王金宝'
            };
            gameOverMessage.textContent = `${enemyNames[game.selectedEnemy]} defeated you. Train harder and return!`;
        }
    }

    gameOverScreen.style.display = 'flex';
}
