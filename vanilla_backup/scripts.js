const CONFIG = {
    MAX_ODD: 840,
    // DO NOT MODIFY: User defined values (Verified on 2026-01-20)
    TICKET_LIMITS: {
        CONQ: 21,
        TRANS: 14,
        NIGHTMARE: 14,
        SHUGO: 14,
        DIMENSION: 7,
        DUNGEON: 7,
        EXPLORATION: 7
    },
    // DO NOT MODIFY: User defined values (Verified on 2026-01-20)
    TICKET_RECHARGE: {
        CONQ: 1,
        TRANS: 1,
        NIGHTMARE: 2,
        SHUGO: 2,
        DIMENSION: 1,
        EXPLORATION: 0
    },
    RESET_HOUR_DAILY: 5,
    RESET_HOUR_WEEKLY: 5,
    WeeklyResetDay: 3, // Wednesday (0=Sun, 3=Wed)
    EVENTS: [
        {
            id: 'shugo',
            name: '슈고페스타',
            ticketKey: 'ticket_shugo',
            alertMins: [15, 45],
            alertDuration: 150, // 2m 30s
            checkMins: [20, 50],
            checkDuration: 180 // 3m
        },
        {
            id: 'dimension',
            name: '차원침공',
            ticketKey: 'ticket_dimension',
            alertMins: [0],
            alertDuration: 150, // 2m 30s
            checkMins: [5],
            checkDuration: 60 // 1m
        }
    ],
    CLASS_ICONS: {
        '검성': '🗡️', '수호성': '🛡️', '살성': '⚔️', '궁성': '🏹',
        '마도성': '🪄', '정령성': '✨', '치유성': '❤️', '호법성': '🦯',
        '직업선택': '👤'
    }
};

// Event State Tracker
const eventState = {};
// Structure: { 'shugo_alert_14_15': true, 'shugo_check_14_20': true }
// We clear old keys periodically or just let them grow (minimal memory)
// Better: reset hourly? No need, just key by day+hour+min to be safe, or just hour+min is enough for 24h.
function getEventStateKey(eventId, type, date) {
    return `${eventId}_${type}_${date.getDate()}_${date.getHours()}_${date.getMinutes()}`; // unique per specific window
}

const STORAGE_KEY = 'AION2_TODO_PERSISTENT_V21';
const MEMBERSHIP_KEY = 'AION2_MEMBERSHIP_V1';
const MEMBERSHIP_DATE_KEY = 'AION2_MEMBERSHIP_DATE_V1';
const SHUGO_NOTIFY_KEY = 'AION2_SHUGO_NOTIFY_V1';
const DIM_NOTIFY_KEY = 'AION2_DIM_NOTIFY_V1';
let characters = [];
let isMembership = false;
let membershipDate = "";
let isShugoNotify = true;
let isDimensionNotify = true;
let dragSrcIndex = null;
let pendingTicket = null;
let editingTicket = null;
let editingOddItem = null;
let highlightTimer = null;
let highlightIdx = null;
let isDraggingInModal = false;
let appTimerInterval = null;

window.onload = () => {
    let savedData = localStorage.getItem(STORAGE_KEY);

    // Backup/Migration: Check if V21 is empty but V20 has data
    if (!savedData) {
        const oldData = localStorage.getItem('AION2_TODO_PERSISTENT_V20');
        if (oldData) {
            savedData = oldData;
            console.log("Migrated data from V20 to V21");
        }
    }

    try {
        characters = savedData ? JSON.parse(savedData) : [createNewChar("캐릭터 1")];
    } catch (e) {
        console.error("Failed to parse data:", e);
        characters = [createNewChar("캐릭터 1")];
    }

    // Load Membership
    isMembership = localStorage.getItem(MEMBERSHIP_KEY) === 'true';
    membershipDate = localStorage.getItem(MEMBERSHIP_DATE_KEY) || "";
    isShugoNotify = localStorage.getItem(SHUGO_NOTIFY_KEY) !== 'false';
    isDimensionNotify = localStorage.getItem(DIM_NOTIFY_KEY) !== 'false';

    const membershipToggle = document.getElementById('membershipToggle');
    if (membershipToggle) membershipToggle.checked = isMembership;

    const sToggle = document.getElementById('shugoNotifyToggle');
    if (sToggle) sToggle.checked = isShugoNotify;
    const dToggle = document.getElementById('dimensionNotifyToggle');
    if (dToggle) dToggle.checked = isDimensionNotify;

    updateMembershipDisplay();

    const now = Date.now();

    // Data Migration & Cleanup
    characters.forEach(c => {
        if (!c.odd_ts) c.odd_ts = now;
        // Ensure Odd Energy is non-negative
        if ((c.odd_energy || 0) < 0) c.odd_energy = 0;

        // Migrate Ticket Overfill to Extra
        const tickets = ['conq', 'trans', 'ticket_nightmare', 'ticket_shugo', 'ticket_dimension'];
        const maxMap = {
            conq: CONFIG.TICKET_LIMITS.CONQ, trans: CONFIG.TICKET_LIMITS.TRANS,
            ticket_nightmare: CONFIG.TICKET_LIMITS.NIGHTMARE,
            ticket_shugo: CONFIG.TICKET_LIMITS.SHUGO, ticket_dimension: CONFIG.TICKET_LIMITS.DIMENSION
        };

        tickets.forEach(key => {
            const max = maxMap[key];
            let val = c[key] || 0;
            let extra = c[key + '_extra'] || 0;

            if (val > max) {
                extra += (val - max);
                c[key] = max;
                c[key + '_extra'] = extra;
            }
        });

        // Init Class if missing
        if (!c.char_class) c.char_class = '직업선택';
        if (c.odd_energy_extra === undefined) c.odd_energy_extra = 0;
        if (!c.hidden_keys) c.hidden_keys = [];
        if (!c.custom_quests) c.custom_quests = [];
        if (!c.extra_daily) c.extra_daily = Array.from({ length: 4 }, () => ({ name: '', val: false }));
        if (!c.extra_weekly) c.extra_weekly = Array.from({ length: 1 }, () => ({ name: '', val: false }));
        if (c.ticket_exploration === undefined) c.ticket_exploration = 0;
        if (c.abyss_lower === undefined) c.abyss_lower = false;
        if (c.abyss_middle === undefined) c.abyss_middle = false;
    });

    render();
    startTimers();
    setupModalDragTracking();
};

function setupModalDragTracking() {
    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('.modal-menu')) {
            isDraggingInModal = true;
        }
    });
    document.addEventListener('mouseup', () => {
        // Delay resetting the flag to allow click event to check it first
        setTimeout(() => {
            isDraggingInModal = false;
        }, 100);
    });
}

function handleModalOverlayClick(e, modalId) {
    if (isDraggingInModal) {
        isDraggingInModal = false;
        return;
    }
    closeModal(modalId);
}

function createNewChar(name) {
    return {
        name: name,
        char_class: '직업선택',
        odd_energy: 0,
        odd_energy_extra: 0,
        odd_ts: Date.now(),
        daily_sq: false, daily_kina: false, daily_abyss_supply: false,
        dungeon: CONFIG.TICKET_LIMITS.DUNGEON,
        weekly_ak: false, weekly_tb: false, weekly_directive: false,
        weekly_abyss_directive: false, weekly_abyss_supply: false,
        weekly_battlefield: 0,
        weekly_odd_buy: false, weekly_odd_craft: false,
        trans: CONFIG.TICKET_LIMITS.TRANS, trans_extra: 0,
        conq: CONFIG.TICKET_LIMITS.CONQ, conq_extra: 0,
        ticket_nightmare: CONFIG.TICKET_LIMITS.NIGHTMARE, ticket_nightmare_extra: 0,
        ticket_shugo: CONFIG.TICKET_LIMITS.SHUGO, ticket_shugo_extra: 0,
        ticket_dimension: CONFIG.TICKET_LIMITS.DIMENSION, ticket_dimension_extra: 0,
        ticket_exploration: 0,
        abyss_lower: false,
        abyss_middle: false,
        hidden_keys: [],
        custom_quests: [],
        extra_daily: Array.from({ length: 4 }, () => ({ name: '', val: false })),
        extra_weekly: Array.from({ length: 1 }, () => ({ name: '', val: false }))
    };
}

function startTimers() {
    if (appTimerInterval) clearInterval(appTimerInterval);
    const update = () => {
        const now = new Date();
        const dailyTimer = document.getElementById('dailyTimer');
        const mondayTimer = document.getElementById('mondayTimer');
        const wednesdayTimer = document.getElementById('wednesdayTimer');

        if (dailyTimer) {
            dailyTimer.innerText = getDailyRemaining(now);
            if (shouldShowDailyWarning()) dailyTimer.parentElement.classList.add('time-warning');
            else dailyTimer.parentElement.classList.remove('time-warning');
        }
        if (wednesdayTimer) {
            wednesdayTimer.innerText = getWeeklyRemaining(now, 3);
            if (shouldShowWeeklyWarning(3)) wednesdayTimer.parentElement.classList.add('time-warning');
            else wednesdayTimer.parentElement.classList.remove('time-warning');
        }
        processAutoLogic(now.getTime());
        checkEventTimers(now);
    };
    update();
    appTimerInterval = setInterval(update, 1000);
}

function processAutoLogic(now) {
    let changed = false;
    const ONE_DAY = 86400000;
    const EIGHT_HOURS = 28800000;
    const OFFSET_5H = 18000000;

    const tzOffset = new Date().getTimezoneOffset() * 60000;
    const localNow = now - tzOffset;

    characters.forEach(char => {
        if (!char.last_ts) char.last_ts = char.odd_ts || now;
        const localLast = char.last_ts - tzOffset;

        // 1. Odd Energy
        const THREE_HOURS = 10800000;
        const currOddBlock = Math.floor((localNow - OFFSET_5H) / THREE_HOURS);
        const lastOddBlock = Math.floor((localLast - OFFSET_5H) / THREE_HOURS);
        if (currOddBlock > lastOddBlock) {
            const ticks = currOddBlock - lastOddBlock;
            const rate = isMembership ? 15 : 10;
            const current = char.odd_energy || 0;
            if (current < CONFIG.MAX_ODD) {
                char.odd_energy = Math.min(CONFIG.MAX_ODD, current + (ticks * rate));
                changed = true;
            }
        }

        // 2. Ticket Regen
        const curr8hBlock = Math.floor((localNow - OFFSET_5H) / EIGHT_HOURS);
        const last8hBlock = Math.floor((localLast - OFFSET_5H) / EIGHT_HOURS);
        if (curr8hBlock > last8hBlock) {
            const ticks = curr8hBlock - last8hBlock;
            if ((char.conq || 0) < CONFIG.TICKET_LIMITS.CONQ) {
                char.conq = Math.min(CONFIG.TICKET_LIMITS.CONQ, (char.conq || 0) + ticks);
                changed = true;
            }
            if ((char.trans || 0) < CONFIG.TICKET_LIMITS.TRANS) {
                char.trans = Math.min(CONFIG.TICKET_LIMITS.TRANS, (char.trans || 0) + ticks);
                changed = true;
            }
        }

        // 3. Daily Reset
        const currDay = Math.floor((localNow - OFFSET_5H) / ONE_DAY);
        const lastDay = Math.floor((localLast - OFFSET_5H) / ONE_DAY);
        if (currDay > lastDay) {
            const dayTicks = currDay - lastDay;
            char.daily_sq = false;
            char.daily_kina = false;
            char.daily_abyss_supply = false;
            if ((char.ticket_nightmare || 0) < CONFIG.TICKET_LIMITS.NIGHTMARE)
                char.ticket_nightmare = Math.min(CONFIG.TICKET_LIMITS.NIGHTMARE, (char.ticket_nightmare || 0) + (CONFIG.TICKET_RECHARGE.NIGHTMARE * dayTicks));
            if ((char.ticket_shugo || 0) < CONFIG.TICKET_LIMITS.SHUGO)
                char.ticket_shugo = Math.min(CONFIG.TICKET_LIMITS.SHUGO, (char.ticket_shugo || 0) + (CONFIG.TICKET_RECHARGE.SHUGO * dayTicks));
            if ((char.ticket_dimension || 0) < CONFIG.TICKET_LIMITS.DIMENSION)
                char.ticket_dimension = Math.min(CONFIG.TICKET_LIMITS.DIMENSION, (char.ticket_dimension || 0) + (CONFIG.TICKET_RECHARGE.DIMENSION * dayTicks));
            char.custom_quests.forEach(q => { if (q.type === 'daily') q.val = false; });
            changed = true;
        }

        // 4. Weekly Reset
        const dNow = new Date(now);
        const dLast = new Date(char.last_ts);

        if (checkWeeklyCross(dLast, dNow, CONFIG.WeeklyResetDay, CONFIG.RESET_HOUR_WEEKLY)) {
            char.weekly_odd_buy = false;
            char.dungeon = CONFIG.TICKET_LIMITS.DUNGEON;
            char.ticket_exploration = 0;
            char.weekly_directive = false;
            char.weekly_abyss_directive = false;
            char.weekly_abyss_supply = false;
            char.weekly_battlefield = 0;
            char.weekly_ak = false;
            char.weekly_tb = false;
            char.weekly_odd_craft = false;
            char.custom_quests.forEach(q => { if (q.type === 'weekly') q.val = false; });
            char.extra_weekly.forEach(q => q.val = false);
            changed = true;
        }

        if (checkArtifactReset(new Date(char.last_ts), new Date(now))) {
            char.abyss_lower = false;
            char.abyss_middle = false;
            changed = true;
        }

        char.last_ts = now;
    });

    // 5. Membership Auto Expiration check (Once per logic loop)
    if (isMembership && membershipDate) {
        const startDate = new Date(membershipDate);
        startDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffTime = today - startDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 28) {
            isMembership = false;
            membershipDate = "";
            localStorage.setItem(MEMBERSHIP_KEY, 'false');
            localStorage.removeItem(MEMBERSHIP_DATE_KEY);
            const mToggle = document.getElementById('membershipToggle');
            if (mToggle) mToggle.checked = false;
            updateMembershipDisplay();
            changed = true;
        }
    }

    if (changed) { saveToDisk(); render(); }
}

function checkWeeklyCross(dLast, dNow, targetDay, targetHour) {
    let nextTarget = new Date(dLast);
    nextTarget.setHours(targetHour, 0, 0, 0);
    let daysUntil = (targetDay - nextTarget.getDay() + 7) % 7;
    if (daysUntil === 0 && dLast.getHours() >= targetHour) {
        daysUntil = 7;
    }
    nextTarget.setDate(nextTarget.getDate() + daysUntil);
    return nextTarget.getTime() <= dNow.getTime();
}

function checkArtifactReset(dLast, dNow) {
    // Reset Days: Tue(2), Thu(4), Sat(6)
    // Reset Hour: 21
    const resetDays = [2, 4, 6];
    const resetHour = 21;

    // We check if we crossed any Reset Point between dLast and dNow
    // Simple approach: Check every hour step or just check strict boundaries?
    // Robust approach: Iterate forward from dLast to dNow ensuring we catch the specific time.
    // Optimization: Since max gap is usually small, we can just check if we passed a specific point.

    // Create a pointer starting from the next potential reset time after dLast
    let pointer = new Date(dLast);
    // If dLast is already past 21:00, move to next day 00:00 as start basis? 
    // Easier: Just look for the immediate next 21:00 occurrence after dLast.

    // Find the next occurrence of 21:00
    pointer.setHours(resetHour, 0, 0, 0);
    if (pointer <= dLast) {
        pointer.setDate(pointer.getDate() + 1);
    }

    // Loop until pointer exceeds dNow
    while (pointer <= dNow) {
        if (resetDays.includes(pointer.getDay())) {
            return true; // Found a matching trigger
        }
        pointer.setDate(pointer.getDate() + 1);
    }

    return false;
}

function toggleMembership() {
    isMembership = document.getElementById('membershipToggle').checked;
    if (isMembership) {
        openMembershipModal();
    } else {
        membershipDate = "";
        localStorage.removeItem(MEMBERSHIP_DATE_KEY);
        localStorage.setItem(MEMBERSHIP_KEY, 'false');
        updateMembershipDisplay();
        render();
    }
}

function updateMembershipDisplay() {
    const display = document.getElementById('membershipDateDisplay');
    if (!display) return;

    if (isMembership && membershipDate) {
        display.innerText = `(${membershipDate})`;
        display.style.display = 'inline';

        // Red check: 27th day
        const startDate = new Date(membershipDate);
        startDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 27) {
            display.classList.add('membership-expiring');
        } else {
            display.classList.remove('membership-expiring');
        }
    } else {
        display.innerText = '';
        display.style.display = 'none';
    }
}

function openMembershipModal(isEdit = false) {
    const modal = document.getElementById('membership-date-overlay');
    const input = document.getElementById('membership-date-input');
    if (!modal || !input) return;

    // Limits: Max today, min today - 27 days
    const today = new Date();
    const minDate = new Date();
    minDate.setDate(today.getDate() - 27);

    const formatDate = (d) => d.toISOString().split('T')[0];
    input.max = formatDate(today);
    input.min = formatDate(minDate);

    if (isEdit && membershipDate) {
        input.value = membershipDate;
    } else {
        input.value = formatDate(today);
    }

    modal.classList.add('show');
}

function closeMembershipModal() {
    // If cancelling an initial activation, uncheck the toggle
    if (!membershipDate) {
        isMembership = false;
        const mToggle = document.getElementById('membershipToggle');
        if (mToggle) mToggle.checked = false;
        localStorage.setItem(MEMBERSHIP_KEY, 'false');
    }
    closeModal('membership-date-overlay');
}

function saveMembershipDate() {
    const input = document.getElementById('membership-date-input');
    if (!input.value) return;

    membershipDate = input.value;
    isMembership = true;
    localStorage.setItem(MEMBERSHIP_KEY, 'true');
    localStorage.setItem(MEMBERSHIP_DATE_KEY, membershipDate);

    // Ensure checkbox is checked
    const mToggle = document.getElementById('membershipToggle');
    if (mToggle) mToggle.checked = true;

    updateMembershipDisplay();
    closeModal('membership-date-overlay');
    render();
}

function openNotificationSettings() {
    const modal = document.getElementById('notification-settings-overlay');
    if (modal) modal.classList.add('show');
}

function toggleShugoNotify() {
    isShugoNotify = document.getElementById('shugoNotifyToggle').checked;
    localStorage.setItem(SHUGO_NOTIFY_KEY, isShugoNotify);
}

function toggleDimensionNotify() {
    isDimensionNotify = document.getElementById('dimensionNotifyToggle').checked;
    localStorage.setItem(DIM_NOTIFY_KEY, isDimensionNotify);
}

function getDailyRemaining(now) {
    let target = new Date(now); target.setHours(5, 0, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    return formatTimeDiff(target - now, false);
}

function getWeeklyRemaining(now, targetDay) {
    let target = new Date(now);
    let daysUntil = (targetDay - now.getDay() + 7) % 7;
    if (daysUntil === 0 && now.getHours() >= 5) daysUntil = 7;
    else if (daysUntil === 0 && now.getHours() < 5) daysUntil = 0;
    target.setDate(now.getDate() + daysUntil); target.setHours(5, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 7);
    return formatTimeDiff(target - now, true);
}

function formatTimeDiff(ms, showDays) {
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const hms = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return showDays && d > 0 ? `${d}일 ${hms}` : hms;
}

function getTimeUntilDailyReset() {
    const now = new Date();
    let target = new Date(now);
    target.setHours(5, 0, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    return target - now;
}

function getTimeUntilWeeklyReset(targetDay) {
    const now = new Date();
    let target = new Date(now);
    let daysUntil = (targetDay - now.getDay() + 7) % 7;
    if (daysUntil === 0 && now.getHours() >= 5) daysUntil = 7;
    else if (daysUntil === 0 && now.getHours() < 5) daysUntil = 0;
    target.setDate(now.getDate() + daysUntil);
    target.setHours(5, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 7);
    return target - now;
}

function shouldShowDailyWarning() {
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    return getTimeUntilDailyReset() < SIX_HOURS;
}

function shouldShowWeeklyWarning(targetDay) {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    return getTimeUntilWeeklyReset(targetDay) < TWENTY_FOUR_HOURS;
}

function saveToDisk() { localStorage.setItem(STORAGE_KEY, JSON.stringify(characters)); }

function render() {
    // GUIDELINE: All user inputs must have onfocus="this.select()" for better UX
    const grid = document.getElementById('characterGrid');
    if (!grid) return;
    grid.innerHTML = '';
    // Use CONFIG.CLASS_ICONS

    characters.forEach((char, idx) => {
        const card = document.createElement('div');
        card.className = 'container';
        if (highlightTimer && highlightIdx === idx) card.classList.add('highlight-card');

        // Drag Over / Drop are on the Container (Target)
        card.ondragover = (e) => dragOver(e, idx);
        card.ondragleave = (e) => dragLeave(e);
        card.ondrop = (e) => drop(e, idx);

        card.innerHTML = `
            ${renderModals(idx, char, CONFIG.CLASS_ICONS)}
            ${renderTitleArea(idx, char, CONFIG.CLASS_ICONS)}
            <div class="grid-header"><div>일일</div><div>주간</div></div>
            ${renderGridContent(idx, char)}
            ${renderArtifactSection(idx, char)}
            ${renderOddSection(idx, char)}
            ${renderTicketSection(idx, char)}
            ${renderFooter(idx)}
        `;
        grid.appendChild(card);
    });
}

function renderModals(idx, char, classIcons) {
    // Helper to generate class buttons
    const classButtons = ['검성', '수호성', '살성', '궁성', '마도성', '정령성', '치유성', '호법성']
        .map(cls => `<div class="class-btn" onclick="setClass(${idx}, '${cls}')">${classIcons[cls]} ${cls}</div>`)
        .join('');

    // Review Settings List Items
    const dailySettings = [
        { key: 'daily_sq', label: '사명 퀘스트' }, { key: 'daily_abyss_supply', label: '어비스 일일 보급' }, { key: 'daily_kina', label: '키나 제한' }
    ].map(item => renderSettingItem(idx, char, item)).join('');

    const weeklySettings = [
        { key: 'weekly_directive', label: '지령서 퀘스트' }, { key: 'weekly_abyss_directive', label: '어비스 지령서' },
        { key: 'weekly_abyss_supply', label: '어비스 주간 보급' }, { key: 'weekly_battlefield', label: '전장' },
        { key: 'weekly_ak', label: '각성전' }, { key: 'weekly_tb', label: '토벌전' },
        { key: 'weekly_odd_buy', label: '오드 구매' }, { key: 'weekly_odd_craft', label: '오드 제작' },
        { key: 'dungeon', label: '일일 던전(주간7회)' }
    ].map(item => renderSettingItem(idx, char, item)).join('');

    const artifactSettings = [
        { key: 'abyss_lower', label: '어비스 하층' }, { key: 'abyss_middle', label: '어비스 중층' }
    ].map(item => renderSettingItem(idx, char, item)).join('');

    const ticketSettings = [
        { key: 'conq', label: '정복 티켓' }, { key: 'trans', label: '초월 티켓' },
        { key: 'ticket_nightmare', label: '악몽 티켓' }, { key: 'ticket_shugo', label: '슈고페스타 티켓' },
        { key: 'ticket_dimension', label: '차원침공 티켓' }, { key: 'ticket_exploration', label: '탐험 티켓' }
    ].map(item => renderSettingItem(idx, char, item)).join('');

    return `
        <div class="modal-overlay" id="reset-overlay-${idx}" onclick="handleModalOverlayClick(event, 'reset-overlay-${idx}')">
            <div class="modal-menu" onclick="event.stopPropagation()" draggable="false" ondragstart="event.stopPropagation()">
                <div style="text-align:center; margin-bottom:10px; font-weight:bold; color:var(--accent-blue); font-size:12px;">초기화 항목</div>
                <button class="modal-btn" onclick="handleReset(${idx}, 'daily')">일일 리셋</button>
                <button class="modal-btn" onclick="handleReset(${idx}, 'weekly')">주간 리셋</button>
                <button class="modal-btn danger" onclick="handleReset(${idx}, 'all')">전체 리셋</button>
                <button class="modal-btn cancel" onclick="closeModal('reset-overlay-${idx}')">취소</button>
            </div>
        </div>
        <div class="modal-overlay" id="class-overlay-${idx}" onclick="handleModalOverlayClick(event, 'class-overlay-${idx}')">
            <div class="modal-menu" onclick="event.stopPropagation()" draggable="false" ondragstart="event.stopPropagation()" style="width: 240px;">
                <div style="text-align:center; margin-bottom:10px; font-weight:bold; color:var(--accent-blue); font-size:12px;">직업 선택</div>
                <div class="class-grid">${classButtons}</div>
                <button class="modal-btn cancel" onclick="closeModal('class-overlay-${idx}')">취소</button>
            </div>
        </div>
        <div class="modal-overlay" id="rename-overlay-${idx}" onclick="handleModalOverlayClick(event, 'rename-overlay-${idx}')">
            <div class="modal-menu" onclick="event.stopPropagation()" draggable="false" ondragstart="event.stopPropagation()">
                <div style="text-align:center; margin-bottom:10px; font-weight:bold; color:var(--accent-blue); font-size:12px;">캐릭터 이름 변경</div>
                <input type="text" class="modal-input" id="rename-input-${idx}" onfocus="this.select()" onkeypress="if(event.key==='Enter') saveRename(${idx})">
                <button class="modal-btn" onclick="saveRename(${idx})" style="background:var(--accent-blue); color:white; border:none;">확인</button>
                <button class="modal-btn cancel" onclick="closeModal('rename-overlay-${idx}')">취소</button>
            </div>
        </div>
        <div class="modal-overlay" id="odd-overlay-${idx}" onclick="handleModalOverlayClick(event, 'odd-overlay-${idx}')">
            <div class="modal-menu" onclick="event.stopPropagation()" draggable="false" ondragstart="event.stopPropagation()">
                <div style="text-align:center; margin-bottom:10px; font-weight:bold; color:var(--accent-blue); font-size:12px;">오드 에너지 수정</div>
                <div class="odd-form-row">
                    <div class="odd-input-group"><label class="odd-input-label">기본 에너지</label><input type="number" class="modal-input" id="odd-base-${idx}" style="margin:0; width:90%;" placeholder="0" onfocus="this.select()" onkeypress="if(event.key==='Enter') saveOdd(${idx})"></div>
                    <div class="odd-input-group"><label class="odd-input-label">추가 에너지</label><input type="number" class="modal-input" id="odd-extra-${idx}" style="margin:0; width:90%;" placeholder="0" onfocus="this.select()" onkeypress="if(event.key==='Enter') saveOdd(${idx})"></div>
                </div>
                <button class="modal-btn" onclick="saveOdd(${idx})" style="background:var(--accent-blue); color:white; border:none;">확인</button>
                <button class="modal-btn cancel" onclick="closeModal('odd-overlay-${idx}')">취소</button>
            </div>
        </div>
        <div class="modal-overlay" id="insufficient-overlay-${idx}" onclick="handleModalOverlayClick(event, 'insufficient-overlay-${idx}')">
            <div class="modal-menu" onclick="event.stopPropagation()" draggable="false" ondragstart="event.stopPropagation()">
                <div style="text-align:center; margin-bottom:10px; font-weight:bold; color:#ffb74d; font-size:12px;">⚠️ 오드 에너지 부족</div>
                <div class="warn-text">오드 에너지가 부족합니다.<br>현재 오드 에너지를 입력해주세요.</div>
                <input type="number" class="modal-input" id="insufficient-input-${idx}" placeholder="현재 에너지 입력" onfocus="this.select()" onkeypress="if(event.key==='Enter') solveInsufficient(${idx})">
                <button class="modal-btn" onclick="solveInsufficient(${idx})" style="background:var(--accent-blue); color:white; border:none;">확인</button>
                <button class="modal-btn cancel" onclick="closeModal('insufficient-overlay-${idx}')">취소</button>
            </div>
        </div>
        <div class="modal-overlay" id="odd-item-overlay-${idx}" onclick="handleModalOverlayClick(event, 'odd-item-overlay-${idx}')">
            <div class="modal-menu" onclick="event.stopPropagation()" draggable="false" ondragstart="event.stopPropagation()">
                <div id="odd-item-title-${idx}" style="text-align:center; margin-bottom:10px; font-weight:bold; color:var(--accent-blue); font-size:12px;">오드 아이템 사용</div>
                <div style="display:flex; flex-direction:column; align-items:center; gap:15px; margin-bottom:15px;">
                    <div class="odd-input-group" style="width:100%; align-items:center;">
                        <label class="odd-input-label">사용할 아이템 수량</label>
                        <input type="number" class="modal-input" id="odd-item-qty-${idx}" style="margin:0; width:80%; text-align:center; font-size:18px;" placeholder="0" onfocus="this.select()" onkeypress="if(event.key==='Enter') saveOddItem(${idx})">
                    </div>
                    <div id="odd-item-gain-text-${idx}" style="color:var(--accent-green); font-size:16px; font-weight:bold;">획득: +0 에너지</div>
                </div>
                <button class="modal-btn" onclick="saveOddItem(${idx})" style="background:var(--accent-blue); color:white; border:none;">확인</button>
                <button class="modal-btn cancel" onclick="closeModal('odd-item-overlay-${idx}')">취소</button>
            </div>
        </div>
        <div class="modal-overlay" id="ticket-edit-overlay-${idx}" onclick="handleModalOverlayClick(event, 'ticket-edit-overlay-${idx}')">
            <div class="modal-menu" onclick="event.stopPropagation()" draggable="false" ondragstart="event.stopPropagation()">
                <div style="text-align:center; margin-bottom:10px; font-weight:bold; color:var(--accent-blue); font-size:12px;">티켓 수량 직접 수정</div>
                <div class="odd-form-row">
                    <div class="odd-input-group"><label class="odd-input-label">현재 보유량 (최대치 이내)</label><input type="number" class="modal-input" id="ticket-current-${idx}" style="margin:0; width:90%;" placeholder="0" onfocus="this.select()" onkeypress="if(event.key==='Enter') saveTicketEdit(${idx})"></div>
                    <div class="odd-input-group"><label class="odd-input-label">추가 획득량 (초과분)</label><input type="number" class="modal-input" id="ticket-add-${idx}" style="margin:0; width:90%;" placeholder="0" onfocus="this.select()" onkeypress="if(event.key==='Enter') saveTicketEdit(${idx})"></div>
                </div>
                <button class="modal-btn" onclick="saveTicketEdit(${idx})" style="background:var(--accent-blue); color:white; border:none;">확인</button>
                <button class="modal-btn cancel" onclick="closeModal('ticket-edit-overlay-${idx}')">취소</button>
            </div>
        </div>
        <div class="modal-overlay" id="settings-overlay-${idx}" onclick="handleModalOverlayClick(event, 'settings-overlay-${idx}')">
            <div class="modal-menu" onclick="event.stopPropagation()" draggable="false" ondragstart="event.stopPropagation()" style="max-height: 95vh; overflow-y: auto;">
                <div style="text-align:center; margin-bottom:15px; font-weight:bold; color:var(--accent-blue); font-size:14px;">[ "${char.name}" 캐릭터 숙제 설정 ]</div>
                <div class="settings-section">
                    <div class="settings-section-title">숙제 노출 설정</div>
                    <div class="settings-list">
                        <div class="settings-section-divider">일일 항목</div>
                        ${dailySettings}
                        <div class="settings-section-divider">주간 항목</div>
                        ${weeklySettings}
                        <div class="settings-section-divider">티켓 항목</div>
                        ${ticketSettings}
                        <div class="settings-section-divider">아티펙트 회랑</div>
                        ${artifactSettings}
                    </div>
                </div>
                <div class="settings-section">
                    <div class="settings-section-title">커스텀 숙제 관리</div>
                    <div class="settings-list" style="grid-template-columns: 1fr; margin-bottom:10px;">
                        ${char.custom_quests.map((q, qIdx) => `
                            <div class="custom-quest-list-item">
                                <span>${q.name} (${q.type === 'daily' ? '일일' : '주간'})</span>
                                <span class="btn-delete-custom" onclick="deleteCustomQuest(${idx}, ${qIdx})">🗑️</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="custom-quest-form">
                        <div class="custom-quest-row"><input type="text" id="custom-name-${idx}" placeholder="숙제 이름" onfocus="this.select()"><select id="custom-type-${idx}"><option value="daily">일일</option><option value="weekly">주간</option></select></div>
                        <input type="text" id="custom-hint-${idx}" placeholder="힌트 (예: 매일 05시)" style="background:#333; border:1px solid #444; color:#fff; padding:6px; border-radius:4px; font-size:12px;" onfocus="this.select()">
                        <button class="btn-add-custom" onclick="addCustomQuest(${idx})">숙제 추가</button>
                    </div>
                </div>
                <button class="modal-btn" onclick="closeModal('settings-overlay-${idx}')" style="background:var(--accent-blue); color:white; border:none; margin-top:10px;">확인</button>
            </div>
        </div>
    `;
}

function renderSettingItem(idx, char, item) {
    return `<div class="settings-item"><span>${item.label}</span><input type="checkbox" ${char.hidden_keys.includes(item.key) ? '' : 'checked'} onchange="toggleVisibility(${idx}, '${item.key}')"></div>`;
}

function renderTitleArea(idx, char, classIcons) {
    return `
        <div class="title-area" draggable="true" ondragstart="dragStart(event, ${idx})" ondragend="dragEnd(event)">
            <span class="class-badge" onclick="openClassSelector(${idx}, event)">${classIcons[char.char_class || '직업선택']} ${char.char_class || '직업선택'}</span>
            <span class="char-name" onclick="openRename(${idx}, event)" title="이름 변경">${char.name}</span>
            <div class="odd-wrapper" style="flex-direction:column; align-items:flex-end; gap:2px;">
                <div style="font-size:10px; font-weight:normal; color:#aaa; margin-bottom:-2px;">
                    ${char.odd_energy || 0}<span style="color:var(--accent-cyan);">(+${char.odd_energy_extra || 0})</span>
                </div>
                <span class="odd-display" onclick="openOdd(${idx}, event)">💎 ${(char.odd_energy || 0) + (char.odd_energy_extra || 0)}/${CONFIG.MAX_ODD}</span>
                <div style="display:flex; gap:3px;">
                     <button class="btn-tiny" onclick="openOddItemEdit(${idx}, 'small', event)">오드10</button>
                     <button class="btn-tiny" onclick="openOddItemEdit(${idx}, 'large', event)">오드40</button>
                </div>
            </div>
        </div>
    `;
}

function renderGridContent(idx, char) {
    // Generate Daily Items
    const dailyItems = [];
    dailyItems.push(renderItem(idx, 'daily_sq', '사명 퀘스트', char.daily_sq, '매일 05시', char.hidden_keys.includes('daily_sq')));
    dailyItems.push(renderItem(idx, 'daily_abyss_supply', '어비스 일일 보급', char.daily_abyss_supply, '매일 05시', char.hidden_keys.includes('daily_abyss_supply')));
    dailyItems.push(renderItem(idx, 'daily_kina', '키나 제한', char.daily_kina, '매일 05시', char.hidden_keys.includes('daily_kina')));
    char.custom_quests.filter(q => q.type === 'daily').forEach((q, qIdx) => dailyItems.push(renderCustomItem(idx, q, qIdx)));
    char.extra_daily.forEach((_, qIdx) => dailyItems.push(renderExtraItem(idx, 'daily', qIdx)));

    const finalDaily = dailyItems.filter(html => html !== '');

    // Generate Weekly Items
    const weeklyItems = [];
    weeklyItems.push(renderItem(idx, 'weekly_directive', '지령서 퀘스트', char.weekly_directive, '수 05시', char.hidden_keys.includes('weekly_directive')));
    weeklyItems.push(renderItem(idx, 'weekly_abyss_directive', '어비스 지령서', char.weekly_abyss_directive, '수 05시', char.hidden_keys.includes('weekly_abyss_directive')));
    weeklyItems.push(renderItem(idx, 'weekly_abyss_supply', '어비스 주간 보급', char.weekly_abyss_supply, '수 05시', char.hidden_keys.includes('weekly_abyss_supply')));
    if (!char.hidden_keys.includes('weekly_battlefield')) {
        weeklyItems.push(`
            <div class="quest-item" style="cursor:default;">
                <label class="quest-label">전장<span class="reset-hint">수 05시</span></label>
                <div class="counter-group">
                    <button class="counter-btn" onclick="updateCounter(${idx}, 'weekly_battlefield', -1, 10, event)">-</button>
                    <!-- NOTE: Battlefield MUST use 'mini' class (50px) to prevent layout break. Do not change. -->
                    <span class="counter-val mini" onclick="openTicketEdit(${idx}, 'weekly_battlefield', 10, event)">${char.weekly_battlefield || 0}/10</span>
                    <button class="counter-btn" onclick="updateCounter(${idx}, 'weekly_battlefield', 1, 10, event)">+</button>
                </div>
            </div>
        `);
    }
    weeklyItems.push(renderItem(idx, 'weekly_ak', '각성전', char.weekly_ak, '수 05시', char.hidden_keys.includes('weekly_ak')));
    weeklyItems.push(renderItem(idx, 'weekly_tb', '토벌전', char.weekly_tb, '수 05시', char.hidden_keys.includes('weekly_tb')));
    char.custom_quests.filter(q => q.type === 'weekly').forEach((q, qIdx) => weeklyItems.push(renderCustomItem(idx, q, qIdx)));
    char.extra_weekly.forEach((_, qIdx) => weeklyItems.push(renderExtraItem(idx, 'weekly', qIdx)));

    const finalWeekly = weeklyItems.filter(html => html !== '');

    // Balance Columns
    const max = Math.max(finalDaily.length, finalWeekly.length);
    while (finalDaily.length < max) finalDaily.push(renderEmptyRow());
    while (finalWeekly.length < max) finalWeekly.push(renderEmptyRow());

    return `
        <div class="grid-content">
            <div class="column">${finalDaily.join('')}</div>
            <div class="column">${finalWeekly.join('')}</div>
        </div>
    `;
}

function renderArtifactSection(idx, char) {
    const isHidden = char.hidden_keys.includes('abyss_lower') && char.hidden_keys.includes('abyss_middle');
    return `
        <div class="section-divider ${isHidden ? 'is-hidden' : ''}">아티펙트 회랑</div>
        <div class="grid-content ${isHidden ? 'is-hidden' : ''}" style="border-bottom:none;">
             <div class="column">${renderItem(idx, 'abyss_lower', '어비스 하층', char.abyss_lower, '', char.hidden_keys.includes('abyss_lower'))}</div>
             <div class="column">${renderItem(idx, 'abyss_middle', '어비스 중층', char.abyss_middle, '', char.hidden_keys.includes('abyss_middle'))}</div>
        </div>
    `;
}

function renderOddSection(idx, char) {
    const isHidden = char.hidden_keys.includes('weekly_odd_buy') && char.hidden_keys.includes('weekly_odd_craft');
    return `
        <div class="section-divider ${isHidden ? 'is-hidden' : ''}">오드 에너지</div>
        <div class="grid-content ${isHidden ? 'is-hidden' : ''}" style="border-bottom:none;">
             <div class="column">${renderItem(idx, 'weekly_odd_buy', '오드 구매', char.weekly_odd_buy, '수 05시', char.hidden_keys.includes('weekly_odd_buy'))}</div>
             <div class="column">${renderItem(idx, 'weekly_odd_craft', '오드 제작', char.weekly_odd_craft, '수 05시', char.hidden_keys.includes('weekly_odd_craft'))}</div>
        </div>
    `;
}

function renderTicketSection(idx, char) {
    const keys = ['conq', 'trans', 'ticket_nightmare', 'ticket_shugo', 'ticket_dimension', 'dungeon', 'ticket_exploration'];
    const isHidden = keys.every(k => char.hidden_keys.includes(k));

    return `
        <div class="section-divider ${isHidden ? 'is-hidden' : ''}">티켓</div>
        <div class="ticket-section ${isHidden ? 'is-hidden' : ''}">
            ${renderTicket(idx, 'conq', '정복 티켓', CONFIG.TICKET_LIMITS.CONQ, 8, 1, '', char.hidden_keys.includes('conq'))}
            ${renderTicket(idx, 'trans', '초월 티켓', CONFIG.TICKET_LIMITS.TRANS, 8, 1, '', char.hidden_keys.includes('trans'))}
            ${renderTicket(idx, 'ticket_nightmare', '악몽 티켓', CONFIG.TICKET_LIMITS.NIGHTMARE, 24, 2, '', char.hidden_keys.includes('ticket_nightmare'))}
            ${renderTicket(idx, 'ticket_shugo', '슈고페스타 티켓', CONFIG.TICKET_LIMITS.SHUGO, 24, 2, '', char.hidden_keys.includes('ticket_shugo'))}
            ${renderTicket(idx, 'ticket_dimension', '차원침공 티켓', CONFIG.TICKET_LIMITS.DIMENSION, 24, 1, '', char.hidden_keys.includes('ticket_dimension'))}
            ${renderTicket(idx, 'dungeon', '일일 던전', CONFIG.TICKET_LIMITS.DUNGEON, -1, 0, '수 05시 리셋', char.hidden_keys.includes('dungeon'))}
            ${!char.hidden_keys.includes('ticket_exploration') ? `
                <div class="ticket-item">
                    <div style="display:flex; flex-direction:column;">
                       <span class="ticket-name">탐험 티켓</span>
                       <span class="ticket-sub">오드 60 소모</span>
                    </div>
                    <div class="counter-group">
                        <button class="counter-btn" onclick="updateExplorationTicket(${idx}, -1, event)">-</button>
                        <span class="counter-val">${char.ticket_exploration || 0}</span>
                        <button class="counter-btn" onclick="updateExplorationTicket(${idx}, 1, event)">+</button>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function renderFooter(idx) {
    return `
        <div class="footer">
            <div class="reset-label" onclick="openResetMenu(${idx}, event)">RESET</div>
            <div class="reset-trigger-text" onclick="openResetMenu(${idx}, event)">초기화 항목 선택</div>
            <div class="settings-btn" onclick="openSettings(${idx}, event)">⚙️</div>
        </div>
    `;
}

function dragStart(e, idx) {
    // Safety: Ensure no other elements have the dragging class from a previous stuck state
    document.querySelectorAll('.container').forEach(el => el.classList.remove('dragging'));

    // Prevent dragging if any modal is open
    if (document.querySelector('.modal-overlay.show')) {
        e.preventDefault();
        return;
    }

    // Drag handle check: allow dragging if title-area or its children (except buttons/inputs) are clicked
    if (!e.target.closest('.title-area')) {
        e.preventDefault();
        return;
    }

    // Deny drag only if interacting with active input controls
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
        e.preventDefault();
        return;
    }

    dragSrcIndex = idx;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idx); // Critical for browser compatibility
    const container = e.target.closest('.container');
    if (container) { e.dataTransfer.setDragImage(container, 0, 0); setTimeout(() => container.classList.add('dragging'), 0); }
}
function clearDropTargets() {
    document.querySelectorAll('.container').forEach(el => el.classList.remove('drop-target'));
}

function dragOver(e, idx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Don't highlight if dragging over itself
    if (dragSrcIndex === idx) return;

    const target = e.currentTarget;
    if (target && target.classList.contains('container')) {
        target.classList.add('drop-target');
    }
}

function dragLeave(e) {
    const target = e.currentTarget;
    // Only remove if we are genuinely leaving the container, not entering a child element
    if (e.relatedTarget && target.contains(e.relatedTarget)) return;

    if (target) target.classList.remove('drop-target');
}

function drop(e, idx) {
    e.stopPropagation();
    clearDropTargets(); // Cleanup visual

    // Safety: Boundary checks for dragSrcIndex
    if (dragSrcIndex !== null && dragSrcIndex >= 0 && dragSrcIndex < characters.length && dragSrcIndex !== idx) {
        const movedChar = characters.splice(dragSrcIndex, 1)[0];
        characters.splice(idx, 0, movedChar);
        saveToDisk(); render();
    }
    return false;
}

function dragEnd(e) {
    document.querySelectorAll('.container').forEach(el => {
        el.classList.remove('dragging');
        el.classList.remove('drop-target'); // ensure cleanup
    });
    dragSrcIndex = null;
}

function renderItem(idx, key, label, val, hint = '', isHidden = false) {
    if (isHidden) return '';

    // Determine if this is a daily or weekly item and check warning
    let warningClass = '';
    if (hint.includes('매일')) {
        warningClass = shouldShowDailyWarning() ? ' time-warning' : '';
    } else if (hint.includes('수 05시')) {
        const targetDay = 3;
        warningClass = shouldShowWeeklyWarning(targetDay) ? ' time-warning' : '';
    }

    return `
            <div class="quest-item" onclick="updateField(${idx}, '${key}', !characters[${idx}].${key})">
                <label class="quest-label">${label}${hint ? `<span class="reset-hint${warningClass}">${hint}</span>` : ''}</label>
                <input type="checkbox" ${val ? 'checked' : ''}>
            </div>
        `;
}

function renderCustomItem(idx, quest, qIdx) {
    return `
            <div class="quest-item" onclick="updateCustomField(${idx}, ${qIdx}, !characters[${idx}].custom_quests[${qIdx}].val)">
                <label class="quest-label">${quest.name}${quest.hint ? `<span class="reset-hint">${quest.hint}</span>` : ''}</label>
                <input type="checkbox" ${quest.val ? 'checked' : ''}>
            </div>
        `;
}

function renderExtraItem(idx, type, qIdx) {
    const char = characters[idx];
    const item = type === 'daily' ? char.extra_daily[qIdx] : char.extra_weekly[qIdx];
    if (!item.name) return renderEmptyRow();
    return `
            <div class="quest-item" onclick="updateExtraField(${idx}, '${type}', ${qIdx}, !characters[${idx}].extra_${type}[${qIdx}].val)">
                <label class="quest-label">${item.name}</label>
                <input type="checkbox" ${item.val ? 'checked' : ''}>
            </div>
        `;
}

function renderEmptyRow() {
    return `
            <div class="quest-item empty-slot" style="cursor:default;">
                <label class="quest-label">&nbsp;</label>
            </div>
        `;
}

function updateCustomField(idx, qIdx, val) {
    characters[idx].custom_quests[qIdx].val = val;
    saveToDisk(); render();
}

function openSettings(idx, event) {
    event.stopPropagation();
    document.getElementById(`settings-overlay-${idx}`).classList.add('show');
}

function toggleVisibility(idx, key) {
    const char = characters[idx];
    if (char.hidden_keys.includes(key)) char.hidden_keys = char.hidden_keys.filter(k => k !== key);
    else char.hidden_keys.push(key);
    saveToDisk(); render();
    document.getElementById(`settings-overlay-${idx}`).classList.add('show');
}

function addCustomQuest(idx) {
    const nameInput = document.getElementById(`custom-name-${idx}`);
    const typeInput = document.getElementById(`custom-type-${idx}`);
    const hintInput = document.getElementById(`custom-hint-${idx}`);
    const name = nameInput.value.trim();
    if (!name) return;
    characters[idx].custom_quests.push({
        name: name, type: typeInput.value, hint: hintInput.value.trim(), val: false
    });
    nameInput.value = ''; hintInput.value = '';
    saveToDisk(); render();
    document.getElementById(`settings-overlay-${idx}`).classList.add('show');
}

function deleteCustomQuest(idx, qIdx) {
    characters[idx].custom_quests.splice(qIdx, 1);
    saveToDisk(); render();
    document.getElementById(`settings-overlay-${idx}`).classList.add('show');
}

function renderTicket(idx, key, name, max, regenHours, regenAmount, customHint = '', isHidden = false) {
    if (isHidden) return '';
    let val = characters[idx][key] || 0;
    let extra = characters[idx][key + '_extra'] || 0;
    let hintText = customHint || (regenHours === 24 ? `매일 05시 / +${regenAmount}개` : `05시 기준 ${regenHours}시간 / +${regenAmount}개`);
    let displayVal = extra > 0 ? `${val}<span style="color:var(--accent-cyan); font-size:12px;">(+${extra})</span>/${max}` : `${val}/${max}`;
    const valClass = (val === 0 && extra === 0) ? 'done-val' : '';
    return `
            <div class="ticket-item">
                <div style="display:flex; flex-direction:column;">
                   <span class="ticket-name">${name}</span>
                   <span class="ticket-sub">${hintText}</span>
                </div>
                <div class="counter-group">
                    <button class="counter-btn" onclick="updateCounter(${idx}, '${key}', -1, ${max}, event)">-</button>
                    <span class="counter-val ${valClass}" onclick="openTicketEdit(${idx}, '${key}', ${max}, event)">${displayVal}</span>
                    <button class="counter-btn" onclick="updateCounter(${idx}, '${key}', 1, ${max}, event)">+</button>
                </div>
            </div>
        `;
}

function updateExtraField(idx, type, qIdx, val) {
    if (type === 'daily') characters[idx].extra_daily[qIdx].val = val;
    else characters[idx].extra_weekly[qIdx].val = val;
    saveToDisk(); render();
}

function updateExtraName(idx, type, qIdx, name) {
    if (type === 'daily') characters[idx].extra_daily[qIdx].name = name;
    else characters[idx].extra_weekly[qIdx].name = name;
    saveToDisk(); render();
    document.getElementById(`settings-overlay-${idx}`).classList.add('show');
}

function updateField(idx, key, val) {
    characters[idx][key] = val;
    saveToDisk();
    render();
}

// --- Event Notification Logic ---
function checkEventTimers(now) {
    if (!CONFIG.EVENTS) return;

    const currentMins = now.getMinutes();
    const currentSecs = now.getSeconds();

    CONFIG.EVENTS.forEach(event => {
        // Skip if notification for this specific event type is disabled
        if (event.id === 'shugo' && !isShugoNotify) return;
        if (event.id === 'dimension' && !isDimensionNotify) return;

        // Helper to check window
        const checkWindow = (targetMins, duration, type) => {
            for (let tm of targetMins) {
                // Calculate elapsed seconds since the target minute started
                // Handle hour wrap-around simply by modulo 60 arithmetic
                let diffMins = (currentMins - tm + 60) % 60;

                // Optimization: If diff > duration/60 (plus buffer), skip (e.g. 5 mins away)
                if (diffMins > 10) continue;

                let elapsed = diffMins * 60 + currentSecs;

                if (elapsed >= 0 && elapsed < duration) {
                    // Use a stable key based on the TARGET start time (Hour + TargetMin)
                    // unique per day/hour/targetMin
                    const stableKey = `${event.id}_${type}_${now.getDate()}_${now.getHours()}_${tm}`;

                    if (!eventState[stableKey]) {
                        eventState[stableKey] = true;
                        if (type === 'alert') showEventAlert(event);
                        else showEventCheck(event);
                    }
                    return; // Handled
                }
            }
        };

        checkWindow(event.alertMins, event.alertDuration, 'alert');
        checkWindow(event.checkMins, event.checkDuration, 'check');
    });
}

function showEventAlert(event) {
    const popupId = `event-alert-${event.id}`;
    const existing = document.getElementById(popupId);
    if (existing) existing.remove();

    // Determine grid columns
    const mainGrid = document.querySelector('.character-grid');
    let cols = 2;
    if (mainGrid) {
        const compStyle = window.getComputedStyle(mainGrid);
        const tmpl = compStyle.gridTemplateColumns;
        if (tmpl) cols = tmpl.split(' ').length;
    }

    // Generate Char List (for viewing only)
    const listHtml = characters.map(char => {
        const val = char[event.ticketKey] || 0;
        const extra = char[event.ticketKey + '_extra'] || 0;
        const displayVal = extra > 0 ? `${val}<span style="color:var(--accent-cyan); font-size:12px;">(+${extra})</span>` : `${val}`;
        const icon = CONFIG.CLASS_ICONS[char.char_class] || '';
        return `
            <div class="event-char-info">
                <span>${icon} ${char.name}</span>
                <span class="counter-val">${displayVal}</span>
            </div>
        `;
    }).join('');

    const overlay = document.createElement('div');
    overlay.className = 'event-overlay';
    overlay.id = popupId;
    overlay.onclick = () => overlay.remove();

    overlay.innerHTML = `
        <div class="event-popup" onclick="event.stopPropagation()" style="max-width: 800px;">
            <div class="event-title">🔔 ${event.name}</div>
            <div class="event-message">입장 시간입니다!<br>티켓 보유 현황을 확인하세요.</div>
            <div class="event-char-list" style="grid-template-columns: repeat(${cols}, 1fr)">
                ${listHtml}
            </div>
            <button class="event-close-btn" onclick="document.getElementById('${popupId}').remove()">확인 (닫기)</button>
        </div>
    `;

    document.body.appendChild(overlay);

    setTimeout(() => {
        if (document.getElementById(popupId)) {
            document.getElementById(popupId).remove();
        }
    }, event.alertDuration * 1000);
}

function showEventCheck(event) {
    const popupId = `event-check-${event.id}`;

    const existing = document.getElementById(popupId);
    if (existing) existing.remove();

    // Determine grid columns based on main grid
    const mainGrid = document.querySelector('.character-grid');
    let cols = 2; // default
    if (mainGrid) {
        const compStyle = window.getComputedStyle(mainGrid);
        // Count the number of columns in the computed grid-template-columns
        const tmpl = compStyle.gridTemplateColumns; // e.g., "340px 340px 340px"
        if (tmpl) cols = tmpl.split(' ').length;
    }

    // Generate Char List
    const buttonsHtml = characters.map((char, idx) => {
        const val = char[event.ticketKey] || 0;
        const extra = char[event.ticketKey + '_extra'] || 0;
        const displayVal = extra > 0 ? `${val}<span style="color:var(--accent-cyan); font-size:12px;">(+${extra})</span>` : `${val}`;
        const icon = CONFIG.CLASS_ICONS[char.char_class] || '';
        return `
            <button class="event-char-btn" id="btn-event-${event.id}-${idx}" onclick="deductEventTicket(${idx}, '${event.ticketKey}', '${event.id}', '${popupId}')">
                <span>${icon} ${char.name}</span>
                <span id="val-event-${event.id}-${idx}" class="counter-val">${displayVal}</span>
            </button>
        `;
    }).join('');

    const overlay = document.createElement('div');
    overlay.className = 'event-overlay';
    overlay.id = popupId;

    // Close on outside click
    overlay.onclick = () => overlay.remove();

    overlay.innerHTML = `
        <div class="event-popup" onclick="event.stopPropagation()">
            <div class="event-title">🎫 ${event.name} 체크</div>
            <div class="event-message">참여한 캐릭터를 선택해주세요.<br>(티켓이 1 차감됩니다)</div>
            <div class="event-char-list" style="grid-template-columns: repeat(${cols}, 1fr)">
                ${buttonsHtml}
            </div>
            <button class="event-close-btn" onclick="document.getElementById('${popupId}').remove()">진행하지 않았음 / 닫기</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Auto-close timer
    setTimeout(() => {
        if (document.getElementById(popupId)) {
            document.getElementById(popupId).remove();
        }
    }, event.checkDuration * 1000); // 3m
}

function deductEventTicket(idx, ticketKey, eventId, popupId) {
    if (!characters[idx]) return;

    // Logic: Decrement 1
    let current = characters[idx][ticketKey] || 0;
    if (current > 0) {
        characters[idx][ticketKey] = current - 1;
        saveToDisk();
        render(); // update main UI behind

        // Remove popup immediately as per request
        if (popupId) {
            const popup = document.getElementById(popupId);
            if (popup) popup.remove();
        }
    } else {
        alert('티켓이 부족합니다.');
    }
}

function updateCounter(idx, key, delta, max, event) {
    event.stopPropagation();
    const char = characters[idx];
    let val = char[key] || 0;
    let extra = char[key + '_extra'] || 0;
    if (delta > 0) {
        if (val < max) { char[key] = val + 1; saveToDisk(); render(); }
        return;
    }
    if (delta < 0) {
        if (val <= 0 && extra <= 0) return;
        if (key === 'conq' || key === 'trans') {
            const baseE = char.odd_energy || 0;
            const extraE = char.odd_energy_extra || 0;
            if (baseE + extraE < 80) {
                pendingTicket = { idx, key, max };
                document.getElementById(`insufficient-overlay-${idx}`).classList.add('show');
                setTimeout(() => document.getElementById(`insufficient-input-${idx}`).focus(), 100);
                return;
            } else {
                if (baseE >= 80) char.odd_energy = baseE - 80;
                else { char.odd_energy = 0; char.odd_energy_extra = extraE - (80 - baseE); }
            }
        }
        if (val > 0) char[key] = val - 1;
        else if (extra > 0) char[key + '_extra'] = extra - 1;
        saveToDisk(); render();
    }
}

function openTicketEdit(idx, key, max, event) {
    event.stopPropagation();
    editingTicket = { idx, key, max };
    document.getElementById(`ticket-edit-overlay-${idx}`).classList.add('show');
    document.getElementById(`ticket-current-${idx}`).value = characters[idx][key] || 0;
    document.getElementById(`ticket-add-${idx}`).value = characters[idx][key + '_extra'] || 0;
    const input = document.getElementById(`ticket-current-${idx}`);
    input.focus(); input.select();
}

function saveTicketEdit(idx) {
    if (!editingTicket || editingTicket.idx !== idx) return;
    const key = editingTicket.key;
    let base = parseInt(document.getElementById(`ticket-current-${idx}`).value) || 0;
    let extra = parseInt(document.getElementById(`ticket-add-${idx}`).value) || 0;
    if (base < 0) base = 0;
    if (base > editingTicket.max) base = editingTicket.max;
    if (extra < 0) extra = 0;
    characters[idx][key] = base;
    characters[idx][key + '_extra'] = extra;
    saveToDisk(); render(); closeModal(`ticket-edit-overlay-${idx}`);
    editingTicket = null;
}

function solveInsufficient(idx) {
    if (!pendingTicket || pendingTicket.idx !== idx) return;
    const input = document.getElementById(`insufficient-input-${idx}`);
    const realEnergy = parseInt(input.value);
    const char = characters[idx];
    if (!isNaN(realEnergy) && realEnergy >= 0) {
        char.odd_energy = realEnergy;
        const { key } = pendingTicket;
        const base = char.odd_energy || 0;
        const extra = char.odd_energy_extra || 0;
        if (base + extra >= 80) {
            if (base >= 80) char.odd_energy -= 80;
            else { char.odd_energy = 0; char.odd_energy_extra = extra - (80 - base); }
            let val = char[key] || 0;
            let t_extra = char[key + '_extra'] || 0;
            if (val > 0) char[key] = val - 1;
            else if (t_extra > 0) char[key + '_extra'] = t_extra - 1;
            saveToDisk(); render(); closeModal(`insufficient-overlay-${idx}`);
            pendingTicket = null;
        } else {
            alert("입력한 에너지가 부족합니다.");
        }
    }
}

function addCharacter() { characters.push(createNewChar(`캐릭터 ${characters.length + 1}`)); saveToDisk(); render(); }
function removeCharacter() { if (characters.length > 1) { characters.pop(); saveToDisk(); render(); } }

function openRename(idx, event) {
    event.stopPropagation();
    document.getElementById(`rename-overlay-${idx}`).classList.add('show');
    const input = document.getElementById(`rename-input-${idx}`);
    input.value = characters[idx].name;
    input.focus(); input.select();
}
function saveRename(idx) {
    const input = document.getElementById(`rename-input-${idx}`);
    if (input.value.trim() !== "") { characters[idx].name = input.value.trim(); saveToDisk(); render(); }
    closeModal(`rename-overlay-${idx}`);
}

function openClassSelector(idx, event) {
    event.stopPropagation();
    document.getElementById(`class-overlay-${idx}`).classList.add('show');
}
function setClass(idx, className) {
    characters[idx].char_class = className;
    saveToDisk(); render(); closeModal(`class-overlay-${idx}`);
}

function openOdd(idx, event) {
    event.stopPropagation();
    document.getElementById(`odd-overlay-${idx}`).classList.add('show');
    document.getElementById(`odd-base-${idx}`).value = characters[idx].odd_energy || 0;
    document.getElementById(`odd-extra-${idx}`).value = characters[idx].odd_energy_extra || 0;
    setTimeout(() => {
        const input = document.getElementById(`odd-base-${idx}`);
        input.focus(); input.select();
    }, 100);
}
function saveOdd(idx) {
    characters[idx].odd_energy = parseInt(document.getElementById(`odd-base-${idx}`).value) || 0;
    characters[idx].odd_energy_extra = parseInt(document.getElementById(`odd-extra-${idx}`).value) || 0;
    saveToDisk(); render(); closeModal(`odd-overlay-${idx}`);
}

function openOddItemEdit(idx, type, event) {
    event.stopPropagation();
    editingOddItem = { idx, type };
    const title = type === 'small' ? '작은 오드 (+10)' : '오드 (+40)';
    document.getElementById(`odd-item-title-${idx}`).innerText = title + ' 사용';
    const qtyInput = document.getElementById(`odd-item-qty-${idx}`);
    qtyInput.value = '';
    document.getElementById(`odd-item-gain-text-${idx}`).innerText = '획득: +0 에너지';
    qtyInput.oninput = () => {
        const qty = parseInt(qtyInput.value) || 0;
        const gain = qty * (type === 'small' ? 10 : 40);
        document.getElementById(`odd-item-gain-text-${idx}`).innerText = `획득: +${gain} 에너지`;
    };
    document.getElementById(`odd-item-overlay-${idx}`).classList.add('show');
    setTimeout(() => {
        const input = document.getElementById(`odd-item-qty-${idx}`);
        input.focus();
        input.select();
    }, 100);
}

function saveOddItem(idx) {
    if (!editingOddItem || editingOddItem.idx !== idx) return;
    const qty = parseInt(document.getElementById(`odd-item-qty-${idx}`).value) || 0;
    if (qty > 0) {
        const gain = qty * (editingOddItem.type === 'small' ? 10 : 40);
        characters[idx].odd_energy_extra = (characters[idx].odd_energy_extra || 0) + gain;
        saveToDisk(); render();
    }
    closeModal(`odd-item-overlay-${idx}`);
    editingOddItem = null;
}

function updateExplorationTicket(idx, delta, event) {
    event.stopPropagation();
    const char = characters[idx];

    if (delta > 0) {
        // Check if we have enough odd energy (60 required)
        const totalOdd = (char.odd_energy || 0) + (char.odd_energy_extra || 0);
        if (totalOdd < 60) {
            openOdd(idx, event);
            return;
        }

        // Deduct 60 odd energy (prioritize base, then extra)
        let remaining = 60;
        if (char.odd_energy >= remaining) {
            char.odd_energy -= remaining;
        } else {
            remaining -= char.odd_energy;
            char.odd_energy = 0;
            char.odd_energy_extra -= remaining;
        }

        // Increment ticket
        char.ticket_exploration = (char.ticket_exploration || 0) + 1;
    } else if (delta < 0) {
        // Decrement ticket (no energy refund)
        char.ticket_exploration = Math.max(0, (char.ticket_exploration || 0) - 1);
    }

    saveToDisk();
    render();
}

function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function openResetMenu(idx, event) { event.stopPropagation(); document.getElementById(`reset-overlay-${idx}`).classList.add('show'); }

function handleReset(idx, type) {
    const char = characters[idx];
    if (type === 'daily' || type === 'all') {
        char.daily_sq = false; char.daily_kina = false; char.daily_abyss_supply = false;
        char.custom_quests.forEach(q => { if (q.type === 'daily') q.val = false; });
        char.extra_daily.forEach(q => q.val = false);
    }
    if (type === 'weekly' || type === 'all') {
        char.dungeon = 7;
        char.weekly_odd_buy = false; char.weekly_ak = false; char.weekly_tb = false;
        char.weekly_directive = false; char.weekly_abyss_directive = false;
        char.weekly_abyss_supply = false; char.weekly_battlefield = 0; char.weekly_odd_craft = false;
        char.ticket_exploration = 0;
        char.custom_quests.forEach(q => { if (q.type === 'weekly') q.val = false; });
        char.extra_weekly.forEach(q => q.val = false);
    }
    closeModal(`reset-overlay-${idx}`); saveToDisk(); render();
}

// --- Artifact Corridor Global Reset Logic ---
function openArtifactReset(type) {
    const overlayId = type === 'lower' ? 'artifact-reset-lower' : 'artifact-reset-middle';
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.classList.add('show');
}

function confirmArtifactReset(type) {
    const overlayId = type === 'lower' ? 'artifact-reset-lower' : 'artifact-reset-middle';
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;

    // Explicit reset without checkboxes
    const key = type === 'lower' ? 'abyss_lower' : 'abyss_middle';
    characters.forEach(c => c[key] = false);
    saveToDisk();
    render();

    overlay.classList.remove('show');
}

function exportData() {
    const dummy = document.createElement("textarea"); document.body.appendChild(dummy);
    dummy.value = JSON.stringify(characters); dummy.select(); document.execCommand("copy");
    document.body.removeChild(dummy); alert("클립보드에 복사되었습니다.");
}

function importData() {
    const code = prompt("백업 코드를 입력하세요:");
    if (code) { try { characters = JSON.parse(code); saveToDisk(); render(); } catch (e) { alert("오류"); } }
}

function downloadBackup() {
    const dataStr = JSON.stringify(characters, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'aion2_manager_backup_' + new Date().toISOString().slice(0, 10) + '.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}
