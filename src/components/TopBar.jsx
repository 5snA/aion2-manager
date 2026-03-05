import React, { useState } from 'react';
import { formatMembershipDate } from '../utils/timeUtils';

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid #444', paddingRight: '12px', marginRight: '4px' }}>

                    {/* 날짜 표시 영역 (좌측) */}
                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                        <span
                            style={{
                                fontSize: '11px',
                                color: (!isMembership || !membershipDate) ? '#777' : (isMembershipExpiringSoon ? 'var(--accent-red)' : 'var(--accent-cyan)'),
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                fontWeight: 'bold'
                            }}
                            onClick={() => setShowDateInput(v => !v)}
                            title="시작일(결제일) 설정"
                        >
                            {formatMembershipDate(membershipDate)}
                        </span>
                        {showDateInput && (
                            <input
                                type="date"
                                value={membershipDate || ''}
                                autoFocus
                                onFocus={e => e.target.select()}
                                onKeyDown={e => e.key === 'Enter' && setShowDateInput(false)}
                                onChange={e => { setMembershipDate(e.target.value); setShowDateInput(false); }}
                                onBlur={() => setShowDateInput(false)}
                                className="modal-input"
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    marginTop: '4px',
                                    padding: '2px 4px',
                                    fontSize: '11px',
                                    width: '110px',
                                    zIndex: 100
                                }}
                            />
                        )}
                    </div>

                    {/* 멤버십 배지 (우측) */}
                    <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => setMembership(!isMembership)}>
                        <div className={`status-badge ${isMembership ? 'complete' : 'incomplete'}`} style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 'bold', minWidth: '70px', textAlign: 'center' }}>
                            💎 멤버십
                        </div>
                    </div>
                </div>

                <button className="btn-round" style={{ width: 'auto', padding: '0 8px', fontSize: '12px', background: '#444' }} onClick={onOpenSettings}>콘텐츠 알림 설정</button>
                <button className="btn-round" onClick={onRemove} title="캐릭터 삭제">-</button>
                <button className="btn-round" onClick={onAdd} title="캐릭터 추가">+</button>
            </div>
        </header>
    );
}

export default TopBar;
