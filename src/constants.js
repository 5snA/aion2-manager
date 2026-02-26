export const CONFIG = {
    MAX_ODD: 840,
    TICKET_LIMITS: {
        CONQ: 21,
        TRANS: 14,
        NIGHTMARE: 14,
        SHUGO: 14,
        DIMENSION: 7,
        DUNGEON: 7,
        EXPLORATION: 7
    },
    TICKET_COST: {
        CONQ: 80,
        TRANS: 80,
        EXPLORATION: 60
    },
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
    },
    CLASSES: ['검성', '수호성', '살성', '궁성', '마도성', '정령성', '치유성', '호법성']
};

export const STORAGE_KEYS = {
    CHARACTERS: 'AION2_TODO_PERSISTENT_V21',
    MEMBERSHIP: 'AION2_MEMBERSHIP_V1',
    MEMBERSHIP_DATE: 'AION2_MEMBERSHIP_DATE_V1',
    SHUGO_NOTIFY: 'AION2_SHUGO_NOTIFY_V1',
    DIM_NOTIFY: 'AION2_DIM_NOTIFY_V1'
};
