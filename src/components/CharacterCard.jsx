import React, { useState, useEffect, useRef } from 'react';
import { CONFIG } from '../constants';

const CharacterCard = React.memo(({ index, data, updateData, onDragStart, onDragOver, onDrop }) => {
    const {
        name, char_class, odd_energy, odd_energy_extra,
        daily_sq, daily_kina, daily_abyss_supply,
        weekly_directive, weekly_abyss_directive, weekly_abyss_supply,
        weekly_odd_buy, weekly_odd_craft,
        weekly_ak, weekly_tb, weekly_battlefield,
        conq, conq_extra, trans, trans_extra,
        ticket_nightmare, ticket_nightmare_extra,
        ticket_shugo, ticket_shugo_extra,
        ticket_dimension, ticket_dimension_extra,
        ticket_exploration, dungeon,
        abyss_lower, abyss_middle,
        hidden_keys, custom_quests, extra_daily, extra_weekly
    } = data;

    // Local state for modals (Sync with vanilla script logic)
    const [activeModal, setActiveModal] = useState(null); // 'reset', 'class', 'rename', 'odd', 'insufficient', 'oddItem', 'ticketEdit', 'settings'
    const [editingKey, setEditingKey] = useState(null);
    const [editingMax, setEditingMax] = useState(0);
    const [editingOddType, setEditingOddType] = useState(null); // 'small', 'large'

    // Modal Input Refs/States
    const [renameVal, setRenameVal] = useState(name);
    const [oddBaseVal, setOddBaseVal] = useState(odd_energy || 0);
    const [oddExtraVal, setOddExtraVal] = useState(odd_energy_extra || 0);
    const [insufficientVal, setInsufficientVal] = useState('');
    const [oddItemQty, setOddItemQty] = useState('');
    const [ticketBaseVal, setTicketBaseVal] = useState(0);
    const [ticketExtraVal, setTicketExtraVal] = useState(0);

    // Custom Quest Form State
    const [newCustomName, setNewCustomName] = useState('');
    const [newCustomType, setNewCustomType] = useState('daily');
    const [newCustomHint, setNewCustomHint] = useState('');

    const totalOdd = (odd_energy || 0) + (odd_energy_extra || 0);

    // Helpers from vanilla scripts.js
    const closeModal = () => setActiveModal(null);

    const handleUpdate = (newData) => {
        updateData(newData);
    };

    const handleAddCustomQuest = () => {
        if (!newCustomName.trim()) return;
        const newQuest = {
            name: newCustomName.trim(),
            type: newCustomType,
            hint: newCustomHint.trim(),
            val: false
        };
        handleUpdate({ custom_quests: [...(custom_quests || []), newQuest] });
        setNewCustomName('');
        setNewCustomHint('');
    };

    const handleDeleteCustomQuest = (qIdx) => {
        const next = (custom_quests || []).filter((_, i) => i !== qIdx);
        handleUpdate({ custom_quests: next });
    };

    const handleToggleCustomQuest = (qIdx) => {
        const next = [...(custom_quests || [])];
        next[qIdx].val = !next[qIdx].val;
        handleUpdate({ custom_quests: next });
    };

    const updateCounter = (key, delta, max, e) => {
        if (e) e.stopPropagation();
        let val = data[key] || 0;
        let extra = data[key + '_extra'] || 0;

        if (delta > 0) {
            if (val < max) {
                handleUpdate({ [key]: val + 1 });
            }
            return;
        }

        if (delta < 0) {
            if (val <= 0 && extra <= 0) return;

            // SPECIAL LOGIC: conq or trans ticket deduction costs 80 odd energy
            if (key === 'conq' || key === 'trans') {
                if (totalOdd < 80) {
                    setEditingKey(key);
                    setEditingMax(max);
                    setActiveModal('insufficient');
                    return;
                } else {
                    let cost = 80;
                    let newBase = odd_energy || 0;
                    let newExtra = odd_energy_extra || 0;
                    if (newBase >= cost) {
                        newBase -= cost;
                    } else {
                        cost -= newBase;
                        newBase = 0;
                        newExtra -= cost;
                    }

                    let nextVal = val;
                    let nextExtra = extra;
                    if (val > 0) nextVal -= 1;
                    else if (extra > 0) nextExtra -= 1;

                    handleUpdate({
                        odd_energy: newBase,
                        odd_energy_extra: newExtra,
                        [key]: nextVal,
                        [key + '_extra']: nextExtra
                    });
                    return;
                }
            }

            // Normal ticket deduction
            if (val > 0) handleUpdate({ [key]: val - 1 });
            else if (extra > 0) handleUpdate({ [key + '_extra']: extra - 1 });
        }
    };

    const updateExplorationTicket = (delta, e) => {
        if (e) e.stopPropagation();
        if (delta > 0) {
            if (totalOdd < 60) {
                setActiveModal('odd');
                return;
            }
            let cost = 60;
            let newBase = odd_energy || 0;
            let newExtra = odd_energy_extra || 0;
            if (newBase >= cost) newBase -= cost;
            else {
                cost -= newBase;
                newBase = 0;
                newExtra -= cost;
            }
            handleUpdate({
                odd_energy: newBase,
                odd_energy_extra: newExtra,
                ticket_exploration: (ticket_exploration || 0) + 1
            });
        } else {
            handleUpdate({ ticket_exploration: Math.max(0, (ticket_exploration || 0) - 1) });
        }
    };

    const solveInsufficient = () => {
        const realEnergy = parseInt(insufficientVal);
        if (!isNaN(realEnergy) && realEnergy >= 0) {
            if (realEnergy + (odd_energy_extra || 0) >= 80) {
                let cost = 80;
                let newBase = realEnergy;
                let newExtra = odd_energy_extra || 0;
                if (newBase >= cost) newBase -= cost;
                else {
                    cost -= newBase;
                    newBase = 0;
                    newExtra -= cost;
                }

                let nextVal = data[editingKey] || 0;
                let nextExtra = data[editingKey + '_extra'] || 0;
                if (nextVal > 0) nextVal -= 1;
                else if (nextExtra > 0) nextExtra -= 1;

                handleUpdate({
                    odd_energy: newBase,
                    odd_energy_extra: newExtra,
                    [editingKey]: nextVal,
                    [editingKey + '_extra']: nextExtra
                });
                closeModal();
            } else {
                alert("입력한 에너지가 부족합니다.");
            }
        }
    };

    const renderItem = (key, label, val, hint = '') => {
        if (hidden_keys?.includes(key)) return null;
        return (
            <div className="quest-item" onClick={() => handleUpdate({ [key]: !val })}>
                <label className="quest-label">
                    {label}
                    {hint && <span className="reset-hint">{hint}</span>}
                </label>
                <div className={`status-badge ${val ? 'complete' : 'incomplete'}`}>
                    {val ? '완료' : '미완료'}
                </div>
            </div>
        );
    };

    const renderTicket = (key, name, max, hint) => {
        if (hidden_keys?.includes(key)) return null;
        const val = data[key] || 0;
        const extra = data[key + '_extra'] || 0;
        const isDone = (val === 0 && extra === 0);
        return (
            <div className="ticket-item">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="ticket-name">{name}</span>
                    <span className="ticket-sub">{hint}</span>
                </div>
                <div className="counter-group">
                    <button className={`counter-btn btn-minus`} onClick={(e) => updateCounter(key, -1, max, e)}>-</button>
                    <span
                        className={`counter-val ${isDone ? 'done-val' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditingKey(key);
                            setEditingMax(max);
                            setTicketBaseVal(val);
                            setTicketExtraVal(extra);
                            setActiveModal('ticketEdit');
                        }}
                    >
                        {val}{extra > 0 ? <span style={{ color: 'var(--accent-cyan)', fontSize: '12px' }}>(+{extra})</span> : ''}/{max}
                    </span>
                    <button className={`counter-btn btn-plus`} onClick={(e) => updateCounter(key, 1, max, e)}>+</button>
                </div>
            </div>
        );
    };

    return (
        <div
            className="container"
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            {/* Title Area */}
            <div className="title-area">
                <span className="class-badge" onClick={() => setActiveModal('class')}>
                    {CONFIG.CLASS_ICONS[char_class] || '👤'} {char_class}
                </span>
                <span className="char-name" onClick={() => {
                    setRenameVal(name);
                    setActiveModal('rename');
                }}>{name}</span>
                <div className="odd-wrapper">
                    <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '-2px' }}>
                        {odd_energy || 0}<span style={{ color: 'var(--accent-cyan)' }}>(+{odd_energy_extra || 0})</span>
                    </div>
                    <span className="odd-display" onClick={() => {
                        setOddBaseVal(odd_energy || 0);
                        setOddExtraVal(odd_energy_extra || 0);
                        setActiveModal('odd');
                    }}>
                        💎 {totalOdd}/{CONFIG.MAX_ODD}
                    </span>
                    <div style={{ display: 'flex', gap: '3px' }}>
                        <button className="btn-tiny" onClick={() => {
                            setEditingOddType('small');
                            setOddItemQty('');
                            setActiveModal('oddItem');
                        }}>오드10</button>
                        <button className="btn-tiny" onClick={() => {
                            setEditingOddType('large');
                            setOddItemQty('');
                            setActiveModal('oddItem');
                        }}>오드40</button>
                    </div>
                </div>
            </div>

            <div className="grid-header"><div>일일</div><div>주간</div></div>

            <div className="grid-content">
                <div className="column">
                    {renderItem("daily_sq", "사명 퀘스트", daily_sq, "매일 05시")}
                    {renderItem("daily_abyss_supply", "어비스 일일 보급", daily_abyss_supply, "매일 05시")}
                    {renderItem("daily_kina", "키나 제한", daily_kina, "매일 05시")}
                    {(custom_quests || []).map((q, qIdx) => {
                        if (q.type !== 'daily') return null;
                        return (
                            <div key={qIdx} className="quest-item" onClick={() => handleToggleCustomQuest(qIdx)}>
                                <label className="quest-label">{q.name}{q.hint && <span className="reset-hint">{q.hint}</span>}</label>
                                <div className={`status-badge ${q.val ? 'complete' : 'incomplete'}`}>
                                    {q.val ? '완료' : '미완료'}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="column">
                    {renderItem("weekly_directive", "지령서 퀘스트", weekly_directive, "수 05시")}
                    {renderItem("weekly_abyss_directive", "어비스 지령서", weekly_abyss_directive, "수 05시")}
                    {renderItem("weekly_abyss_supply", "어비스 주간 보급", weekly_abyss_supply, "수 05시")}
                    {!hidden_keys?.includes('weekly_battlefield') && (
                        <div className="quest-item" style={{ cursor: 'default' }}>
                            <label className="quest-label">전장<span className="reset-hint">수 05시</span></label>
                            <div className="counter-group">
                                <button className="counter-btn btn-minus" onClick={(e) => handleUpdate({ weekly_battlefield: Math.max(0, (weekly_battlefield || 0) - 1) })}>-</button>
                                <span className="counter-val mini" onClick={() => {
                                    setEditingKey('weekly_battlefield');
                                    setEditingMax(10);
                                    setTicketBaseVal(weekly_battlefield || 0);
                                    setTicketExtraVal(0);
                                    setActiveModal('ticketEdit');
                                }}>{weekly_battlefield || 0}/10</span>
                                <button className="counter-btn btn-plus" onClick={(e) => handleUpdate({ weekly_battlefield: Math.min(10, (weekly_battlefield || 0) + 1) })}>+</button>
                            </div>
                        </div>
                    )}
                    {renderItem("weekly_ak", "각성전", weekly_ak, "수 05시")}
                    {renderItem("weekly_tb", "토벌전", weekly_tb, "수 05시")}
                    {(custom_quests || []).map((q, qIdx) => {
                        if (q.type !== 'weekly') return null;
                        return (
                            <div key={qIdx} className="quest-item" onClick={() => handleToggleCustomQuest(qIdx)}>
                                <label className="quest-label">{q.name}{q.hint && <span className="reset-hint">{q.hint}</span>}</label>
                                <div className={`status-badge ${q.val ? 'complete' : 'incomplete'}`}>
                                    {q.val ? '완료' : '미완료'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Artifact Corridor Section */}
            {(!hidden_keys?.includes('abyss_lower') || !hidden_keys?.includes('abyss_middle')) && (
                <>
                    <div className="section-divider">아티펙트 회랑</div>
                    <div className="grid-content" style={{ borderBottom: 'none' }}>
                        <div className="column">{renderItem("abyss_lower", "어비스 하층", abyss_lower)}</div>
                        <div className="column">{renderItem("abyss_middle", "어비스 중층", abyss_middle)}</div>
                    </div>
                </>
            )}

            {/* Odd Energy Section */}
            {(!hidden_keys?.includes('weekly_odd_buy') || !hidden_keys?.includes('weekly_odd_craft')) && (
                <>
                    <div className="section-divider">오드 에너지</div>
                    <div className="grid-content" style={{ borderBottom: 'none' }}>
                        <div className="column">{renderItem("weekly_odd_buy", "오드 구매", weekly_odd_buy, "수 05시")}</div>
                        <div className="column">{renderItem("weekly_odd_craft", "오드 제작", weekly_odd_craft, "수 05시")}</div>
                    </div>
                </>
            )}

            {/* Ticket Section */}
            <div className="section-divider">티켓</div>
            <div className="ticket-section">
                {renderTicket('conq', '정복 티켓', CONFIG.TICKET_LIMITS.CONQ, '05시 기준 8시간 / +1개')}
                {renderTicket('trans', '초월 티켓', CONFIG.TICKET_LIMITS.TRANS, '05시 기준 8시간 / +1개')}
                {renderTicket('ticket_nightmare', '악몽 티켓', CONFIG.TICKET_LIMITS.NIGHTMARE, '매일 05시 / +2개')}
                {renderTicket('ticket_shugo', '슈고페스타 티켓', CONFIG.TICKET_LIMITS.SHUGO, '매일 05시 / +2개')}
                {renderTicket('ticket_dimension', '차원침공 티켓', CONFIG.TICKET_LIMITS.DIMENSION, '매일 05시 / +1개')}
                {renderTicket('dungeon', '일일 던전', CONFIG.TICKET_LIMITS.DUNGEON, '수 05시 리셋')}
                {!hidden_keys?.includes('ticket_exploration') && (
                    <div className="ticket-item">
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="ticket-name">탐험 티켓</span>
                            <span className="ticket-sub">오드 60 소모</span>
                        </div>
                        <div className="counter-group">
                            <button className="counter-btn btn-minus" onClick={(e) => updateExplorationTicket(-1, e)}>-</button>
                            <span className="counter-val" onClick={(e) => {
                                e.stopPropagation();
                                setEditingKey('ticket_exploration');
                                setEditingMax(20);
                                setTicketBaseVal(ticket_exploration || 0);
                                setTicketExtraVal(0);
                                setActiveModal('ticketEdit');
                            }}>{ticket_exploration || 0}</span>
                            <button className="counter-btn btn-plus" onClick={(e) => updateExplorationTicket(1, e)}>+</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Area */}
            <div className="footer">
                <div className="reset-label" onClick={() => setActiveModal('reset')}>RESET</div>
                <div className="reset-trigger-text" onClick={() => setActiveModal('reset')}>초기화 항목 선택</div>
                <div className="settings-btn" onClick={() => setActiveModal('settings')}>⚙️</div>
            </div>

            {/* MODALS (Sync with Vanilla Modals) */}
            {activeModal === 'reset' && (
                <div className="modal-overlay show" onClick={closeModal}>
                    <div className="modal-menu" onClick={e => e.stopPropagation()}>
                        <div style={{ textAlign: 'center', marginBottom: '10px', fontWeight: 'bold', color: 'var(--accent-blue)', fontSize: '12px' }}>초기화 항목</div>
                        <button className="modal-btn" onClick={() => {
                            handleUpdate({
                                daily_sq: false, daily_kina: false, daily_abyss_supply: false,
                                extra_daily: extra_daily?.map(q => ({ ...q, val: false })),
                                custom_quests: custom_quests?.map(q => q.type === 'daily' ? { ...q, val: false } : q)
                            });
                            closeModal();
                        }}>일일 리셋</button>
                        <button className="modal-btn" onClick={() => {
                            handleUpdate({
                                dungeon: 7, weekly_odd_buy: false, weekly_ak: false, weekly_tb: false,
                                weekly_directive: false, weekly_abyss_directive: false, weekly_abyss_supply: false,
                                weekly_battlefield: 0, weekly_odd_craft: false, ticket_exploration: 0,
                                extra_weekly: extra_weekly?.map(q => ({ ...q, val: false })),
                                custom_quests: custom_quests?.map(q => q.type === 'weekly' ? { ...q, val: false } : q)
                            });
                            closeModal();
                        }}>주간 리셋</button>
                        <button className="modal-btn danger" onClick={() => {
                            handleUpdate({
                                daily_sq: false, daily_kina: false, daily_abyss_supply: false,
                                dungeon: 7, weekly_odd_buy: false, weekly_ak: false, weekly_tb: false,
                                weekly_directive: false, weekly_abyss_directive: false, weekly_abyss_supply: false,
                                weekly_battlefield: 0, weekly_odd_craft: false, ticket_exploration: 0,
                                custom_quests: custom_quests?.map(q => ({ ...q, val: false })),
                                extra_daily: extra_daily?.map(q => ({ ...q, val: false })),
                                extra_weekly: extra_weekly?.map(q => ({ ...q, val: false }))
                            });
                            closeModal();
                        }}>전체 리셋</button>
                        <button className="modal-btn cancel" onClick={closeModal}>취소</button>
                    </div>
                </div>
            )}

            {activeModal === 'class' && (
                <div className="modal-overlay show" onClick={closeModal}>
                    <div className="modal-menu" onClick={e => e.stopPropagation()} style={{ width: '240px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '10px', fontWeight: 'bold', color: 'var(--accent-blue)', fontSize: '12px' }}>직업 선택</div>
                        <div className="class-grid">
                            {CONFIG.CLASSES.map(cls => (
                                <div key={cls} className="class-btn" onClick={() => { handleUpdate({ char_class: cls }); closeModal(); }}>
                                    {CONFIG.CLASS_ICONS[cls]} {cls}
                                </div>
                            ))}
                        </div>
                        <button className="modal-btn cancel" onClick={closeModal}>취소</button>
                    </div>
                </div>
            )}

            {activeModal === 'rename' && (
                <div className="modal-overlay show" onClick={closeModal}>
                    <div className="modal-menu" onClick={e => e.stopPropagation()}>
                        <div style={{ textAlign: 'center', marginBottom: '10px', fontWeight: 'bold', color: 'var(--accent-blue)', fontSize: '12px' }}>캐릭터 이름 변경</div>
                        <input type="text" className="modal-input" value={renameVal} onChange={e => setRenameVal(e.target.value)} onFocus={e => e.target.select()} onKeyPress={e => e.key === 'Enter' && (handleUpdate({ name: renameVal }), closeModal())} autoFocus />
                        <button className="modal-btn" style={{ background: 'var(--accent-blue)', color: 'white', border: 'none' }} onClick={() => { handleUpdate({ name: renameVal }); closeModal(); }}>확인</button>
                        <button className="modal-btn cancel" onClick={closeModal}>취소</button>
                    </div>
                </div>
            )}

            {activeModal === 'odd' && (
                <div className="modal-overlay show" onClick={closeModal}>
                    <div className="modal-menu" onClick={e => e.stopPropagation()}>
                        <div style={{ textAlign: 'center', marginBottom: '10px', fontWeight: 'bold', color: 'var(--accent-blue)', fontSize: '12px' }}>오드 에너지 수정</div>
                        <div className="odd-form-row">
                            <div className="odd-input-group">
                                <label className="odd-input-label">기본 에너지</label>
                                <input type="number" className="modal-input" value={oddBaseVal} onChange={e => setOddBaseVal(parseInt(e.target.value) || 0)} onFocus={e => e.target.select()} autoFocus />
                            </div>
                            <div className="odd-input-group">
                                <label className="odd-input-label">추가 에너지</label>
                                <input type="number" className="modal-input" value={oddExtraVal} onChange={e => setOddExtraVal(parseInt(e.target.value) || 0)} onFocus={e => e.target.select()} />
                            </div>
                        </div>
                        <button className="modal-btn" style={{ background: 'var(--accent-blue)', color: 'white', border: 'none' }} onClick={() => { handleUpdate({ odd_energy: oddBaseVal, odd_energy_extra: oddExtraVal }); closeModal(); }}>확인</button>
                        <button className="modal-btn cancel" onClick={closeModal}>취소</button>
                    </div>
                </div>
            )}

            {activeModal === 'insufficient' && (
                <div className="modal-overlay show" onClick={closeModal}>
                    <div className="modal-menu" onClick={e => e.stopPropagation()}>
                        <div style={{ textAlign: 'center', marginBottom: '10px', fontWeight: 'bold', color: 'var(--accent-gold)', fontSize: '12px' }}>⚠️ 오드 에너지 부족</div>
                        <div style={{ textAlign: 'center', fontSize: '12px', color: '#ddd', marginBottom: '10px' }}>오드 에너지가 부족합니다.<br />현재 오드 에너지를 입력해주세요. (80 필요)</div>
                        <input type="number" className="modal-input" value={insufficientVal} onChange={e => setInsufficientVal(e.target.value)} onFocus={e => e.target.select()} placeholder="현재 에너지 입력" autoFocus />
                        <button className="modal-btn" style={{ background: 'var(--accent-blue)', color: 'white', border: 'none' }} onClick={solveInsufficient}>확인</button>
                        <button className="modal-btn cancel" onClick={closeModal}>취소</button>
                    </div>
                </div>
            )}

            {activeModal === 'oddItem' && (
                <div className="modal-overlay show" onClick={closeModal}>
                    <div className="modal-menu" onClick={e => e.stopPropagation()}>
                        <div style={{ textAlign: 'center', marginBottom: '10px', fontWeight: 'bold', color: 'var(--accent-blue)', fontSize: '12px' }}>
                            {editingOddType === 'small' ? '작은 오드 (+10)' : '오드 (+40)'} 사용
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', align_items: 'center', gap: '15px', marginBottom: '15px' }}>
                            <div className="odd-input-group" style={{ width: '100%', alignItems: 'center' }}>
                                <label className="odd-input-label">사용할 아이템 수량</label>
                                <input type="number" className="modal-input" style={{ textAlign: 'center', fontSize: '18px' }} value={oddItemQty} onChange={e => setOddItemQty(e.target.value)} onFocus={e => e.target.select()} autoFocus />
                            </div>
                            <div style={{ color: 'var(--accent-green)', fontSize: '16px', fontWeight: 'bold', textAlign: 'center' }}>획득: +{(parseInt(oddItemQty) || 0) * (editingOddType === 'small' ? 10 : 40)} 에너지</div>
                        </div>
                        <button className="modal-btn" style={{ background: 'var(--accent-blue)', color: 'white', border: 'none' }} onClick={() => {
                            const qty = parseInt(oddItemQty) || 0;
                            if (qty > 0) {
                                const gain = qty * (editingOddType === 'small' ? 10 : 40);
                                handleUpdate({ odd_energy_extra: (odd_energy_extra || 0) + gain });
                            }
                            closeModal();
                        }}>확인</button>
                        <button className="modal-btn cancel" onClick={closeModal}>취소</button>
                    </div>
                </div>
            )}

            {activeModal === 'ticketEdit' && (
                <div className="modal-overlay show" onClick={closeModal}>
                    <div className="modal-menu" onClick={e => e.stopPropagation()}>
                        <div style={{ textAlign: 'center', marginBottom: '10px', fontWeight: 'bold', color: 'var(--accent-blue)', fontSize: '12px' }}>수량 직접 수정</div>
                        <div className="odd-form-row">
                            <div className="odd-input-group">
                                <label className="odd-input-label">현재 보유량</label>
                                <input type="number" className="modal-input" value={ticketBaseVal} onChange={e => setTicketBaseVal(parseInt(e.target.value) || 0)} onFocus={e => e.target.select()} autoFocus />
                            </div>
                            <div className="odd-input-group">
                                <label className="odd-input-label">추가 획득량</label>
                                <input type="number" className="modal-input" value={ticketExtraVal} onChange={e => setTicketExtraVal(parseInt(e.target.value) || 0)} onFocus={e => e.target.select()} />
                            </div>
                        </div>
                        <button className="modal-btn" style={{ background: 'var(--accent-blue)', color: 'white', border: 'none' }} onClick={() => {
                            const next = { [editingKey]: ticketBaseVal };
                            if (editingKey !== 'weekly_battlefield' && editingKey !== 'dungeon' && editingKey !== 'ticket_exploration') {
                                next[editingKey + '_extra'] = ticketExtraVal;
                            }
                            handleUpdate(next);
                            closeModal();
                        }}>확인</button>
                        <button className="modal-btn cancel" onClick={closeModal}>취소</button>
                    </div>
                </div>
            )}

            {activeModal === 'settings' && (
                <div className="modal-overlay show" onClick={closeModal}>
                    <div className="modal-menu" onClick={e => e.stopPropagation()} style={{ maxHeight: '95vh', overflowY: 'auto' }}>
                        <div style={{ textAlign: 'center', marginBottom: '15px', fontWeight: 'bold', color: 'var(--accent-blue)', fontSize: '14px' }}>[ "{name}" 캐릭터 숙제 설정 ]</div>
                        <div className="settings-section">
                            <div className="settings-section-title">숙제 노출 설정</div>
                            <div className="settings-list">
                                <div className="settings-section-divider">일일 항목</div>
                                {[{ key: 'daily_sq', label: '사명 퀘스트' }, { key: 'daily_abyss_supply', label: '어비스 보급' }, { key: 'daily_kina', label: '키나 제한' }].map(item => (
                                    <div key={item.key} className="settings-item">
                                        <span>{item.label}</span>
                                        <input type="checkbox" checked={!hidden_keys?.includes(item.key)} onChange={() => {
                                            const next = hidden_keys?.includes(item.key) ? hidden_keys.filter(k => k !== item.key) : [...(hidden_keys || []), item.key];
                                            handleUpdate({ hidden_keys: next });
                                        }} />
                                    </div>
                                ))}
                                <div className="settings-section-divider">주간 항목</div>
                                {[{ key: 'weekly_directive', label: '지령서' }, { key: 'weekly_abyss_directive', label: '어비스 지령' }, { key: 'weekly_abyss_supply', label: '어비스 주간보급' }, { key: 'weekly_battlefield', label: '전장' }, { key: 'weekly_ak', label: '각성전' }, { key: 'weekly_tb', label: '토벌전' }].map(item => (
                                    <div key={item.key} className="settings-item">
                                        <span>{item.label}</span>
                                        <input type="checkbox" checked={!hidden_keys?.includes(item.key)} onChange={() => {
                                            const next = hidden_keys?.includes(item.key) ? hidden_keys.filter(k => k !== item.key) : [...(hidden_keys || []), item.key];
                                            handleUpdate({ hidden_keys: next });
                                        }} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Custom Quest Management Section */}
                        <div className="settings-section">
                            <div className="settings-section-title">커스텀 숙제 관리</div>
                            <div className="settings-list" style={{ gridTemplateColumns: '1fr', marginBottom: '10px' }}>
                                {(custom_quests || []).map((q, qIdx) => (
                                    <div key={qIdx} className="custom-quest-list-item">
                                        <span>{q.name} ({q.type === 'daily' ? '일일' : '주간'})</span>
                                        <span className="btn-delete-custom" onClick={() => handleDeleteCustomQuest(qIdx)}>🗑️</span>
                                    </div>
                                ))}
                                {(custom_quests || []).length === 0 && (
                                    <div style={{ fontSize: '12px', color: '#555', textAlign: 'center', padding: '10px' }}>추가된 커스텀 숙제가 없습니다.</div>
                                )}
                            </div>
                            <div className="custom-quest-form">
                                <div className="custom-quest-row">
                                    <input
                                        type="text"
                                        placeholder="숙제 이름"
                                        value={newCustomName}
                                        onChange={e => setNewCustomName(e.target.value)}
                                        onFocus={e => e.target.select()}
                                    />
                                    <select value={newCustomType} onChange={e => setNewCustomType(e.target.value)}>
                                        <option value="daily">일일</option>
                                        <option value="weekly">주간</option>
                                    </select>
                                </div>
                                <input
                                    type="text"
                                    placeholder="힌트 (예: 매일 05시)"
                                    value={newCustomHint}
                                    onChange={e => setNewCustomHint(e.target.value)}
                                    onFocus={e => e.target.select()}
                                    style={{ background: '#333', border: '1px solid #444', color: '#fff', padding: '6px', borderRadius: '4px', fontSize: '12px' }}
                                />
                                <button className="btn-add-custom" onClick={handleAddCustomQuest}>숙제 추가</button>
                            </div>
                        </div>

                        <button className="modal-btn" style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', marginTop: '10px' }} onClick={closeModal}>확인</button>
                    </div>
                </div>
            )}
        </div>
    );
});

export default CharacterCard;
