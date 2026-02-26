import React, { useState } from 'react';
import { CONFIG } from '../constants';

function EditModal({ data, onSave, onClose }) {
    const [localData, setLocalData] = useState({ ...data });

    const handleFieldChange = (key, val) => {
        setLocalData(prev => ({ ...prev, [key]: val }));
    };

    const handleTicketChange = (key, delta, extra = false) => {
        const field = extra ? `${key}_extra` : key;
        const current = localData[field] || 0;
        const max = CONFIG.TICKET_LIMITS[key.replace('ticket_', '').toUpperCase()] || 99;

        const next = current + delta;
        if (!extra && (next < 0 || next > max)) return;
        if (extra && next < 0) return;

        handleFieldChange(field, next);
    };

    const useOddItem = (amount) => {
        const currentExtra = localData.odd_energy_extra || 0;
        handleFieldChange('odd_energy_extra', currentExtra + amount);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="settings-modal animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h2 style={{ fontSize: '18px', color: 'var(--accent-blue)' }}>{data.name} 정보 수정</h2>
                    <button className="btn-premium btn-icon" onClick={onClose}>✕</button>
                </div>

                {/* Odd Energy Editing */}
                <div className="settings-group">
                    <h3 className="settings-title">🔋 오드 에너지</h3>
                    <div style={{ background: 'hsla(0,0%,100%,0.03)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>기본 (+충전분)</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="number"
                                    value={localData.odd_energy}
                                    onChange={e => handleFieldChange('odd_energy', parseInt(e.target.value) || 0)}
                                    style={{ width: '60px', background: 'black', border: '1px solid var(--border-dim)', color: 'var(--accent-blue)', textAlign: 'center', borderRadius: '4px', fontSize: '14px' }}
                                />
                                <span style={{ color: 'var(--text-muted)' }}>+</span>
                                <input
                                    type="number"
                                    value={localData.odd_energy_extra}
                                    onChange={e => handleFieldChange('odd_energy_extra', parseInt(e.target.value) || 0)}
                                    style={{ width: '60px', background: 'black', border: '1px solid var(--border-dim)', color: 'var(--accent-cyan)', textAlign: 'center', borderRadius: '4px', fontSize: '14px' }}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-premium" style={{ flex: 1, fontSize: '12px' }} onClick={() => useOddItem(10)}>오드 10 사용</button>
                            <button className="btn-premium" style={{ flex: 1, fontSize: '12px' }} onClick={() => useOddItem(40)}>오드 40 사용</button>
                        </div>
                    </div>
                </div>

                {/* Ticket Editing */}
                <div className="settings-group">
                    <h3 className="settings-title">🎫 티켓 수정</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {['conq', 'trans', 'ticket_nightmare', 'ticket_shugo', 'ticket_dimension', 'ticket_exploration'].map(key => {
                            const label = {
                                conq: '정복', trans: '초월', ticket_nightmare: '악몽',
                                ticket_shugo: '슈고', ticket_dimension: '차원', ticket_exploration: '탐험'
                            }[key];
                            const val = localData[key] || 0;
                            const extraVal = localData[`${key}_extra`] || 0;

                            return (
                                <div key={key} className="setting-row" style={{ padding: '8px 12px' }}>
                                    <span style={{ fontSize: '13px' }}>{label}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div className="joycon-box" style={{ width: '80px', height: '26px' }}>
                                            <div className="joycon-grip" onClick={() => handleTicketChange(key, -1)}>-</div>
                                            <div className="joycon-num" style={{ fontSize: '13px' }}>{val}</div>
                                            <div className="joycon-grip" onClick={() => handleTicketChange(key, 1)}>+</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+</span>
                                            <input
                                                type="number"
                                                value={extraVal}
                                                onChange={e => handleFieldChange(`${key}_extra`, parseInt(e.target.value) || 0)}
                                                style={{ width: '40px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-dim)', color: 'var(--accent-cyan)', textAlign: 'center', fontSize: '12px' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                    <button className="btn-premium" style={{ flex: 1, background: 'var(--accent-blue)', color: 'black' }} onClick={() => onSave(localData)}>저장</button>
                    <button className="btn-premium" style={{ flex: 1 }} onClick={onClose}>취소</button>
                </div>
            </div>
        </div>
    );
}

export default EditModal;
