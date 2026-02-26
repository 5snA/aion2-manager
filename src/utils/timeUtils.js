export function formatTimeDiff(ms, showDays = false) {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    const hms = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return showDays && d > 0 ? `${d}일 ${hms}` : hms;
}

export function getDailyRemaining(now, targetHour = 5) {
    let target = new Date(now);
    target.setHours(targetHour, 0, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    return target - now;
}

export function getWeeklyRemaining(now, targetDay = 3, targetHour = 5) {
    let target = new Date(now);
    let daysUntil = (targetDay - now.getDay() + 7) % 7;
    if (daysUntil === 0 && now.getHours() >= targetHour) daysUntil = 7;
    target.setDate(now.getDate() + daysUntil);
    target.setHours(targetHour, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 7);
    return target - now;
}

export function checkWeeklyCross(lastTs, nowTs, targetDay, targetHour) {
    const dLast = new Date(lastTs);
    const dNow = new Date(nowTs);
    let nextTarget = new Date(dLast);
    nextTarget.setHours(targetHour, 0, 0, 0);
    let daysUntil = (targetDay - nextTarget.getDay() + 7) % 7;
    if (daysUntil === 0 && dLast.getHours() >= targetHour) {
        daysUntil = 7;
    }
    nextTarget.setDate(nextTarget.getDate() + daysUntil);
    return nextTarget.getTime() <= dNow.getTime();
}

export function checkArtifactReset(lastTs, nowTs) {
    const dLast = new Date(lastTs);
    const dNow = new Date(nowTs);
    const resetDays = [2, 4, 6]; // Tue, Thu, Sat
    const resetHour = 21;

    let pointer = new Date(dLast);
    pointer.setHours(resetHour, 0, 0, 0);
    if (pointer <= dLast) {
        pointer.setDate(pointer.getDate() + 1);
    }

    while (pointer <= dNow) {
        if (resetDays.includes(pointer.getDay())) {
            return true;
        }
        pointer.setDate(pointer.getDate() + 1);
    }
    return false;
}

/**
 * Processes automatic logic for all characters.
 * Returns a new array of characters if any changes occurred, otherwise null.
 */
export function processAutoLogic(characters, now, isMembership, membershipDate, CONFIG) {
    let changed = false;
    const ONE_DAY = 86400000;
    const EIGHT_HOURS = 28800000;
    const OFFSET_5H = 18000000;
    const THREE_HOURS = 10800000;

    const tzOffset = new Date().getTimezoneOffset() * 60000;
    const localNow = now - tzOffset;

    // Membership Expiration Logic (28 days)
    let effectiveMembership = isMembership;
    if (isMembership && membershipDate) {
        const mDate = new Date(membershipDate).getTime();
        const daysElapsed = (now - mDate) / (1000 * 60 * 60 * 24);
        if (daysElapsed >= 28) {
            effectiveMembership = false;
            // Note: We'll need a way to update the parent state if this happens, 
            // but for logic purposes, we use effectiveMembership here.
        }
    }

    const newCharacters = characters.map(char => {
        let charChanged = false;
        let newChar = { ...char };

        if (!newChar.last_ts) newChar.last_ts = newChar.odd_ts || now;
        const localLast = newChar.last_ts - tzOffset;

        // 1. Odd Energy Regeneration
        const currOddBlock = Math.floor((localNow - OFFSET_5H) / THREE_HOURS);
        const lastOddBlock = Math.floor((localLast - OFFSET_5H) / THREE_HOURS);
        if (currOddBlock > lastOddBlock) {
            const ticks = currOddBlock - lastOddBlock;
            const rate = effectiveMembership ? 15 : 10;
            const current = newChar.odd_energy || 0;
            if (current < CONFIG.MAX_ODD) {
                newChar.odd_energy = Math.min(CONFIG.MAX_ODD, current + (ticks * rate));
                charChanged = true;
            }
        }

        // 2. Ticket Regeneration (Conq & Trans only)
        const curr8hBlock = Math.floor((localNow - OFFSET_5H) / EIGHT_HOURS);
        const last8hBlock = Math.floor((localLast - OFFSET_5H) / EIGHT_HOURS);
        if (curr8hBlock > last8hBlock) {
            const ticks = curr8hBlock - last8hBlock;
            if ((newChar.conq || 0) < CONFIG.TICKET_LIMITS.CONQ) {
                newChar.conq = Math.min(CONFIG.TICKET_LIMITS.CONQ, (newChar.conq || 0) + ticks);
                charChanged = true;
            }
            if ((newChar.trans || 0) < CONFIG.TICKET_LIMITS.TRANS) {
                newChar.trans = Math.min(CONFIG.TICKET_LIMITS.TRANS, (newChar.trans || 0) + ticks);
                charChanged = true;
            }
        }

        // 3. Daily Reset
        const currDay = Math.floor((localNow - OFFSET_5H) / ONE_DAY);
        const lastDay = Math.floor((localLast - OFFSET_5H) / ONE_DAY);
        if (currDay > lastDay) {
            const dayTicks = currDay - lastDay;
            newChar.daily_sq = false;
            newChar.daily_kina = false;
            newChar.daily_abyss_supply = false;

            // Recharge limit-based tickets daily
            if ((newChar.ticket_nightmare || 0) < CONFIG.TICKET_LIMITS.NIGHTMARE)
                newChar.ticket_nightmare = Math.min(CONFIG.TICKET_LIMITS.NIGHTMARE, (newChar.ticket_nightmare || 0) + (CONFIG.TICKET_RECHARGE.NIGHTMARE * dayTicks));
            if ((newChar.ticket_shugo || 0) < CONFIG.TICKET_LIMITS.SHUGO)
                newChar.ticket_shugo = Math.min(CONFIG.TICKET_LIMITS.SHUGO, (newChar.ticket_shugo || 0) + (CONFIG.TICKET_RECHARGE.SHUGO * dayTicks));
            if ((newChar.ticket_dimension || 0) < CONFIG.TICKET_LIMITS.DIMENSION)
                newChar.ticket_dimension = Math.min(CONFIG.TICKET_LIMITS.DIMENSION, (newChar.ticket_dimension || 0) + (CONFIG.TICKET_RECHARGE.DIMENSION * dayTicks));

            if (newChar.custom_quests) {
                newChar.custom_quests = newChar.custom_quests.map(q => q.type === 'daily' ? { ...q, val: false } : q);
            }
            charChanged = true;
        }

        // 4. Weekly Reset
        if (checkWeeklyCross(newChar.last_ts, now, CONFIG.WeeklyResetDay, CONFIG.RESET_HOUR_WEEKLY)) {
            newChar.weekly_odd_buy = false;
            newChar.dungeon = CONFIG.TICKET_LIMITS.DUNGEON;
            newChar.ticket_exploration = 0;
            newChar.weekly_directive = false;
            newChar.weekly_abyss_directive = false;
            newChar.weekly_abyss_supply = false;
            newChar.weekly_battlefield = 0;
            newChar.weekly_ak = false;
            newChar.weekly_tb = false;
            newChar.weekly_odd_craft = false;
            if (newChar.custom_quests) {
                newChar.custom_quests = newChar.custom_quests.map(q => q.type === 'weekly' ? { ...q, val: false } : q);
            }
            if (newChar.extra_weekly) {
                newChar.extra_weekly = newChar.extra_weekly.map(q => ({ ...q, val: false }));
            }
            charChanged = true;
        }

        // 5. Artifact Reset
        if (checkArtifactReset(newChar.last_ts, now)) {
            newChar.abyss_lower = false;
            newChar.abyss_middle = false;
            charChanged = true;
        }

        newChar.last_ts = now;
        if (charChanged) changed = true;
        return newChar;
    });

    return changed ? newCharacters : null;
}
