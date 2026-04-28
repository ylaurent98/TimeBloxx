// Direction A: Swiss editorial bento
// Black hairlines on cream, monospace labels, serif display, single accent
// Personality leans into "morning briefing" — running numbers, footnotes

const { useState: useStateA } = React;

const THEMES_A = {
  juicy: { label: 'Juicy', swatch: ['#ffd5b8', '#4a1a5e', '#00a896'] },
  citrus: { label: 'Seaside', swatch: ['#fff4d6', '#0b4a8f', '#ff7a1a'] },
  bubblegum: { label: 'Bubblegum', swatch: ['#ffd6e8', '#1a3a52', '#ff4d9d'] },
};

function DirectionA() {
  const d = window.dashboardData;
  const [tasks, setTasks] = useStateA(d.notion.tasks);
  const [theme, setTheme] = useStateA('juicy');
  const [widgets, setWidgets] = useStateA([
    'briefing', 'kahnbahn', 'tasks', 'fitness-ring', 'notion-pinned',
    'week-run', 'wip', 'weather', 'note',
  ]);
  const [adding, setAdding] = useStateA(false);

  const ALL_WIDGETS = {
    'briefing': 'Briefing',
    'kahnbahn': 'Kahnbahn board',
    'tasks': 'Tasks',
    'fitness-ring': 'Whoop rings',
    'notion-pinned': 'Pinned docs',
    'week-run': 'Weekly mileage',
    'wip': 'WIP & shipped',
    'weather': 'Weather',
    'note': 'Margin note',
    'last-run': 'Last activity',
    'shipped': 'Shipped this week',
    'review': 'Weekly review',
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };
  const removeWidget = (key) => setWidgets(widgets.filter(w => w !== key));
  const addWidget = (key) => {
    if (!widgets.includes(key)) setWidgets([...widgets, key]);
    setAdding(false);
  };

  const moveRingPct = pct(d.fitness.todayMoveKcal, d.fitness.moveGoalKcal);
  const stepPct = pct(d.fitness.todaySteps, d.fitness.stepsGoal);
  const standPct = pct(d.fitness.standHours, d.fitness.standGoal);
  const weekPct = pct(d.fitness.weekDistanceKm, d.fitness.weekGoalKm);

  return (
    <div className={`dirA dirA-theme-${theme}`}>
      <div className="dirA-themebar" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        <span className="dirA-themebar-label">Theme</span>
        {Object.entries(THEMES_A).map(([k, t]) => (
          <button
            key={k}
            className={`dirA-themechip ${theme === k ? 'is-active' : ''}`}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setTheme(k); }}
            title={t.label}
          >
            <span className="dirA-themechip-bg" style={{ background: t.swatch[0] }}></span>
            <span className="dirA-themechip-fg" style={{ background: t.swatch[1] }}></span>
            <span className="dirA-themechip-ac" style={{ background: t.swatch[2] }}></span>
          </button>
        ))}
      </div>
      <header className="dirA-header">
        <div className="dirA-masthead">
          <div className="dirA-title">The Daily Index</div>
          <div className="dirA-subtitle">A personal dispatch · Vol. 4, No. 118</div>
        </div>
        <div className="dirA-meta">
          <div><span className="dirA-mlabel">Date</span> {d.user.date}</div>
          <div><span className="dirA-mlabel">Local</span> {d.user.localTime} {d.user.timezone}</div>
          <div><span className="dirA-mlabel">Outside</span> {d.weather.tempC}°C · {d.weather.condition.toLowerCase()}</div>
          <div><span className="dirA-mlabel">Day</span> {d.user.dayOfYear} of 366</div>
        </div>
      </header>

      <div className="dirA-rule"></div>

      <div className="dirA-grid">
        {widgets.includes('briefing') && (
          <Card key="briefing" area="briefing" label="01 — Briefing" onRemove={() => removeWidget('briefing')}>
            <div className="dirA-briefing">
              <div className="dirA-greet">Morning, {d.user.name}.</div>
              <p>
                <strong>{d.kahnbahn.cards.filter(c => c.col === 'doing').length} cards</strong> in progress on the board, two due today.
                Recovery's <strong>{d.whoop.recovery}%</strong> — you have headroom to push.
              </p>
              <div className="dirA-briefing-quote">
                <div className="dirA-briefing-quote-text">"{d.quote.text}"</div>
                <div className="dirA-briefing-quote-attr">— {d.quote.author}</div>
              </div>
            </div>
          </Card>
        )}

        {widgets.includes('kahnbahn') && (
          <Card key="kahnbahn" area="train" label={`02 — Kahnbahn · ${d.kahnbahn.boardName}`} onRemove={() => removeWidget('kahnbahn')}>
            <div className="dirA-board">
              {d.kahnbahn.columns.map(col => {
                const cards = d.kahnbahn.cards.filter(c => c.col === col.id);
                return (
                  <div key={col.id} className="dirA-board-col">
                    <div className="dirA-board-colhead">
                      <span className="dirA-board-colname">{col.name}</span>
                      <span className="dirA-board-colcount">{cards.length}</span>
                    </div>
                    <div className="dirA-board-stack">
                      {cards.slice(0, 4).map(c => (
                        <div key={c.id} className={`dirA-board-card ${c.priority === 'high' ? 'is-priority' : ''} ${col.id === 'done' ? 'is-done' : ''}`}>
                          <div className="dirA-board-card-title">{c.title}</div>
                          <div className="dirA-board-card-meta">
                            <span className="dirA-board-label">{c.label}</span>
                            {c.due && <span className="dirA-board-due">{c.due}</span>}
                            {c.completedAt && <span className="dirA-board-due">{c.completedAt}</span>}
                          </div>
                        </div>
                      ))}
                      {cards.length > 4 && (
                        <div className="dirA-board-more">+{cards.length - 4} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {widgets.includes('tasks') && (
          <Card key="tasks" area="tasks" label="03 — Notion · today" onRemove={() => removeWidget('tasks')}>
            <ul className="dirA-tasks">
              {tasks.map(t => (
                <li key={t.id} className={`dirA-task ${t.done ? 'is-done' : ''}`} onClick={() => toggleTask(t.id)}>
                  <div className={`dirA-check dirA-check-${t.priority}`}>
                    {t.done ? '×' : ''}
                  </div>
                  <div className="dirA-task-body">
                    <div className="dirA-task-title">{t.title}</div>
                    <div className="dirA-task-meta">{t.project} · due {t.due}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="dirA-footnote">{tasks.filter(t=>!t.done).length} open · click to toggle</div>
          </Card>
        )}

        {widgets.includes('fitness-ring') && (
          <Card key="fitness-ring" area="rings" label="04 — Whoop · today" onRemove={() => removeWidget('fitness-ring')}>
            <div className="dirA-rings">
              <RingA pct={d.whoop.recovery} label="RECOVERY" value={`${d.whoop.recovery}%`} unit={d.whoop.recoveryColor} goal="" colorClass={`dirA-ring-${d.whoop.recoveryColor}`} />
              <RingA pct={pct(d.whoop.strain, 21)} label="STRAIN" value={d.whoop.strain.toFixed(1)} unit={`/ ${d.whoop.strainTarget} target`} goal="" colorClass="dirA-ring-strain" />
              <RingA pct={d.whoop.sleepPerformance} label="SLEEP" value={`${d.whoop.sleepPerformance}%`} unit={`${d.whoop.sleepHours}h slept`} goal="" colorClass="dirA-ring-sleep" />
            </div>
            <div className="dirA-fitness-meta">
              <div><span className="dirA-mlabel">HRV</span> {d.whoop.hrv} ms <span className="dirA-mlabel" style={{marginLeft: 4}}>vs base</span> {d.whoop.hrvBaseline}</div>
              <div><span className="dirA-mlabel">RHR</span> {d.whoop.rhr} bpm · <span className="dirA-mlabel">SpO₂</span> {d.whoop.spo2}%</div>
              <div><span className="dirA-mlabel">Sleep debt</span> {d.whoop.sleepDebt}h · <span className="dirA-mlabel">Skin temp</span> {d.whoop.skinTempDeltaC}°C</div>
            </div>
          </Card>
        )}

        {widgets.includes('notion-pinned') && (
          <Card key="notion-pinned" area="pinned" label="05 — Notion · pinned" onRemove={() => removeWidget('notion-pinned')}>
            <ul className="dirA-pinned">
              {d.notion.pinned.map((p, i) => (
                <li key={i} className="dirA-pin">
                  <div className="dirA-pin-num">{String(i+1).padStart(2,'0')}</div>
                  <div className="dirA-pin-body">
                    <div className="dirA-pin-title">{p.title}</div>
                    <div className="dirA-pin-meta">{p.words} words · {p.updated}</div>
                  </div>
                  <div className="dirA-pin-arrow">→</div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {widgets.includes('week-run') && (
          <Card key="week-run" area="week" label="06 — Strava · week" onRemove={() => removeWidget('week-run')}>
            <div className="dirA-week-top">
              <div>
                <div className="dirA-bignum">{d.fitness.weekDistanceKm}<span className="dirA-bigunit">km</span></div>
                <div className="dirA-week-goal">of {d.fitness.weekGoalKm}km goal · {weekPct}%</div>
              </div>
              <div className="dirA-week-bars">
                {d.fitness.weekActivities.map((a, i) => (
                  <div key={i} className="dirA-bar-wrap">
                    <div className="dirA-bar" style={{ height: `${(a.km / 8) * 100}%` }}></div>
                    <div className="dirA-bar-label">{a.day}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="dirA-footnote">↳ {d.fitness.nextWorkout}</div>
          </Card>
        )}

        {widgets.includes('wip') && (() => {
          const focus = d.kahnbahn.cards.find(c => c.id === d.kahnbahn.activeFocus);
          const doingCount = d.kahnbahn.cards.filter(c => c.col === 'doing').length;
          return (
            <Card key="wip" area="pass" label="07 — In focus" onRemove={() => removeWidget('wip')}>
              <div className="dirA-wip">
                <div className="dirA-wip-meta">
                  <span className="dirA-mlabel">Now</span>
                  <span className="dirA-wip-count">{doingCount} / {d.kahnbahn.wipLimit} WIP</span>
                </div>
                <div className="dirA-wip-title">{focus?.title || '—'}</div>
                <div className="dirA-wip-card-meta">
                  <span className="dirA-board-label">{focus?.label}</span>
                  {focus?.due && <span className="dirA-board-due">due {focus.due}</span>}
                </div>
              </div>
              <div className="dirA-footnote">↳ from "{d.kahnbahn.boardName}" board</div>
            </Card>
          );
        })()}

        {widgets.includes('weather') && (
          <Card key="weather" area="weather" label="08 — Weather" onRemove={() => removeWidget('weather')}>
            <div className="dirA-weather">
              <div className="dirA-weather-temp">{d.weather.tempC}°</div>
              <div className="dirA-weather-meta">
                <div>{d.weather.condition}</div>
                <div className="dirA-mlabel">H {d.weather.high}° · L {d.weather.low}° · sunset {d.weather.sunset}</div>
              </div>
            </div>
          </Card>
        )}

        {widgets.includes('note') && (
          <Card key="note" area="note" label="09 — Margin note" onRemove={() => removeWidget('note')}>
            <div className="dirA-note">
              <em>"You only have to do the very best you can."</em>
              <div className="dirA-note-attr">— pinned to your desk, March 2024</div>
            </div>
          </Card>
        )}

        {widgets.includes('last-run') && (
          <Card key="last-run" area="lastrun" label="10 — Last activity" onRemove={() => removeWidget('last-run')}>
            <div className="dirA-lastrun">
              <div className="dirA-lastrun-type">{d.fitness.lastActivity.type}</div>
              <div className="dirA-lastrun-route">{d.fitness.lastActivity.route} · {d.fitness.lastActivity.whenLabel}</div>
              <div className="dirA-lastrun-stats">
                <div><div className="dirA-stat">{d.fitness.lastActivity.distanceKm}</div><div className="dirA-mlabel">km</div></div>
                <div><div className="dirA-stat">{d.fitness.lastActivity.paceMinPerKm}</div><div className="dirA-mlabel">min/km</div></div>
                <div><div className="dirA-stat">{d.fitness.lastActivity.durationMin}</div><div className="dirA-mlabel">min</div></div>
              </div>
            </div>
          </Card>
        )}

        {widgets.includes('shipped') && (
          <Card key="shipped" area="co2" label="11 — Shipped this week" onRemove={() => removeWidget('shipped')}>
            <div className="dirA-co2">
              <div><div className="dirA-bignum">{d.kahnbahn.shippedThisWeek}<span className="dirA-bigunit">cards</span></div><div className="dirA-mlabel">closed</div></div>
              <div><div className="dirA-bignum">{d.kahnbahn.cards.filter(c => c.col === 'backlog').length}<span className="dirA-bigunit">left</span></div><div className="dirA-mlabel">in backlog</div></div>
            </div>
          </Card>
        )}

        {widgets.includes('review') && (
          <Card key="review" area="review" label="12 — Weekly review" onRemove={() => removeWidget('review')}>
            <div className="dirA-review">
              <div>Next review: <strong>{d.notion.weeklyReview.dueIn}</strong></div>
              <div className="dirA-mlabel">{d.notion.weeklyReview.completedThisWeek} done · {d.notion.weeklyReview.carriedOver} carried over</div>
            </div>
          </Card>
        )}

        {/* Add widget tile */}
        <div className="dirA-add-tile">
          {!adding && (
            <button className="dirA-add-btn" onClick={() => setAdding(true)}>
              <span className="dirA-add-plus">+</span>
              <span>Add a widget</span>
            </button>
          )}
          {adding && (
            <div className="dirA-add-list">
              <div className="dirA-add-head">
                <span>Widgets</span>
                <button className="dirA-add-close" onClick={() => setAdding(false)}>close</button>
              </div>
              {Object.entries(ALL_WIDGETS).filter(([k]) => !widgets.includes(k)).map(([k, label]) => (
                <button key={k} className="dirA-add-item" onClick={() => addWidget(k)}>
                  <span className="dirA-add-key">+</span> {label}
                </button>
              ))}
              {Object.entries(ALL_WIDGETS).filter(([k]) => !widgets.includes(k)).length === 0 && (
                <div className="dirA-add-empty">All widgets are out. The page is full.</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="dirA-rule"></div>
      <footer className="dirA-footer">
        <div>The Daily Index — for {d.user.name} only</div>
        <div>{d.user.week} · {d.user.daysLeftInYear} days remaining in the year</div>
      </footer>
    </div>
  );
}

function Card({ children, area, label, onRemove }) {
  return (
    <div className="dirA-card" style={{ gridArea: area }}>
      <div className="dirA-cardhead">
        <span className="dirA-cardlabel">{label}</span>
        <button className="dirA-cardx" onClick={onRemove} title="Remove widget">×</button>
      </div>
      <div className="dirA-cardbody">{children}</div>
    </div>
  );
}

function RingA({ pct, label, value, unit, goal, colorClass }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className={`dirA-ring ${colorClass || ''}`}>
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="4" />
        <circle
          cx="42" cy="42" r={r} fill="none"
          stroke="currentColor" strokeWidth="4" strokeLinecap="butt"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 42 42)"
        />
        <text x="42" y="46" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="13" fontWeight="600" fill="currentColor">{pct}%</text>
      </svg>
      <div className="dirA-ring-label">{label}</div>
      <div className="dirA-ring-val">{value}{unit && goal !== '' ? <span className="dirA-mlabel"> / {goal} {unit}</span> : unit ? <span className="dirA-mlabel"> {unit}</span> : null}</div>
    </div>
  );
}

window.DirectionA = DirectionA;
