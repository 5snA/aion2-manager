import React from 'react';

function SettingsModal({ isShugoNotify, isDimNotify, setShugoNotify, setDimNotify, onClose }) {
    return (
        <div className="modal-overlay show" onClick={onClose}>
            <div className="modal-menu" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px', padding: '24px' }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ color: 'var(--accent-blue)', fontSize: '15px', fontWeight: 'bold' }}>🔔 콘텐츠 알림 설정</div>
                    <div style={{ fontSize: '12px', color: '#777', marginTop: '4px' }}>이벤트 알림을 개별로 설정합니다.</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #2a2a2a' }}>
                    <span style={{ fontSize: '14px' }}>슈고페스타 알림</span>
                    <input
                        type="checkbox"
                        checked={isShugoNotify}
                        onChange={e => setShugoNotify(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                    <span style={{ fontSize: '14px' }}>차원침공 알림</span>
                    <input
                        type="checkbox"
                        checked={isDimNotify}
                        onChange={e => setDimNotify(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
                    />
                </div>

                <button
                    className="modal-btn"
                    style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', width: '100%', padding: '12px', marginTop: '16px' }}
                    onClick={onClose}
                >
                    닫기
                </button>
            </div>
        </div>
    );
}

export default SettingsModal;
