import React, { useState, useEffect, useRef } from 'react';
import { CONFIG, STORAGE_KEYS } from './constants';
import { processAutoLogic, getDailyRemaining, getWeeklyRemaining, formatTimeDiff } from './utils/timeUtils';
import TopBar from './components/TopBar';
import CharacterCard from './components/CharacterCard';
import SettingsModal from './components/SettingsModal';

function App() {
  const [characters, setCharacters] = useState([]);
  const [isMembership, setIsMembership] = useState(false);
  const [membershipDate, setMembershipDate] = useState('');
  const [isShugoNotify, setIsShugoNotify] = useState(true);
  const [isDimNotify, setIsDimNotify] = useState(true);

  const [dailyTime, setDailyTime] = useState(0);
  const [weeklyTime, setWeeklyTime] = useState(0);
  const [activeEvents, setActiveEvents] = useState([]);
  const eventHistory = useRef({});
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);

  // Initialization
  useEffect(() => {
    let savedData = localStorage.getItem(STORAGE_KEYS.CHARACTERS);
    if (!savedData) {
      const oldData = localStorage.getItem('AION2_TODO_PERSISTENT_V20');
      if (oldData) savedData = oldData;
    }

    let initialChars = [];
    try {
      initialChars = savedData ? JSON.parse(savedData) : [createNewChar("캐릭터 1")];
    } catch (e) {
      initialChars = [createNewChar("캐릭터 1")];
    }

    initialChars = initialChars.map(c => {
      const base = createNewChar(c.name);
      return {
        ...base,
        ...c,
        hidden_keys: c.hidden_keys || base.hidden_keys,
        custom_quests: c.custom_quests || base.custom_quests,
        extra_daily: c.extra_daily || base.extra_daily,
        extra_weekly: c.extra_weekly || base.extra_weekly,
        odd_ts: c.odd_ts || Date.now(),
        last_ts: c.last_ts || Date.now()
      };
    });

    setCharacters(initialChars);
    setIsMembership(localStorage.getItem(STORAGE_KEYS.MEMBERSHIP) === 'true');
    setMembershipDate(localStorage.getItem(STORAGE_KEYS.MEMBERSHIP_DATE) || '');
    setIsShugoNotify(localStorage.getItem(STORAGE_KEYS.SHUGO_NOTIFY) !== 'false');
    setIsDimNotify(localStorage.getItem(STORAGE_KEYS.DIM_NOTIFY) !== 'false');
  }, []);

  // Timer & Auto Logic & Event Tracker
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const currentSecs = now.getSeconds();

      // Top bar time update - simple strings, minimal impact if CharacterCard is memoized
      setDailyTime(getDailyRemaining(now));
      setWeeklyTime(getWeeklyRemaining(now, CONFIG.WeeklyResetDay));

      // Process heavy logic: only every minute (on 0 seconds)
      if (currentSecs === 0) {
        const nowTs = now.getTime();
        setCharacters(prev => {
          if (isMembership && membershipDate) {
            const mDate = new Date(membershipDate).getTime();
            const daysElapsed = (nowTs - mDate) / (1000 * 60 * 60 * 24);
            if (daysElapsed >= 28) {
              setIsMembership(false);
              localStorage.setItem(STORAGE_KEYS.MEMBERSHIP, 'false');
            }
          }
          const result = processAutoLogic(prev, nowTs, isMembership, membershipDate, CONFIG);
          return result !== null ? result : prev;  // null이면 변경 없이 유지
        });
      }

      // Event Tracking Logic
      if (isShugoNotify || isDimNotify) {
        const currentMins = now.getMinutes();
        CONFIG.EVENTS.forEach(event => {
          if (event.id === 'shugo' && !isShugoNotify) return;
          if (event.id === 'dimension' && !isDimNotify) return;

          const checkWindow = (targetMins, duration, type) => {
            for (let tm of targetMins) {
              let diffMins = (currentMins - tm + 60) % 60;
              if (diffMins > 10) continue;
              let elapsed = diffMins * 60 + currentSecs;

              if (elapsed >= 0 && elapsed < duration) {
                const stableKey = `${event.id}_${type}_${now.getDate()}_${now.getHours()}_${tm}`;
                if (!eventHistory.current[stableKey]) {
                  eventHistory.current[stableKey] = true;
                  setActiveEvents(prev => [...prev, { ...event, type, stableKey }]);
                }
              }
            }
          };

          checkWindow(event.alertMins, event.alertDuration, 'alert');
          checkWindow(event.checkMins, event.checkDuration, 'check');
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isMembership, membershipDate, isShugoNotify, isDimNotify]);

  // Persist
  useEffect(() => {
    if (characters.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(characters));
    }
  }, [characters]);

  function createNewChar(name) {
    return {
      name: name,
      char_class: '직업선택',
      odd_energy: 0,
      odd_energy_extra: 0,
      odd_ts: Date.now(),
      last_ts: Date.now(),
      daily_sq: false, daily_kina: false, daily_abyss_supply: false,
      dungeon: CONFIG.TICKET_LIMITS.DUNGEON, dungeon_extra: 0,
      weekly_ak: false, weekly_tb: false, weekly_directive: false,
      weekly_abyss_directive: false, weekly_abyss_supply: false,
      weekly_battlefield: 0,
      weekly_odd_buy: false, weekly_odd_craft: false,
      conq: CONFIG.TICKET_LIMITS.CONQ, conq_extra: 0,
      trans: CONFIG.TICKET_LIMITS.TRANS, trans_extra: 0,
      ticket_nightmare: CONFIG.TICKET_LIMITS.NIGHTMARE, ticket_nightmare_extra: 0,
      ticket_shugo: CONFIG.TICKET_LIMITS.SHUGO, ticket_shugo_extra: 0,
      ticket_dimension: CONFIG.TICKET_LIMITS.DIMENSION, ticket_dimension_extra: 0,
      ticket_exploration: 0, ticket_exploration_extra: 0,
      abyss_lower: false, abyss_middle: false,
      hidden_keys: [],
      custom_quests: [],
      extra_daily: Array.from({ length: 4 }, () => ({ name: '', val: false })),
      extra_weekly: Array.from({ length: 1 }, () => ({ name: '', val: false }))
    };
  }

  const addCharacter = () => {
    setCharacters([...characters, createNewChar(`캐릭터 ${characters.length + 1}`)]);
  };

  const removeCharacter = () => {
    if (characters.length <= 1) return;
    if (window.confirm("마지막 캐릭터를 삭제하시겠습니까?")) {
      setCharacters(characters.slice(0, -1));
    }
  };

  const [dragIdx, setDragIdx] = useState(null);
  const onDragStart = (idx) => setDragIdx(idx);
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (targetIdx) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    setCharacters(prev => {
      const next = [...prev];
      const item = next.splice(dragIdx, 1)[0];
      next.splice(targetIdx, 0, item);
      return next;
    });
    setDragIdx(null);
  };

  const updateCharacter = (idx, newData) => {
    setCharacters(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...newData };
      return next;
    });
  };


  return (
    <div className="app-container animate-fade-in">
      <TopBar
        dailyStr={formatTimeDiff(dailyTime)}
        weeklyStr={formatTimeDiff(weeklyTime, true)}
        isMembership={isMembership}
        membershipDate={membershipDate}
        isMembershipExpiringSoon={isMembership && membershipDate && (Date.now() - new Date(membershipDate).getTime()) / (1000 * 60 * 60 * 24) >= 27}
        onAdd={addCharacter}
        onRemove={removeCharacter}
        onOpenSettings={() => setIsSystemSettingsOpen(true)}
        setMembership={(val) => { setIsMembership(val); localStorage.setItem(STORAGE_KEYS.MEMBERSHIP, val ? 'true' : 'false'); }}
        setMembershipDate={(val) => { setMembershipDate(val); localStorage.setItem(STORAGE_KEYS.MEMBERSHIP_DATE, val); }}
      />

      <div className="character-grid">
        {characters.map((char, idx) => (
          <CharacterCard
            key={char.id || idx}
            index={idx}
            data={char}
            updateData={(newData) => updateCharacter(idx, newData)}
            onDragStart={() => onDragStart(idx)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(idx)}
          />
        ))}
      </div>

      {activeEvents.map((evt, eIdx) => (
        <div key={evt.stableKey} className="event-overlay" onClick={() => setActiveEvents(prev => prev.filter((_, i) => i !== eIdx))}>
          <div className="event-popup" onClick={e => e.stopPropagation()}>
            <div className="event-title">{evt.type === 'alert' ? '🔔' : '🎫'} {evt.name} {evt.type === 'alert' ? '참여!' : '체크'}</div>
            <div className="event-message">
              {evt.type === 'alert' ? '입장 시간입니다!<br>티켓 보유 현황을 확인하세요.' : '참여한 캐릭터를 선택해주세요.<br>(티켓이 1 차감됩니다)'}
            </div>

            <div className="event-char-list">
              {characters.map((char, cIdx) => {
                const val = char[evt.ticketKey] || 0;
                const extra = char[evt.ticketKey + '_extra'] || 0;
                const displayVal = extra > 0 ? `${val}(+${extra})` : `${val}`;
                const icon = CONFIG.CLASS_ICONS[char.char_class] || '';

                return evt.type === 'check' ? (
                  <button key={cIdx} className="event-char-btn" onClick={() => {
                    if (val > 0) {
                      updateCharacter(cIdx, { [evt.ticketKey]: val - 1 });
                      setActiveEvents(prev => prev.filter((_, i) => i !== eIdx));
                    } else {
                      alert("티켓이 부족합니다.");
                    }
                  }}>
                    <span>{icon} {char.name}</span>
                    <span className="counter-val">{displayVal}</span>
                  </button>
                ) : (
                  <div key={cIdx} className="event-char-btn" style={{ cursor: 'default' }}>
                    <span>{icon} {char.name}</span>
                    <span className="counter-val">{displayVal}</span>
                  </div>
                );
              })}
            </div>

            <button className="modal-btn" style={{ marginTop: '10px' }} onClick={() => setActiveEvents(prev => prev.filter((_, i) => i !== eIdx))}>
              {evt.type === 'alert' ? '확인 (닫기)' : '진행하지 않았음 / 닫기'}
            </button>
          </div>
        </div>
      ))}

      {isSystemSettingsOpen && (
        <SettingsModal
          isShugoNotify={isShugoNotify}
          isDimNotify={isDimNotify}
          setShugoNotify={(val) => {
            setIsShugoNotify(val);
            localStorage.setItem(STORAGE_KEYS.SHUGO_NOTIFY, val ? 'true' : 'false');
          }}
          setDimNotify={(val) => {
            setIsDimNotify(val);
            localStorage.setItem(STORAGE_KEYS.DIM_NOTIFY, val ? 'true' : 'false');
          }}
          onClose={() => setIsSystemSettingsOpen(false)}
        />
      )}


      <div className="backup-bar">
        <button className="backup-btn" onClick={() => {
          const dummy = document.createElement("textarea"); document.body.appendChild(dummy);
          dummy.value = JSON.stringify(characters); dummy.select(); document.execCommand("copy");
          document.body.removeChild(dummy); alert("클립보드에 복사되었습니다.");
        }}>데이터 백업 (클립보드 복사)</button>
        <button className="backup-btn" onClick={() => {
          const code = prompt("백업 코드를 입력하세요:");
          if (code) {
            try {
              const parsed = JSON.parse(code);
              if (Array.isArray(parsed)) {
                setCharacters(parsed);
                alert("데이터가 복구되었습니다.");
              }
            } catch (e) { alert("오류: 잘못된 형식입니다."); }
          }
        }}>데이터 복구 (붙여넣기)</button>
        <button className="backup-btn download" onClick={() => {
          const dataStr = JSON.stringify(characters, null, 2);
          const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
          const exportFileDefaultName = 'aion2_manager_backup_' + new Date().toISOString().slice(0, 10) + '.json';
          const linkElement = document.createElement('a');
          linkElement.setAttribute('href', dataUri);
          linkElement.setAttribute('download', exportFileDefaultName);
          linkElement.click();
        }}>백업 파일 다운로드 (.json)</button>
      </div>
    </div>
  );
}

export default App;
