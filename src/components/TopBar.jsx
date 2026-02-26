import React, { useState } from 'react';

function TopBar({ dailyStr, weeklyStr, isMembership, membershipDate, isMembershipExpiringSoon, onAdd, onRemove, onOpenSettings, setMembership, setMembershipDate }) {
    const [showDateInput, setShowDateInput] = useState(false);

    return (
        <header className="top-bar">
            <div className="header-left">
                <div style={{ fontSize: '20px', fontWeight: '700' }}>아이온2 숙제 매니저</div>
                <div className="timer-display">
                    <div className="timer-item"><span>일일:</span><b>{dailyStr}</b></div>
                    <div className="timer-item"><span>수요:</span><b>{weeklyStr}</b></div>
                </div>
            </div>

            <div className="char-controls">
                {/* 멤버십 표시 영역 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRight: '1px solid #444', paddingRight: '10px', marginRight: '4px' }}>
                    <input
                        type="checkbox"
                        id="membershipCheck"
                        checked={isMembership}
                        onChange={e => setMembership(e.target.checked)}
                        style={{ width: '14px', height: '14px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                    />
                    <label htmlFor="membershipCheck" style={{ fontSize: '12px', color: isMembership ? 'var(--accent-cyan)' : '#777', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        💎 멤버십
                    </label>
                    {isMembership && (
                        <>
                            <span
                                style={{ fontSize: '11px', color: isMembershipExpiringSoon ? 'var(--accent-red)' : 'var(--accent-cyan)', cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={() => setShowDateInput(v => !v)}
                                title="날짜 변경"
                            >
                                {membershipDate || '날짜 미설정'}
                            </span>
                            {showDateInput && (
                                <input
                                    type="date"
                                    value={membershipDate}
                                    autoFocus
                                    onFocus={e => e.target.select()}
                                    onChange={e => { setMembershipDate(e.target.value); setShowDateInput(false); }}
                                    onBlur={() => setShowDateInput(false)}
                                    className="modal-input"
                                    style={{ padding: '2px 6px', fontSize: '11px', width: 'auto' }}
                                />
                            )}
                        </>
                    )}
                </div>

                <button className="btn-round" style={{ width: 'auto', padding: '0 8px', fontSize: '12px', background: '#444' }} onClick={onOpenSettings}>콘텐츠 알림 설정</button>
                <button className="btn-round" onClick={onRemove} title="캐릭터 삭제">-</button>
                <button className="btn-round" onClick={onAdd} title="캐릭터 추가">+</button>
            </div>
        </header>
    );
}

export default TopBar;
