"use client"
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Laptop,
  Moon,
  Plus,
  RotateCcw,
  Settings,
  Sun,
  Target,
  Trash2,
  FolderPlus,
  ChevronDown,
} from 'lucide-react';

const STORAGE_KEY = 'life-reset-tracker-v11';
const COUNTDOWN_MOMENTUM_WEIGHT = 0.2;

const countdownSwatches = {
  red: {
    card: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-700 hover:bg-red-100',
    fill: 'bg-red-200/60',
    swatch: 'bg-red-200',
    ring: 'ring-red-300',
  },
  blue: {
    card: 'bg-blue-50 border-blue-200',
    badge: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    fill: 'bg-blue-200/60',
    swatch: 'bg-blue-200',
    ring: 'ring-blue-300',
  },
  green: {
    card: 'bg-emerald-50 border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
    fill: 'bg-emerald-200/60',
    swatch: 'bg-emerald-200',
    ring: 'ring-emerald-300',
  },
  yellow: {
    card: 'bg-yellow-50 border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
    fill: 'bg-yellow-200/60',
    swatch: 'bg-yellow-200',
    ring: 'ring-yellow-300',
  },
  purple: {
    card: 'bg-purple-50 border-purple-200',
    badge: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
    fill: 'bg-purple-200/60',
    swatch: 'bg-purple-200',
    ring: 'ring-purple-300',
  },
};

const dailyBlockSuggestions = ['Morning Routine', 'Work', 'Night Routine'];
const weeklyBlockSuggestions = ['Weekly Plan', 'Reset', 'Sunday Reset', 'Weekly Reset', 'Pipeline Review', 'Clothes Prep'];

const getTodayKey = (date = new Date()) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Returns the "effective" date key — if we're before (wakeTime - 4h), still treat as yesterday
const getEffectiveDateKey = (wakeTimeStr = '05:30') => {
  const now = new Date();
  const [wakeH, wakeM] = (wakeTimeStr || '05:30').split(':').map(Number);
  const resetMinutes = wakeH * 60 + wakeM - 240; // 4 hours before wake
  if (resetMinutes >= 0) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes < resetMinutes) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return getTodayKey(yesterday);
    }
  }
  return getTodayKey(now);
};

const parseKey = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getWeekKey = (date = new Date()) => {
  const d = new Date(date);
  const firstJan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - firstJan) / 86400000);
  const week = Math.ceil((days + firstJan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
};

const formatCountdownDate = (dateKey) => {
  const d = parseKey(dateKey);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
};

const formatLongDate = (dateKey) => {
  const date = parseKey(dateKey);
  return date.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const getMonthMatrix = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
};

const getWeekDates = (date = new Date()) => {
  const base = new Date(date);
  const day = base.getDay();
  const sunday = new Date(base);
  sunday.setDate(base.getDate() - day);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(sunday);
    current.setDate(sunday.getDate() + index);
    return current;
  });
};

const defaultDailyTemplate = [
  { id: 'morning-1', label: 'Wake up and get moving', section: 'Morning' },
  { id: 'morning-2', label: 'Get dressed and ready', section: 'Morning' },
  { id: 'morning-3', label: 'Take morning supplements / vitamins', section: 'Morning' },
  { id: 'work-1', label: 'Work on top priority task', section: 'Deep Work' },
  { id: 'work-2', label: 'No-distraction focus block (60+ min)', section: 'Deep Work' },
  { id: 'work-3', label: 'Review progress and adjust plan', section: 'Deep Work' },
  { id: 'evening-1', label: 'Review the day — what got done?', section: 'Evening' },
  { id: 'evening-2', label: 'Wind down and prep for tomorrow', section: 'Evening' },
];

const defaultWeeklyTemplate = [
  { id: 'week-1', label: 'Plan the week — set your #1 goal', section: 'Weekly Plan' },
  { id: 'week-2', label: 'Review last week — wins and lessons', section: 'Weekly Plan' },
  { id: 'week-3', label: 'Set your top priorities for the week', section: 'Weekly Plan' },
  { id: 'reset-1', label: 'Clean your workspace', section: 'Reset' },
  { id: 'reset-2', label: 'Prep anything you need for the week ahead', section: 'Reset' },
];

const grouped = (items) =>
  items.reduce((acc, item) => {
    acc[item.section] = acc[item.section] || [];
    acc[item.section].push(item);
    return acc;
  }, {});

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyMetrics = () => ({
  calls: '',
  texts: '',
  appointments: '',
  shows: '',
  deals: '',
  gross: '',
});

const defaultTargets = {
  calls: '',
  texts: '',
  appointments: '',
  shows: '',
  deals: '',
};

const defaultMetricLabels = {
  calls: '',
  texts: '',
  appointments: '',
  shows: '',
  deals: '',
  gross: '',
};

const emptyCountdown = {
  title: '',
  startDate: '',
  endDate: '',
  color: 'purple',
  includeInMomentum: false,
};

const defaultCountdown = emptyCountdown;

const defaultWeeklyRoutine = {
  Sunday: {
    note: 'Plan your week ahead.',
    items: [
      { id: 'sun-1', text: 'Set weekly priorities', done: false },
    ],
  },
  Monday: { note: '', items: [] },
  Tuesday: { note: '', items: [] },
  Wednesday: { note: '', items: [] },
  Thursday: { note: '', items: [] },
  Friday: { note: '', items: [] },
  Saturday: { note: '', items: [] },
};

const defaultOutcome = () => ({
  id: createId(),
  label: '',
  startingValue: '',
  endingValue: '',
  currentValue: '',
  unit: '',
  unitPosition: 'suffix',
  progressType: 'increase',
  placement: 'both',
});

const seededOutcomes = [];

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const normalizeRoutineDay = (val) => ({
  note: val?.note || '',
  items: Array.isArray(val?.items) ? val.items : [],
});

const normalizeOutcome = (val) => ({
  id: val?.id || createId(),
  label: val?.label || '',
  startingValue: val?.startingValue || '',
  endingValue: val?.endingValue || '',
  currentValue: val?.currentValue || '',
  unit: val?.unit || '',
  unitPosition: val?.unitPosition === 'prefix' ? 'prefix' : 'suffix',
  progressType: val?.progressType === 'decrease' ? 'decrease' : 'increase',
  placement: ['daily', 'scoreboard', 'both'].includes(val?.placement) ? val.placement : 'both',
});

const formatWeekRange = (dates) => {
  if (!dates?.length) return '';
  const first = dates[0];
  const last = dates[6];
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  if (sameMonth) {
    return `${first.toLocaleDateString([], { month: 'short' })} ${first.getDate()} – ${last.getDate()}, ${last.getFullYear()}`;
  }
  return `${first.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

const formatOutcomeValue = (value, unit, unitPosition) => {
  const normalizedValue = value || '0';
  const normalizedUnit = unit || '';
  if (!normalizedUnit) return normalizedValue;
  return unitPosition === 'prefix' ? `${normalizedUnit}${normalizedValue}` : `${normalizedValue} ${normalizedUnit}`;
};

const calculateOutcomeProgress = (outcome) => {
  const start = Number(outcome.startingValue);
  const end = Number(outcome.endingValue);
  const current = Number(outcome.currentValue);

  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(current)) return 0;
  if (start === end) return 100;

  if (outcome.progressType === 'decrease') {
    if (current <= end) return 100;
    const denominator = start - end;
    if (denominator <= 0) return 0;
    const numerator = start - current;
    return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)));
  }

  if (current >= end) return 100;
  const denominator = end - start;
  if (denominator <= 0) return 0;
  const numerator = current - start;
  return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)));
};

const calculateOverallCountdownProgress = (outcomes) => {
  if (!outcomes.length) return 0;
  const total = outcomes.reduce((sum, outcome) => sum + calculateOutcomeProgress(outcome), 0);
  return Math.round(total / outcomes.length);
};

const isCountdownConfigured = (countdown) => {
  return Boolean(countdown?.title?.trim() && countdown?.startDate && countdown?.endDate);
};

const normalizeDayPlan = (val) => {
  if (!val) return { note: '', items: [] };
  if (typeof val === 'string') return { note: val, items: [] };
  return { note: val.note || '', items: Array.isArray(val.items) ? val.items : [] };
};

const getCountdownStats = (countdown, referenceDateKey = getTodayKey()) => {
  const start = parseKey(countdown.startDate);
  const end = parseKey(countdown.endDate);
  const reference = parseKey(referenceDateKey);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return { totalDays: 0, dayNumber: 0, valid: false };
  }

  const totalDays = Math.floor((end - start) / 86400000) + 1;
  let dayNumber = 0;

  if (reference < start) dayNumber = 0;
  else if (reference > end) dayNumber = totalDays;
  else dayNumber = Math.floor((reference - start) / 86400000) + 1;

  return { totalDays, dayNumber, valid: true };
};

function runUtilitySelfTests() {
  const tests = [
    () => getTodayKey(new Date(2026, 3, 9)) === '2026-04-09',
    () => parseKey('2026-04-09').getFullYear() === 2026,
    () => parseKey('2026-04-09').getMonth() === 3,
    () => parseKey('2026-04-09').getDate() === 9,
    () => getWeekDates(new Date(2026, 3, 9)).length === 7,
    () => normalizeDayPlan('hello').note === 'hello',
    () => Array.isArray(getMonthMatrix(new Date(2026, 3, 1))),
    () => normalizeRoutineDay(null).items.length === 0,
    () => formatWeekRange(getWeekDates(new Date(2026, 3, 9))).includes('2026'),
    () => normalizeOutcome(null).unitPosition === 'suffix',
    () => calculateOutcomeProgress({ startingValue: '0', endingValue: '100', currentValue: '50', progressType: 'increase' }) === 50,
    () => calculateOutcomeProgress({ startingValue: '265', endingValue: '205', currentValue: '235', progressType: 'decrease' }) === 50,
    () => isCountdownConfigured({ title: 'Reset', startDate: '2026-04-10', endDate: '2026-06-09' }) === true,
    () => isCountdownConfigured(emptyCountdown) === false,
    () => calculateOverallCountdownProgress(seededOutcomes) === 0,
  ];

  const failed = tests.findIndex((test) => !test());
  if (failed !== -1) {
    throw new Error(`Utility self-test failed at index ${failed}`);
  }
}

try {
  runUtilitySelfTests();
} catch (error) {
  console.error(error);
}

const SectionCard = ({ title, items, state, onToggle }) => {
  const [reopened, setReopened] = useState(false);
  const completedCount = items.filter((item) => state[item.id]).length;
  const progress = items.length ? Math.round((completedCount / items.length) * 100) : 0;
  const isComplete = items.length > 0 && completedCount === items.length;
  const showContent = !isComplete || reopened;

  useEffect(() => {
    if (!isComplete) setReopened(false);
  }, [isComplete]);

  return (
    <motion.div layout transition={{ type: 'spring', stiffness: 120, damping: 20 }}>
      <Card className={`rounded-2xl border shadow-none transition-colors ${isComplete ? 'border-emerald-300 bg-emerald-50' : ''}`}>
        <CardHeader
          className={isComplete ? 'cursor-pointer select-none' : ''}
          onDoubleClick={() => isComplete && setReopened((prev) => !prev)}
        >
          <div className="flex items-center justify-between gap-3">
            <CardTitle className={`text-base ${isComplete ? 'text-emerald-700' : ''}`}>{title}</CardTitle>
            <Badge className={`rounded-full px-3 py-1 ${isComplete ? 'bg-emerald-600 text-white hover:bg-emerald-600' : ''}`}>
              {isComplete ? 'Completed 100%' : `${progress}%`}
            </Badge>
          </div>
          {isComplete && (
            <p className="mt-0.5 text-xs text-emerald-600">Double-tap to {reopened ? 'collapse' : 'reopen tasks'}</p>
          )}
        </CardHeader>
        <AnimatePresence initial={false}>
          {showContent && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <CardContent className="space-y-3">
                {items.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border p-3">
                    <Checkbox checked={!!state[item.id]} onCheckedChange={(checked) => onToggle(item.id, !!checked)} />
                    <span className={state[item.id] ? 'line-through text-slate-400' : ''}>{item.label}</span>
                  </label>
                ))}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};

const CollapsibleSection = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-2xl border bg-white px-5 py-3 text-left shadow-none"
      >
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BlockTaskEditor = ({ title, tasks, setTasks, suggestions, alarms = {}, onAlarmChange }) => {
  const groupedTasks = useMemo(() => grouped(tasks), [tasks]);
  const sectionNames = Object.keys(groupedTasks);
  const [newBlockName, setNewBlockName] = useState('');
  const [draftBySection, setDraftBySection] = useState({});

  const updateTask = (id, value) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, label: value } : task)));
  };

  const removeTask = (id) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const addTaskToSection = (section) => {
    const draft = draftBySection[section]?.trim();
    if (!draft) return;
    setTasks((prev) => [...prev, { id: createId(), label: draft, section }]);
    setDraftBySection((prev) => ({ ...prev, [section]: '' }));
  };

  const addTaskBlock = (sectionName) => {
    const trimmed = sectionName.trim();
    if (!trimmed) return;
    const exists = sectionNames.some((name) => name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setNewBlockName('');
      return;
    }
    setTasks((prev) => [...prev, { id: createId(), label: 'New task', section: trimmed }]);
    setNewBlockName('');
  };

  return (
    <Card className="rounded-2xl border shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Card className="rounded-2xl border border-dashed shadow-none">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <FolderPlus className="h-4 w-4" /> Add Task Block
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Button key={suggestion} type="button" variant="outline" className="rounded-full" onClick={() => addTaskBlock(suggestion)}>
                  {suggestion}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                value={newBlockName}
                onChange={(e) => setNewBlockName(e.target.value)}
                placeholder="Custom Task Block name"
                className="rounded-xl"
              />
              <Button onClick={() => addTaskBlock(newBlockName)} className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" /> Add Task Block
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {sectionNames.map((section) => (
            <Card key={section} className="rounded-2xl border shadow-none">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">{section}</CardTitle>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-xs text-slate-500">Alarm</label>
                    <Switch checked={!!(alarms[section]?.enabled)} onCheckedChange={(v) => onAlarmChange(section, 'enabled', v)} />
                  </div>
                </div>
                {alarms[section]?.enabled && (
                  <Input type="time" value={alarms[section]?.time || '08:00'} onChange={(e) => onAlarmChange(section, 'time', e.target.value)} className="mt-2 rounded-xl w-36" />
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {groupedTasks[section].map((task) => (
                  <div key={task.id} className="flex items-center gap-3 rounded-2xl border p-3">
                    <Checkbox checked={false} disabled className="shrink-0" />
                    <Input value={task.label} onChange={(e) => updateTask(task.id, e.target.value)} className="flex-1 min-w-0 rounded-xl" />
                    <Button variant="outline" size="icon" className="shrink-0 rounded-xl" onClick={() => removeTask(task.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <Input
                    value={draftBySection[section] || ''}
                    onChange={(e) => setDraftBySection((prev) => ({ ...prev, [section]: e.target.value }))}
                    placeholder={`Add task to ${section}`}
                    className="rounded-xl"
                  />
                  <Button onClick={() => addTaskToSection(section)} variant="outline" className="rounded-xl">
                    <Plus className="mr-2 h-4 w-4" /> Add Task
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const CountdownEditor = ({ countdown, setCountdown, clearCountdown, cardStyle = '' }) => {
  const stats = getCountdownStats(countdown);

  const updateField = (field, value) => {
    setCountdown((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Card className={`rounded-2xl border shadow-none ${cardStyle}`}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Long-Term Goal Countdown</CardTitle>
          <Button variant="outline" onClick={clearCountdown} className="rounded-xl shrink-0">
            <Trash2 className="mr-2 h-4 w-4" /> Clear Countdown
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Title</label>
          <Input value={countdown.title} onChange={(e) => updateField('title', e.target.value)} className="rounded-xl" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <Input type="date" value={countdown.startDate} onChange={(e) => updateField('startDate', e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
            <Input type="date" value={countdown.endDate} onChange={(e) => updateField('endDate', e.target.value)} className="rounded-xl" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Calendar Highlight</label>
          <div className="flex flex-wrap gap-3">
            {Object.entries(countdownSwatches).map(([key, styles]) => {
              const selected = countdown.color === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  onClick={() => updateField('color', key)}
                  className={`h-9 w-9 rounded-full border-2 ${styles.swatch} ${selected ? `ring-2 ${styles.ring} border-slate-700` : 'border-slate-200'}`}
                />
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border p-4">
          <div>
            <div className="text-sm font-medium">Include countdown progress in Momentum Score</div>
            <div className="text-xs text-slate-500">Adds a weighted bonus based on overall countdown progress.</div>
          </div>
          <Switch checked={!!countdown.includeInMomentum} onCheckedChange={(checked) => updateField('includeInMomentum', !!checked)} />
        </div>

        <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600">
          {stats.valid ? `Day ${stats.dayNumber} of ${stats.totalDays} days` : 'Select a valid date range.'}
        </div>
      </CardContent>
    </Card>
  );
};

const WeeklyRoutineEditor = ({ routine, setRoutine, todayDayName }) => {
  const updateNote = (day, value) => {
    setRoutine((prev) => ({
      ...prev,
      [day]: {
        ...normalizeRoutineDay(prev?.[day]),
        note: value,
      },
    }));
  };

  const addItem = (day) => {
    setRoutine((prev) => {
      const current = normalizeRoutineDay(prev?.[day]);
      return {
        ...prev,
        [day]: {
          ...current,
          items: [...current.items, { id: createId(), text: '', done: false }],
        },
      };
    });
  };

  const updateItem = (day, itemId, value) => {
    setRoutine((prev) => {
      const current = normalizeRoutineDay(prev?.[day]);
      return {
        ...prev,
        [day]: {
          ...current,
          items: current.items.map((item) => (item.id === itemId ? { ...item, text: value } : item)),
        },
      };
    });
  };

  const removeItem = (day, itemId) => {
    setRoutine((prev) => {
      const current = normalizeRoutineDay(prev?.[day]);
      return {
        ...prev,
        [day]: {
          ...current,
          items: current.items.filter((item) => item.id !== itemId),
        },
      };
    });
  };

  return (
    <Card className="rounded-2xl border shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Weekly Routine Editor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(() => {
          const todayIdx = todayDayName ? dayNames.indexOf(todayDayName) : 0;
          const ordered = [...dayNames.slice(todayIdx), ...dayNames.slice(0, todayIdx)];
          return ordered;
        })().map((day) => {
          const current = normalizeRoutineDay(routine?.[day]);
          return (
            <Card key={day} className="rounded-2xl border shadow-none">
              <CardContent className="space-y-3 p-4">
                <div className="font-medium">{day}</div>
                <Textarea
                  value={current.note}
                  onChange={(e) => updateNote(day, e.target.value)}
                  placeholder="Routine note"
                  className="min-h-[88px] rounded-2xl"
                />
                <div className="space-y-2">
                  {current.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Input
                        value={item.text}
                        onChange={(e) => updateItem(day, item.id, e.target.value)}
                        placeholder="Routine checklist item"
                        className="flex-1 min-w-0 rounded-xl"
                      />
                      <Button variant="outline" size="icon" className="shrink-0 rounded-xl" onClick={() => removeItem(day, item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button onClick={() => addItem(day)} variant="outline" className="rounded-xl w-full">
                    <Plus className="mr-2 h-4 w-4" /> Add Routine Item
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
};

const OutcomeEditor = ({ outcomes, setOutcomes, cardStyle = '' }) => {
  const safeOutcomes = Array.isArray(outcomes) ? outcomes.map(normalizeOutcome) : [];

  const addOutcome = () => {
    setOutcomes((prev) => [...(Array.isArray(prev) ? prev : []), defaultOutcome()]);
  };

  const updateOutcome = (id, field, value) => {
    setOutcomes((prev) =>
      (Array.isArray(prev) ? prev : []).map((outcome) =>
        outcome.id === id ? { ...normalizeOutcome(outcome), [field]: value } : normalizeOutcome(outcome)
      )
    );
  };

  const removeOutcome = (id) => {
    setOutcomes((prev) => (Array.isArray(prev) ? prev : []).filter((outcome) => outcome.id !== id));
  };

  return (
    <Card className={`rounded-2xl border shadow-none ${cardStyle}`}>
      <CardHeader>
        <CardTitle className="text-base">Countdown Outcomes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {safeOutcomes.map((outcome) => (
          <Card key={outcome.id} className="rounded-2xl border shadow-none">
            <CardContent className="space-y-3 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Label</label>
                  <Input
                    value={outcome.label}
                    onChange={(e) => updateOutcome(outcome.id, 'label', e.target.value)}
                    placeholder="Weight"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Starting Value</label>
                  <Input
                    value={outcome.startingValue}
                    onChange={(e) => updateOutcome(outcome.id, 'startingValue', e.target.value)}
                    placeholder="265"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ending Goal Value</label>
                  <Input
                    value={outcome.endingValue}
                    onChange={(e) => updateOutcome(outcome.id, 'endingValue', e.target.value)}
                    placeholder="205"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Live Current Value</label>
                  <Input
                    value={outcome.currentValue}
                    onChange={(e) => updateOutcome(outcome.id, 'currentValue', e.target.value)}
                    placeholder="257"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unit</label>
                  <Input
                    value={outcome.unit}
                    onChange={(e) => updateOutcome(outcome.id, 'unit', e.target.value)}
                    placeholder="$ or lbs or leads"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unit Position</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={outcome.unitPosition === 'prefix' ? 'default' : 'outline'}
                      onClick={() => updateOutcome(outcome.id, 'unitPosition', 'prefix')}
                      className="rounded-xl"
                    >
                      Prefix
                    </Button>
                    <Button
                      type="button"
                      variant={outcome.unitPosition === 'suffix' ? 'default' : 'outline'}
                      onClick={() => updateOutcome(outcome.id, 'unitPosition', 'suffix')}
                      className="rounded-xl"
                    >
                      Suffix
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Progress Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={outcome.progressType === 'increase' ? 'default' : 'outline'}
                      onClick={() => updateOutcome(outcome.id, 'progressType', 'increase')}
                      className="rounded-xl"
                    >
                      Increase
                    </Button>
                    <Button
                      type="button"
                      variant={outcome.progressType === 'decrease' ? 'default' : 'outline'}
                      onClick={() => updateOutcome(outcome.id, 'progressType', 'decrease')}
                      className="rounded-xl"
                    >
                      Decrease
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Placement</label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={outcome.placement === 'daily' ? 'default' : 'outline'}
                      onClick={() => updateOutcome(outcome.id, 'placement', 'daily')}
                      className="rounded-xl"
                    >
                      Daily
                    </Button>
                    <Button
                      type="button"
                      variant={outcome.placement === 'scoreboard' ? 'default' : 'outline'}
                      onClick={() => updateOutcome(outcome.id, 'placement', 'scoreboard')}
                      className="rounded-xl"
                    >
                      Scoreboard
                    </Button>
                    <Button
                      type="button"
                      variant={outcome.placement === 'both' ? 'default' : 'outline'}
                      onClick={() => updateOutcome(outcome.id, 'placement', 'both')}
                      className="rounded-xl"
                    >
                      Both
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => removeOutcome(outcome.id)} className="rounded-xl">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Outcome
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button onClick={addOutcome} variant="outline" className="rounded-xl w-full">
          <Plus className="mr-2 h-4 w-4" /> Add Outcome
        </Button>
      </CardContent>
    </Card>
  );
};

const TAB_ORDER = ['daily', 'weekly', 'scoreboard', 'calendar', 'editor', 'alerts'];

const defaultNotifications = {
  soundEnabled: true,
  soundType: 'chime',
  alarms: {
    wake:  { enabled: false, time: '06:00', label: 'Wake Alarm' },
    morning: { enabled: false, time: '08:00', label: 'Morning Reminder' },
    sleep: { enabled: false, time: '22:00', label: 'Sleep Reminder' },
  },
};

const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === 'chime') {
      [880, 1100, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.5);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.5);
      });
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) { /* audio not available */ }
};

const fireAlarm = (label, body, soundEnabled, soundType) => {
  if (soundEnabled && soundType !== 'silent') playSound(soundType);
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(label, { body, icon: '/favicon.ico' });
  }
};

const SPOTLIGHT_STEPS = [
  {
    tab: null,
    elementId: 'tour-header',
    title: 'Life Tracker Dashboard',
    body: "Your home base — today's date, time, and active alarms at a glance. Everything saves automatically to your device.",
  },
  {
    tab: null,
    elementId: 'tour-progress-cards',
    title: 'Progress at a Glance',
    body: 'Daily and weekly completion update in real time as you check off tasks. Your momentum score lives here too.',
  },
  {
    tab: null,
    elementId: 'tour-tab-bar',
    title: 'Navigate by Swiping',
    body: 'Swipe left or right anywhere to switch tabs — or tap a name directly. Six sections keep everything organized.',
  },
  {
    tab: 'daily',
    elementId: 'tour-tab-content',
    title: 'Daily Tasks',
    body: 'Check tasks off as you go. Sections collapse when fully complete — double-tap a completed section to reopen it.',
  },
  {
    tab: 'calendar',
    elementId: 'tour-tab-content',
    title: 'Calendar & Archive',
    body: 'Every day is saved here. Tap any past day to enter Archive mode and review exactly what you completed.',
  },
  {
    tab: 'alerts',
    elementId: 'tour-tab-content',
    title: 'Alerts & Alarms',
    body: 'Set wake, sleep, and custom alarms with sound. Your wake time also controls when each new day begins.',
  },
  {
    tab: 'editor',
    elementId: 'tour-tab-content',
    title: 'Editor — Make It Yours',
    body: 'Customize your tasks, weekly routine, performance metrics, and set a personal goal countdown from here.',
  },
];

const SpotlightTour = ({ onClose, setActiveTab }) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const current = SPOTLIGHT_STEPS[step];
  const isLast = step === SPOTLIGHT_STEPS.length - 1;
  const PAD = 12;

  useEffect(() => {
    const s = SPOTLIGHT_STEPS[step];
    if (s.tab) setActiveTab(s.tab);
    const delay = s.tab ? 420 : 80;
    const t = setTimeout(() => {
      const el = document.getElementById(s.elementId);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        const r = el.getBoundingClientRect();
        setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
      }, 320);
    }, delay);
    return () => clearTimeout(t);
  }, [step, setActiveTab]);

  const goNext = () => { if (isLast) { onClose(); return; } setRect(null); setStep(s => s + 1); };
  const goBack = () => { setRect(null); setStep(s => s - 1); };

  return (
    <>
      <style>{`
        @keyframes tour-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255,255,255,0.4); }
          50% { opacity: 0.85; box-shadow: 0 0 0 6px rgba(255,255,255,0); }
        }
        .tour-ring { animation: tour-pulse 2s ease-in-out infinite; }
      `}</style>

      {/* Dark overlay with SVG cutout */}
      <svg style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 49, pointerEvents: 'none' }}>
        {rect ? (
          <>
            <defs>
              <mask id="tour-cutout">
                <rect width="100%" height="100%" fill="white" />
                <rect x={rect.left - PAD} y={rect.top - PAD} width={rect.width + PAD * 2} height={rect.height + PAD * 2} rx="16" fill="black" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.68)" mask="url(#tour-cutout)" />
          </>
        ) : (
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.68)" />
        )}
      </svg>

      {/* Pulsing ring around highlighted element */}
      {rect && (
        <div className="tour-ring" style={{
          position: 'fixed',
          left: rect.left - PAD, top: rect.top - PAD,
          width: rect.width + PAD * 2, height: rect.height + PAD * 2,
          borderRadius: 16, border: '2px solid rgba(255,255,255,0.9)',
          zIndex: 50, pointerEvents: 'none',
        }} />
      )}

      {/* Tooltip anchored to bottom */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51, padding: '0 16px 28px' }}>
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">{step + 1} / {SPOTLIGHT_STEPS.length}</span>
            <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Skip tour</button>
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">{current.title}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{current.body}</p>
          </div>
          <div className="flex justify-center gap-1.5">
            {SPOTLIGHT_STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-5 bg-slate-800' : 'w-1.5 bg-slate-200'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && <Button variant="outline" className="flex-1 rounded-2xl" onClick={goBack}>Back</Button>}
            <Button className="flex-1 rounded-2xl" onClick={goNext}>{isLast ? 'Get Started' : 'Next'}</Button>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default function LifeResetTrackerApp() {
  const [isEditingTodayTodo, setIsEditingTodayTodo] = useState(false);
  const [activeTab, setActiveTab] = useState('daily');
  const touchStartXRef = useRef(null);
  const [now, setNow] = useState(new Date());
  const [currentDateKey, setCurrentDateKey] = useState(getTodayKey());
  const [selectedDateKey, setSelectedDateKey] = useState(getTodayKey());
  const [archiveDateKey, setArchiveDateKey] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const seen = window.localStorage.getItem('life-tracker-tutorial-seen');
    if (!seen) setShowTutorial(true);
  }, []);

  const closeTutorial = () => {
    setShowTutorial(false);
    window.localStorage.setItem('life-tracker-tutorial-seen', '1');
  };

  const restartTutorial = () => setShowTutorial(true);

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNow(n);
      setCurrentDateKey(getTodayKey(n));
    };
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const firedRef = new Set();
    const check = () => {
      const n = new Date();
      const hhmm = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
      const key = `${getTodayKey(n)}-${hhmm}`;
      if (firedRef.has(key)) return;
      const { notifications, blockAlarms } = dataRef.current;
      const { soundEnabled, soundType, alarms } = notifications;
      Object.entries(alarms).forEach(([, alarm]) => {
        if (alarm.enabled && alarm.time === hhmm) {
          firedRef.add(`${key}-${alarm.label}`);
          fireAlarm(alarm.label, 'Life Reset Tracker', soundEnabled, soundType);
        }
      });
      ['daily', 'weekly'].forEach((tmpl) => {
        Object.entries(blockAlarms[tmpl] || {}).forEach(([section, cfg]) => {
          if (cfg.enabled && cfg.time === hhmm) {
            const bkey = `${key}-${tmpl}-${section}`;
            if (!firedRef.has(bkey)) {
              firedRef.add(bkey);
              fireAlarm(section, `${tmpl === 'daily' ? 'Daily' : 'Weekly'} block reminder`, soundEnabled, soundType);
            }
          }
        });
      });
    };
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  const updateNotification = (path, value) => {
    setData((prev) => {
      const notif = { ...prev.notifications };
      if (path.startsWith('alarms.')) {
        const [, key, field] = path.split('.');
        notif.alarms = { ...notif.alarms, [key]: { ...notif.alarms[key], [field]: value } };
      } else {
        notif[path] = value;
      }
      return { ...prev, notifications: notif };
    });
  };

  const updateBlockAlarm = (tmpl, section, field, value) => {
    setData((prev) => ({
      ...prev,
      blockAlarms: {
        ...prev.blockAlarms,
        [tmpl]: {
          ...prev.blockAlarms[tmpl],
          [section]: { enabled: false, time: '08:00', ...(prev.blockAlarms[tmpl]?.[section] || {}), [field]: value },
        },
      },
    }));
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') return;
    await Notification.requestPermission();
    setData((prev) => ({ ...prev }));
  };

  const addAlarm = () => {
    const key = `custom-${Date.now()}`;
    setData((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        alarms: {
          ...prev.notifications.alarms,
          [key]: { enabled: false, time: '08:00', label: 'New Alarm' },
        },
      },
    }));
  };

  const removeAlarm = (key) => {
    setData((prev) => {
      const alarms = { ...prev.notifications.alarms };
      delete alarms[key];
      return { ...prev, notifications: { ...prev.notifications, alarms } };
    });
  };
  const lastCurrentDateKeyRef = useRef(getTodayKey());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [data, setData] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        daily: {}, weekly: {}, weeklyDayPlans: {}, reflections: {},
        dailyTemplate: defaultDailyTemplate, weeklyTemplate: defaultWeeklyTemplate,
        notes: '', metricsByDate: {}, targets: defaultTargets, metricLabels: defaultMetricLabels,
        countdown: defaultCountdown, weeklyRoutine: defaultWeeklyRoutine,
        countdownOutcomes: seededOutcomes,
        notifications: defaultNotifications, blockAlarms: { daily: {}, weekly: {} },
      };
    }

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return {
        daily: {}, weekly: {}, weeklyDayPlans: {}, reflections: {},
        dailyTemplate: defaultDailyTemplate, weeklyTemplate: defaultWeeklyTemplate,
        notes: '', metricsByDate: {}, targets: defaultTargets, metricLabels: defaultMetricLabels,
        countdown: defaultCountdown, weeklyRoutine: defaultWeeklyRoutine,
        countdownOutcomes: seededOutcomes,
        notifications: defaultNotifications, blockAlarms: { daily: {}, weekly: {} },
      };
    }

    const parsed = JSON.parse(saved);
    return {
      daily: parsed.daily || {},
      weekly: parsed.weekly || {},
      weeklyDayPlans: parsed.weeklyDayPlans || {},
      reflections: parsed.reflections || {},
      dailyTemplate: parsed.dailyTemplate || defaultDailyTemplate,
      weeklyTemplate: parsed.weeklyTemplate || defaultWeeklyTemplate,
      notes: parsed.notes || '',
      metricsByDate: parsed.metricsByDate || {},
      targets: { ...defaultTargets, ...(parsed.targets || {}) },
      metricLabels: { ...defaultMetricLabels, ...(parsed.metricLabels || {}) },
      countdown: { ...defaultCountdown, ...(parsed.countdown || {}) },
      weeklyRoutine: { ...defaultWeeklyRoutine, ...(parsed.weeklyRoutine || {}) },
      countdownOutcomes: Array.isArray(parsed.countdownOutcomes) ? parsed.countdownOutcomes.map(normalizeOutcome) : seededOutcomes,
      notifications: { ...defaultNotifications, ...(parsed.notifications || {}), alarms: { ...defaultNotifications.alarms, ...(parsed.notifications?.alarms || {}) } },
      blockAlarms: { daily: {}, weekly: {}, ...(parsed.blockAlarms || {}) },
    };
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    const checkDateChange = () => {
      const wakeTime = dataRef.current?.notifications?.alarms?.wake?.time || '05:30';
      const nextKey = getEffectiveDateKey(wakeTime);
      setCurrentDateKey((prev) => {
        if (prev !== nextKey) {
          lastCurrentDateKeyRef.current = prev;
          return nextKey;
        }
        return prev;
      });
    };

    checkDateChange();
    const interval = window.setInterval(checkDateChange, 60000);
    window.addEventListener('focus', checkDateChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', checkDateChange);
    };
  }, []);

  useEffect(() => {
    setSelectedDateKey((prev) => {
      const priorCurrent = lastCurrentDateKeyRef.current;
      return prev === priorCurrent ? currentDateKey : prev;
    });
    lastCurrentDateKeyRef.current = currentDateKey;
  }, [currentDateKey]);

  const currentWeekKey = getWeekKey(parseKey(currentDateKey));
  const currentWeekDates = useMemo(() => getWeekDates(parseKey(currentDateKey)), [currentDateKey]);
  const weekDayPlans = data.weeklyDayPlans[currentWeekKey] || {};
  const todayWeekPlan = normalizeDayPlan(weekDayPlans[currentDateKey]);

  const todayState = data.daily[currentDateKey] || {};
  const weekState = data.weekly[currentWeekKey] || {};
  const todayMetrics = { ...createEmptyMetrics(), ...(data.metricsByDate[currentDateKey] || {}) };
  const selectedDateState = data.daily[selectedDateKey] || {};
  const selectedDateMetrics = { ...createEmptyMetrics(), ...(data.metricsByDate[selectedDateKey] || {}) };
  const selectedReflection = data.reflections[selectedDateKey] || { reflection: '', wins: '', progress: '' };
  const countdown = { ...defaultCountdown, ...(data.countdown || {}) };
  const weeklyRoutine = { ...defaultWeeklyRoutine, ...(data.weeklyRoutine || {}) };
  const countdownOutcomes = Array.isArray(data.countdownOutcomes) ? data.countdownOutcomes.map(normalizeOutcome) : [];
  const countdownStats = getCountdownStats(countdown, currentDateKey);
  const countdownStyles = countdownSwatches[countdown.color] || countdownSwatches.purple;
  const hasConfiguredCountdown = isCountdownConfigured(countdown);
  const dailyCountdownOutcomes = countdownOutcomes.filter((outcome) => ['daily', 'both'].includes(outcome.placement));
  const scoreboardCountdownOutcomes = countdownOutcomes.filter((outcome) => ['scoreboard', 'both'].includes(outcome.placement));
  const showDailyCountdownCard = hasConfiguredCountdown && dailyCountdownOutcomes.length > 0;
  const scoreboardOverallProgress = calculateOverallCountdownProgress(scoreboardCountdownOutcomes);
  const dashboardOverallProgress = calculateOverallCountdownProgress(countdownOutcomes);

  // Archive mode — viewing a past day
  const isArchiveMode = archiveDateKey !== null;
  const viewingDateKey = isArchiveMode ? archiveDateKey : currentDateKey;
  const viewingState = isArchiveMode ? (data.daily[viewingDateKey] || {}) : todayState;
  const viewingCompleted = data.dailyTemplate.filter((item) => viewingState[item.id]).length;
  const viewingProgress = data.dailyTemplate.length ? Math.round((viewingCompleted / data.dailyTemplate.length) * 100) : 0;

  const setDailyTemplate = (updater) => {
    setData((prev) => ({ ...prev, dailyTemplate: typeof updater === 'function' ? updater(prev.dailyTemplate) : updater }));
  };

  const setWeeklyTemplate = (updater) => {
    setData((prev) => ({ ...prev, weeklyTemplate: typeof updater === 'function' ? updater(prev.weeklyTemplate) : updater }));
  };

  const setCountdown = (updater) => {
    setData((prev) => ({
      ...prev,
      countdown: typeof updater === 'function' ? updater(prev.countdown || defaultCountdown) : updater,
    }));
  };

  const clearCountdown = () => {
    setData((prev) => ({
      ...prev,
      countdown: emptyCountdown,
      countdownOutcomes: [],
    }));
  };

  const setWeeklyRoutine = (updater) => {
    setData((prev) => ({
      ...prev,
      weeklyRoutine: typeof updater === 'function' ? updater(prev.weeklyRoutine || defaultWeeklyRoutine) : updater,
    }));
  };

  const setCountdownOutcomes = (updater) => {
    setData((prev) => ({
      ...prev,
      countdownOutcomes: typeof updater === 'function' ? updater(prev.countdownOutcomes || []) : updater,
    }));
  };

  const updateCountdownOutcomeCurrentValue = (id, value) => {
    setCountdownOutcomes((prev) => prev.map((outcome) => (outcome.id === id ? { ...outcome, currentValue: value } : outcome)));
  };

  const setDailyCheck = (id, checked) => {
    setData((prev) => ({
      ...prev,
      daily: {
        ...prev.daily,
        [currentDateKey]: {
          ...(prev.daily[currentDateKey] || {}),
          [id]: checked,
        },
      },
    }));
  };

  const setWeeklyCheck = (id, checked) => {
    setData((prev) => ({
      ...prev,
      weekly: {
        ...prev.weekly,
        [currentWeekKey]: {
          ...(prev.weekly[currentWeekKey] || {}),
          [id]: checked,
        },
      },
    }));
  };

  const updateMetric = (field, value) => {
    setData((prev) => ({
      ...prev,
      metricsByDate: {
        ...prev.metricsByDate,
        [currentDateKey]: {
          ...(prev.metricsByDate[currentDateKey] || {}),
          [field]: value,
        },
      },
    }));
  };

  const updateTarget = (field, value) => {
    setData((prev) => ({ ...prev, targets: { ...prev.targets, [field]: value } }));
  };

  const updateMetricLabel = (field, value) => {
    setData((prev) => ({ ...prev, metricLabels: { ...prev.metricLabels, [field]: value } }));
  };

  const updateReflection = (field, value) => {
    setData((prev) => ({
      ...prev,
      reflections: {
        ...prev.reflections,
        [selectedDateKey]: {
          ...(prev.reflections[selectedDateKey] || {}),
          [field]: value,
        },
      },
    }));
  };

  const updateWeekDayPlan = (dayKey, value) => {
    setData((prev) => {
      const current = normalizeDayPlan(prev.weeklyDayPlans[currentWeekKey]?.[dayKey]);
      return {
        ...prev,
        weeklyDayPlans: {
          ...prev.weeklyDayPlans,
          [currentWeekKey]: {
            ...(prev.weeklyDayPlans[currentWeekKey] || {}),
            [dayKey]: {
              ...current,
              note: value,
            },
          },
        },
      };
    });
  };

  const addTodayTodoItem = () => {
    setData((prev) => {
      const current = normalizeDayPlan(prev.weeklyDayPlans[currentWeekKey]?.[currentDateKey]);
      return {
        ...prev,
        weeklyDayPlans: {
          ...prev.weeklyDayPlans,
          [currentWeekKey]: {
            ...(prev.weeklyDayPlans[currentWeekKey] || {}),
            [currentDateKey]: {
              ...current,
              items: [...current.items, { id: createId(), text: '', done: false }],
            },
          },
        },
      };
    });
  };

  const updateWeekDayItem = (dayKey, itemId, field, value) => {
    setData((prev) => {
      const current = normalizeDayPlan(prev.weeklyDayPlans[currentWeekKey]?.[dayKey]);
      return {
        ...prev,
        weeklyDayPlans: {
          ...prev.weeklyDayPlans,
          [currentWeekKey]: {
            ...(prev.weeklyDayPlans[currentWeekKey] || {}),
            [dayKey]: {
              ...current,
              items: current.items.map((it) => (it.id === itemId ? { ...it, [field]: value } : it)),
            },
          },
        },
      };
    });
  };

  const removeWeekDayItem = (dayKey, itemId) => {
    setData((prev) => {
      const current = normalizeDayPlan(prev.weeklyDayPlans[currentWeekKey]?.[dayKey]);
      return {
        ...prev,
        weeklyDayPlans: {
          ...prev.weeklyDayPlans,
          [currentWeekKey]: {
            ...(prev.weeklyDayPlans[currentWeekKey] || {}),
            [dayKey]: {
              ...current,
              items: current.items.filter((it) => it.id !== itemId),
            },
          },
        },
      };
    });
  };

  const resetToday = () => {
    setData((prev) => ({
      ...prev,
      daily: { ...prev.daily, [currentDateKey]: {} },
      metricsByDate: { ...prev.metricsByDate, [currentDateKey]: createEmptyMetrics() },
    }));
  };

  const resetWeek = () => {
    setData((prev) => ({ ...prev, weekly: { ...prev.weekly, [currentWeekKey]: {} } }));
  };

  const restoreDefaults = () => {
    setData((prev) => ({ ...prev, dailyTemplate: defaultDailyTemplate, weeklyTemplate: defaultWeeklyTemplate }));
  };

  const touchStartYRef = useRef(null);

  const handleTabTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTabTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    // Ignore if mostly vertical (scrolling) or too short
    if (Math.abs(deltaX) < 60 || Math.abs(deltaY) > Math.abs(deltaX) * 0.6) return;
    const n = TAB_ORDER.length;
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    if (deltaX < 0) {
      setActiveTab(TAB_ORDER[(currentIndex + 1) % n]);
    } else {
      setActiveTab(TAB_ORDER[((currentIndex - 1) % n + n) % n]);
    }
  };

  const dailyCompleted = data.dailyTemplate.filter((item) => todayState[item.id]).length;
  const weeklyCompleted = data.weeklyTemplate.filter((item) => weekState[item.id]).length;
  const dailyProgress = data.dailyTemplate.length ? Math.round((dailyCompleted / data.dailyTemplate.length) * 100) : 0;
  const weeklyProgress = data.weeklyTemplate.length ? Math.round((weeklyCompleted / data.weeklyTemplate.length) * 100) : 0;
  const selectedCompleted = data.dailyTemplate.filter((item) => selectedDateState[item.id]).length;
  const selectedProgress = data.dailyTemplate.length ? Math.round((selectedCompleted / data.dailyTemplate.length) * 100) : 0;

  const dailyGroups = useMemo(() => grouped(data.dailyTemplate), [data.dailyTemplate]);
  const weeklyGroups = useMemo(() => grouped(data.weeklyTemplate), [data.weeklyTemplate]);

  const orderedDailySections = useMemo(() => {
    const entries = Object.entries(dailyGroups);
    return entries.sort((a, b) => {
      const aComplete = a[1].length > 0 && a[1].every((item) => !!viewingState[item.id]);
      const bComplete = b[1].length > 0 && b[1].every((item) => !!viewingState[item.id]);
      if (aComplete === bComplete) return 0;
      return aComplete ? 1 : -1;
    });
  }, [dailyGroups, viewingState]);

  const orderedWeeklySections = useMemo(() => {
    const entries = Object.entries(weeklyGroups);
    return entries.sort((a, b) => {
      const aComplete = a[1].length > 0 && a[1].every((item) => !!weekState[item.id]);
      const bComplete = b[1].length > 0 && b[1].every((item) => !!weekState[item.id]);
      if (aComplete === bComplete) return 0;
      return aComplete ? 1 : -1;
    });
  }, [weeklyGroups, weekState]);

  const monthRows = useMemo(() => getMonthMatrix(calendarMonth), [calendarMonth]);
  const countdownMomentumBonus = countdown.includeInMomentum ? Math.round(dashboardOverallProgress * COUNTDOWN_MOMENTUM_WEIGHT) : 0;
  const score = dailyCompleted * 10 + weeklyCompleted * 15 + countdownMomentumBonus;

  const getDateProgress = (dateKey) => {
    const state = data.daily[dateKey] || {};
    const completed = data.dailyTemplate.filter((item) => state[item.id]).length;
    return data.dailyTemplate.length ? Math.round((completed / data.dailyTemplate.length) * 100) : 0;
  };

  const isInCountdownRange = (dateObj) => {
    const start = parseKey(countdown.startDate);
    const end = parseKey(countdown.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return false;
    const cell = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    return cell >= start && cell <= end;
  };

  return (
    <>
    {showTutorial && <SpotlightTour onClose={closeTutorial} setActiveTab={setActiveTab} />}
    <div className="min-h-screen bg-slate-50 p-4 md:p-8" style={isArchiveMode ? { filter: 'saturate(0.55) brightness(0.97)' } : {}}>
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.div id="tour-progress-cards" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 lg:grid-cols-5">
          <Card id="tour-header" className="lg:col-span-2 rounded-3xl shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Target className="h-6 w-6" />
                Life Tracker Dashboard
              </CardTitle>
              {isArchiveMode && (
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Archive — {formatLongDate(archiveDateKey)}</span>
                  <Button size="sm" variant="outline" className="rounded-xl text-xs h-7 px-3" onClick={() => setArchiveDateKey(null)}>Exit Archive</Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-full px-3 py-1">Today: {formatLongDate(currentDateKey)}</Badge>
                <Badge className="rounded-full px-3 py-1">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Badge>
                {Object.values(data.notifications.alarms).filter(a => a.enabled).map(a => (
                  <Badge key={a.label} className="rounded-full px-3 py-1">{a.label}: {a.time}</Badge>
                ))}
              </div>
              <p className="text-sm text-slate-600">
                The app follows today’s real date automatically and keeps prior days saved in your calendar history.
              </p>
            </CardContent>
          </Card>

          {hasConfiguredCountdown ? (
            <Card className={`rounded-3xl border shadow-sm ${countdownStyles.card}`}>
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Goal Countdown</p>
                <CardTitle className="text-lg">{countdown.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-semibold">Day {countdownStats.dayNumber}</div>
                <p className="text-sm text-slate-600">day {countdownStats.dayNumber} of {countdownStats.totalDays} days</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className={`rounded-full px-3 py-1 ${countdownStyles.badge}`}>{formatCountdownDate(countdown.startDate)}</Badge>
                  <Badge className={`rounded-full px-3 py-1 ${countdownStyles.badge}`}>{formatCountdownDate(countdown.endDate)}</Badge>
                </div>
                {countdownOutcomes.length ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                      <span>Overall</span>
                      <span>{dashboardOverallProgress}%</span>
                    </div>
                    <Progress value={dashboardOverallProgress} className="h-2.5" />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-3xl shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sun className="h-5 w-5" /> Daily Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-3xl font-semibold">{isArchiveMode ? viewingProgress : dailyProgress}%</div>
              <Progress value={isArchiveMode ? viewingProgress : dailyProgress} className="h-3" />
              <p className="text-sm text-slate-600">{isArchiveMode ? viewingCompleted : dailyCompleted} of {data.dailyTemplate.length} {isArchiveMode ? 'completed that day' : 'completed today'}</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5" /> Weekly Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-3xl font-semibold">{weeklyProgress}%</div>
              <Progress value={weeklyProgress} className="h-3" />
              <p className="text-sm text-slate-600">{weeklyCompleted} of {data.weeklyTemplate.length} weekly tasks done</p>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card id="tour-tab-bar" className="rounded-3xl shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle>Execution Center</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="hidden md:block overflow-x-auto pb-0.5">
                  <TabsList className="grid min-w-[500px] w-full grid-cols-6 rounded-2xl">
                    <TabsTrigger value="daily">Daily</TabsTrigger>
                    <TabsTrigger value="weekly">Weekly</TabsTrigger>
                    <TabsTrigger value="scoreboard">Scoreboard</TabsTrigger>
                    <TabsTrigger value="calendar">Calendar</TabsTrigger>
                    <TabsTrigger value="editor">Editor</TabsTrigger>
                    <TabsTrigger value="alerts">Alerts</TabsTrigger>
                  </TabsList>
                </div>

                {/* Mobile carousel tab bar */}
                {(() => {
                  const TAB_LABELS = { daily: 'Daily', weekly: 'Weekly', scoreboard: 'Scoreboard', calendar: 'Calendar', editor: 'Editor', alerts: 'Alerts' };
                  const n = TAB_ORDER.length;
                  const idx = TAB_ORDER.indexOf(activeTab);
                  const getTab = (offset) => TAB_ORDER[((idx + offset) % n + n) % n];
                  const widths = { '-2': 'w-16', '-1': 'w-24', '0': 'w-36', '1': 'w-24', '2': 'w-16' };
                  const styles = { '-2': 'text-base text-slate-300', '-1': 'text-xl text-slate-400', '0': 'text-2xl font-semibold text-slate-900', '1': 'text-xl text-slate-400', '2': 'text-base text-slate-300' };
                  return (
                    <div onTouchStart={handleTabTouchStart} onTouchEnd={handleTabTouchEnd} className="md:hidden relative flex items-center justify-center py-3 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
                      {[-2, -1, 0, 1, 2].map((offset) => {
                        const tab = getTab(offset);
                        return (
                          <button
                            key={offset}
                            onClick={() => setActiveTab(tab)}
                            className={`${widths[offset]} flex items-center justify-center transition-all shrink-0 ${styles[offset]}`}
                          >
                            {TAB_LABELS[tab]}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                <motion.div
                  id="tour-tab-content"
                  key={activeTab}
                  initial={{ opacity: 0, y: 48 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  onTouchStart={handleTabTouchStart}
                  onTouchEnd={handleTabTouchEnd}
                >
                <TabsContent value="daily" className="mt-6 space-y-6">
                  {isArchiveMode && (
                    <div className="rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-600 flex items-center justify-between gap-3">
                      <span>Viewing archive for <strong>{formatLongDate(archiveDateKey)}</strong> — read-only</span>
                      <Button size="sm" variant="outline" className="rounded-xl h-7 px-3 text-xs shrink-0" onClick={() => setArchiveDateKey(null)}>Exit Archive</Button>
                    </div>
                  )}
                  {showDailyCountdownCard && !isArchiveMode ? (
                    <Card className={`rounded-2xl border shadow-none ${countdownStyles.card}`}>
                      <CardHeader>
                        <CardTitle className="text-base">Today&apos;s Countdown Updates</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {dailyCountdownOutcomes.map((outcome) => (
                          <div key={outcome.id} className="grid gap-2 rounded-2xl border border-white/50 bg-white/40 p-4 md:grid-cols-[1.1fr_0.9fr_auto] md:items-center">
                            <div>
                              <div className="font-medium text-slate-900">{outcome.label || 'Untitled outcome'}</div>
                              <div className="text-sm text-slate-600">
                                {formatOutcomeValue(outcome.startingValue || '0', outcome.unit, outcome.unitPosition)} → {formatOutcomeValue(outcome.endingValue || '0', outcome.unit, outcome.unitPosition)}
                              </div>
                            </div>
                            <Input
                              value={outcome.currentValue}
                              onChange={(e) => updateCountdownOutcomeCurrentValue(outcome.id, e.target.value)}
                              placeholder="Update today"
                              className="rounded-xl bg-white/80"
                            />
                            <Badge variant="secondary">{calculateOutcomeProgress(outcome)}%</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}

                  <motion.div layout className="space-y-6">
                    {orderedDailySections.map(([section, items]) => (
                      <SectionCard key={section} title={section} items={items} state={viewingState} onToggle={isArchiveMode ? () => {} : setDailyCheck} />
                    ))}
                  </motion.div>
                  {!isArchiveMode && (
                    <div className="flex gap-3">
                      <Button onClick={resetToday} variant="outline" className="rounded-2xl">
                        <RotateCcw className="mr-2 h-4 w-4" /> Reset Today
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="weekly" className="mt-6">
                  <div className="mb-4">
                    <div className="text-base font-medium">Weekly</div>
                    <div className="text-sm text-slate-500">{formatWeekRange(currentWeekDates)}</div>
                  </div>
                  <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="space-y-6">
                      <motion.div layout className="space-y-6">
                        {orderedWeeklySections.map(([section, items]) => (
                          <SectionCard key={section} title={section} items={items} state={weekState} onToggle={setWeeklyCheck} />
                        ))}
                      </motion.div>
                      <div className="flex gap-3">
                        <Button onClick={resetWeek} variant="outline" className="rounded-2xl">
                          <RotateCcw className="mr-2 h-4 w-4" /> Reset Week
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4 xl:sticky xl:top-6 self-start">
                      <Card className="rounded-2xl border shadow-none">
                        <CardHeader>
                          <CardTitle className="text-base">Weekly Routine</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {(() => {
                            const todayIdx = currentWeekDates.findIndex(d => getTodayKey(d) === currentDateKey);
                            const start = todayIdx >= 0 ? todayIdx : 0;
                            return [...currentWeekDates.slice(start), ...currentWeekDates.slice(0, start)];
                          })().map((dateObj) => {
                            const dayName = dateObj.toLocaleDateString([], { weekday: 'long' });
                            const shortDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
                            const routine = normalizeRoutineDay(weeklyRoutine[dayName]);
                            return (
                              <Card key={dayName} className="rounded-2xl border shadow-none">
                                <CardContent className="space-y-3 p-4">
                                  <div>
                                    <div className="font-medium text-slate-900">{dayName}</div>
                                    <div className="text-xs text-slate-500">{shortDate}</div>
                                  </div>
                                  {routine.note ? (
                                    <div className="whitespace-pre-wrap rounded-2xl border p-3 text-sm text-slate-700">{routine.note}</div>
                                  ) : (
                                    <div className="rounded-2xl border border-dashed p-3 text-sm text-slate-500">No routine note set.</div>
                                  )}
                                  <div className="space-y-2">
                                    {routine.items.length ? (
                                      routine.items.map((item) => (
                                        <div key={item.id} className="flex items-center gap-3 rounded-2xl border p-3">
                                          <Checkbox checked={false} disabled />
                                          <span className="text-sm text-slate-700">{item.text || 'Untitled routine item'}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="rounded-2xl border border-dashed p-3 text-sm text-slate-500">No routine checklist items set.</div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="scoreboard" className="mt-6 space-y-6">
                  {Object.keys(defaultMetricLabels).some(k => data.metricLabels[k]) && (
                  <Card className="rounded-2xl border shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">Weekly Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {Object.keys(defaultTargets).filter(k => data.metricLabels[k]).map((key) => (
                          <Card key={key} className="rounded-2xl border shadow-none">
                            <CardContent className="space-y-2 p-4">
                              <label className="text-sm font-medium">{data.metricLabels[key]} Target</label>
                              <Input value={data.targets[key]} onChange={(e) => updateTarget(key, e.target.value)} className="rounded-xl" />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  )}

                  {hasConfiguredCountdown || countdownOutcomes.length ? (
                    <Card className={`rounded-2xl border shadow-none ${countdownStyles.card}`}>
                      <CardHeader>
                        <CardTitle className="text-base">{hasConfiguredCountdown ? countdown.title : 'Countdown'}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {hasConfiguredCountdown ? (
                          <>
                            <div className="text-2xl font-semibold">Day {countdownStats.dayNumber} of {countdownStats.totalDays}</div>
                            <div className="flex flex-wrap gap-2">
                              <Badge className={`rounded-full px-3 py-1 ${countdownStyles.badge}`}>{countdown.startDate}</Badge>
                              <Badge className={`rounded-full px-3 py-1 ${countdownStyles.badge}`}>{countdown.endDate}</Badge>
                            </div>
                          </>
                        ) : null}

                        {scoreboardCountdownOutcomes.length ? (
                          <>
                            <div className="space-y-2 rounded-2xl border border-white/50 bg-white/40 p-3 backdrop-blur-sm">
                              <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                                <span>Overall Completion</span>
                                <span>{scoreboardOverallProgress}%</span>
                              </div>
                              <Progress value={scoreboardOverallProgress} className="h-2.5" />
                            </div>
                            <div className="space-y-3">
                              {scoreboardCountdownOutcomes.map((outcome) => {
                                const progress = calculateOutcomeProgress(outcome);
                                return (
                                  <div key={outcome.id} className="space-y-2 rounded-2xl border border-white/50 bg-white/40 p-3 backdrop-blur-sm">
                                    <div className="flex items-start justify-between gap-4">
                                      <div>
                                        <div className="font-medium text-slate-900">{outcome.label || 'Untitled outcome'}</div>
                                        <div className="text-sm text-slate-600">
                                          {formatOutcomeValue(outcome.currentValue || '0', outcome.unit, outcome.unitPosition)} / {formatOutcomeValue(outcome.endingValue || '0', outcome.unit, outcome.unitPosition)}
                                        </div>
                                      </div>
                                      <Badge variant="secondary">{progress}%</Badge>
                                    </div>
                                    <Progress value={progress} className="h-2.5" />
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        ) : !hasConfiguredCountdown ? (
                          <div className="text-sm text-slate-600">No countdown or scoreboard outcomes set yet.</div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="rounded-2xl border shadow-none">
                      <CardContent className="p-6 text-sm text-slate-500">
                        No countdown or outcomes set yet. Set them up in the Editor tab.
                      </CardContent>
                    </Card>
                  )}

                  {Object.keys(defaultMetricLabels).some(k => data.metricLabels[k]) ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.keys(defaultMetricLabels).filter(k => data.metricLabels[k]).map((key) => (
                      <Card key={key} className="rounded-2xl border shadow-none">
                        <CardContent className="space-y-2 p-4">
                          <label className="text-sm font-medium">{data.metricLabels[key]}</label>
                          <Input value={todayMetrics[key]} onChange={(e) => updateMetric(key, e.target.value)} className="rounded-xl" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  ) : (
                  <Card className="rounded-2xl border shadow-none">
                    <CardContent className="p-5 text-sm text-slate-500">
                      No performance metrics set up yet. Name them in the Editor tab under "Weekly Performance".
                    </CardContent>
                  </Card>
                  )}
                </TabsContent>

                <TabsContent value="calendar" className="mt-6 space-y-6">
                  <Card className="rounded-2xl border shadow-none">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">Calendar History</CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-xl"
                            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <div className="min-w-[160px] text-center text-sm font-medium">
                            {calendarMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-xl"
                            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-500">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <div key={day}>{day}</div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {monthRows.map((row, rowIndex) => (
                          <div key={rowIndex} className="grid grid-cols-7 gap-2">
                            {row.map((dateObj, cellIndex) => {
                              if (!dateObj) {
                                return <div key={cellIndex} className="h-20 rounded-2xl border border-dashed border-slate-100" />;
                              }
                              const key = getTodayKey(dateObj);
                              const isToday = key === currentDateKey;
                              const isSelected = key === selectedDateKey;
                              const progress = getDateProgress(key);
                              const inCountdownRange = hasConfiguredCountdown && isInCountdownRange(dateObj);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDateKey(key);
                                    if (key < currentDateKey) {
                                      setArchiveDateKey(key);
                                    } else {
                                      setArchiveDateKey(null);
                                    }
                                  }}
                                  className={`relative h-20 overflow-hidden rounded-2xl border p-2 text-left transition ${isSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-400'} ${isToday ? 'ring-2 ring-slate-300' : ''} ${key > currentDateKey ? 'opacity-30 cursor-not-allowed' : ''}`}
                                >
                                  {inCountdownRange && !isSelected ? <div className={`absolute inset-0 ${countdownStyles.fill}`} /> : null}
                                  <div className="relative flex items-center justify-between text-xs">
                                    <span>{dateObj.getDate()}</span>
                                    <span>{progress}%</span>
                                  </div>
                                  <div className={`relative mt-3 h-2 rounded-full ${isSelected ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                    <div className={`h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-900'}`} style={{ width: `${progress}%` }} />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">{formatLongDate(selectedDateKey)}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium">Saved progress</span>
                          <span>{selectedProgress}%</span>
                        </div>
                        <Progress value={selectedProgress} className="h-3" />
                        <p className="mt-2 text-sm text-slate-500">{selectedCompleted} of {data.dailyTemplate.length} tasks completed</p>
                      </div>

                      {Object.keys(defaultMetricLabels).some(k => data.metricLabels[k]) && (
                      <div className="grid gap-4 md:grid-cols-2">
                        {Object.keys(defaultMetricLabels).filter(k => data.metricLabels[k]).map((key) => (
                          <div key={key} className="rounded-2xl border p-4">
                            <div className="text-xs text-slate-500">{data.metricLabels[key]}</div>
                            <div className="mt-1 text-lg font-semibold">{selectedDateMetrics[key] || '—'}</div>
                          </div>
                        ))}
                      </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">Progress notes</label>
                          <Textarea
                            value={selectedReflection.progress || ''}
                            onChange={(e) => updateReflection('progress', e.target.value)}
                            placeholder="What moved forward today?"
                            className="mt-2 min-h-[110px] rounded-2xl"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Wins</label>
                          <Textarea
                            value={selectedReflection.wins || ''}
                            onChange={(e) => updateReflection('wins', e.target.value)}
                            placeholder="Big wins, closes, momentum, discipline wins..."
                            className="mt-2 min-h-[110px] rounded-2xl"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Reflection</label>
                          <Textarea
                            value={selectedReflection.reflection || ''}
                            onChange={(e) => updateReflection('reflection', e.target.value)}
                            placeholder="What worked, what did not, what needs to change tomorrow?"
                            className="mt-2 min-h-[140px] rounded-2xl"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="editor" className="mt-6 space-y-3">
                  <CollapsibleSection title="Daily Task Editor">
                    <Button onClick={restoreDefaults} variant="outline" className="rounded-2xl">
                      <RotateCcw className="mr-2 h-4 w-4" /> Restore Default Tasks
                    </Button>
                    <BlockTaskEditor title="Daily Task Editor" tasks={data.dailyTemplate} setTasks={setDailyTemplate} suggestions={dailyBlockSuggestions} alarms={data.blockAlarms.daily} onAlarmChange={(section, field, value) => updateBlockAlarm('daily', section, field, value)} />
                  </CollapsibleSection>

                  <CollapsibleSection title="Weekly Task Editor">
                    <BlockTaskEditor title="Weekly Task Editor" tasks={data.weeklyTemplate} setTasks={setWeeklyTemplate} suggestions={weeklyBlockSuggestions} alarms={data.blockAlarms.weekly} onAlarmChange={(section, field, value) => updateBlockAlarm('weekly', section, field, value)} />
                  </CollapsibleSection>

                  <CollapsibleSection title="Weekly Routine">
                    <WeeklyRoutineEditor routine={weeklyRoutine} setRoutine={setWeeklyRoutine} todayDayName={parseKey(currentDateKey).toLocaleDateString([], { weekday: 'long' })} />
                  </CollapsibleSection>

                  <CollapsibleSection title="Weekly Performance">
                    <p className="text-xs text-slate-500">Name each metric you want to track (leave blank to hide it). Then set your weekly targets.</p>
                    <div className="space-y-3">
                      {Object.keys(defaultMetricLabels).map((key) => (
                        <Card key={key} className="rounded-2xl border shadow-none">
                          <CardContent className="grid grid-cols-2 gap-3 p-4">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-slate-500">Metric name</label>
                              <Input
                                value={data.metricLabels[key]}
                                onChange={(e) => updateMetricLabel(key, e.target.value)}
                                placeholder="e.g. Calls, Revenue…"
                                className="rounded-xl"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-slate-500">Weekly target</label>
                              <Input
                                value={data.targets[key] || ''}
                                onChange={(e) => updateTarget(key, e.target.value)}
                                placeholder="—"
                                disabled={!data.metricLabels[key]}
                                className="rounded-xl disabled:opacity-40"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Goal Countdown & Outcomes">
                    <CountdownEditor countdown={countdown} setCountdown={setCountdown} clearCountdown={clearCountdown} cardStyle={countdownStyles.card} />
                    <OutcomeEditor outcomes={countdownOutcomes} setOutcomes={setCountdownOutcomes} cardStyle={countdownStyles.card} />
                  </CollapsibleSection>
                </TabsContent>

                <TabsContent value="alerts" className="mt-6 space-y-3">
                  <CollapsibleSection title="Browser Notifications">
                    <div className="flex items-center justify-between rounded-2xl border p-4">
                      <div>
                        <div className="text-sm font-medium">Permission</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {typeof Notification === 'undefined' ? 'Not supported' : Notification.permission === 'granted' ? '✓ Granted' : Notification.permission === 'denied' ? '✗ Denied — enable in browser settings' : 'Not requested yet'}
                        </div>
                      </div>
                      {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                        <Button onClick={requestNotificationPermission} className="rounded-xl shrink-0">Enable</Button>
                      )}
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Sound">
                    <div className="flex items-center justify-between rounded-2xl border p-4">
                      <div className="text-sm font-medium">Sound enabled</div>
                      <Switch checked={data.notifications.soundEnabled} onCheckedChange={(v) => updateNotification('soundEnabled', v)} />
                    </div>
                    {data.notifications.soundEnabled && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Sound type</div>
                        <div className="grid grid-cols-3 gap-2">
                          {['chime', 'beep', 'silent'].map((t) => (
                            <Button key={t} type="button" variant={data.notifications.soundType === t ? 'default' : 'outline'} onClick={() => updateNotification('soundType', t)} className="rounded-xl capitalize">{t}</Button>
                          ))}
                        </div>
                        <Button variant="outline" className="rounded-xl w-full" onClick={() => playSound(data.notifications.soundType)}>
                          Test Sound
                        </Button>
                      </div>
                    )}
                  </CollapsibleSection>

                  <CollapsibleSection title="Alarms">
                    <div className="space-y-3">
                      {Object.entries(data.notifications.alarms).map(([key, alarm]) => (
                        <div key={key} className="rounded-2xl border p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Input
                              value={alarm.label}
                              onChange={(e) => updateNotification(`alarms.${key}.label`, e.target.value)}
                              className="flex-1 rounded-xl text-sm font-medium"
                            />
                            <Switch checked={alarm.enabled} onCheckedChange={(v) => updateNotification(`alarms.${key}.enabled`, v)} />
                            <Button variant="outline" size="icon" className="shrink-0 rounded-xl" onClick={() => removeAlarm(key)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {alarm.enabled && (
                            <Input type="time" value={alarm.time} onChange={(e) => updateNotification(`alarms.${key}.time`, e.target.value)} className="rounded-xl" />
                          )}
                        </div>
                      ))}
                      <Button variant="outline" className="rounded-xl w-full" onClick={addAlarm}>
                        <Plus className="mr-2 h-4 w-4" /> Add Alarm
                      </Button>
                    </div>
                  </CollapsibleSection>
                </TabsContent>

                </motion.div>
              </Tabs>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}>
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CalendarDays className="h-5 w-5" /> {parseKey(currentDateKey).toLocaleDateString([], { weekday: 'long' })} To-Do List
                  </CardTitle>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setIsEditingTodayTodo((prev) => !prev)}>
                    {isEditingTodayTodo ? 'Done' : 'Edit'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xs text-slate-500">Auto-populated from your current day in the Weekly tab.</div>

                {isEditingTodayTodo ? (
                  <>
                    <div>
                      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Notes</div>
                      <Textarea
                        value={todayWeekPlan.note}
                        onChange={(e) => updateWeekDayPlan(currentDateKey, e.target.value)}
                        placeholder="Add notes for today"
                        className="min-h-[120px] rounded-2xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Checklist</div>
                      {todayWeekPlan.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <Checkbox checked={item.done} onCheckedChange={(checked) => updateWeekDayItem(currentDateKey, item.id, 'done', !!checked)} />
                          <Input
                            value={item.text}
                            onChange={(e) => updateWeekDayItem(currentDateKey, item.id, 'text', e.target.value)}
                            placeholder="Checklist item"
                            className="rounded-xl"
                          />
                          <Button variant="outline" size="icon" className="rounded-xl" onClick={() => removeWeekDayItem(currentDateKey, item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button onClick={addTodayTodoItem} variant="outline" className="rounded-xl w-full">
                        <Plus className="mr-2 h-4 w-4" /> Add Checklist Item
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {todayWeekPlan.note ? (
                      <div className="rounded-2xl border p-4">
                        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Notes</div>
                        <div className="whitespace-pre-wrap text-sm text-slate-700">{todayWeekPlan.note}</div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">
                        No notes added yet for today in This Week by Day.
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Checklist</div>
                      {todayWeekPlan.items.length ? (
                        todayWeekPlan.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 rounded-2xl border p-3">
                            <Checkbox checked={item.done} onCheckedChange={(checked) => updateWeekDayItem(currentDateKey, item.id, 'done', !!checked)} />
                            <span className={`text-sm ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                              {item.text || 'Untitled checklist item'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">
                          No checklist items added yet for today.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}>
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Laptop className="h-5 w-5" /> Notes / Focus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={data.notes}
                  onChange={(e) => setData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Daily priorities, closes to push, Mi-Lot ideas, setup notes..."
                  className="min-h-[180px] rounded-2xl"
                />
              </CardContent>
            </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}>
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5" /> Momentum Score
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-4xl font-semibold">{score}</div>
                <p className="text-sm text-slate-600">Simple score from completed daily and weekly tasks. The goal is consistency, not perfection.</p>
                {countdown.includeInMomentum && countdownOutcomes.length ? (
                  <div className="rounded-2xl border p-3 text-sm text-slate-600">
                    Countdown bonus included: +{countdownMomentumBonus}
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border p-3">
                    <div className="flex items-center gap-2 font-medium">
                      <Clock3 className="h-4 w-4" /> Morning anchor
                    </div>
                    <div className="text-slate-500">{data.notifications.alarms.wake?.time || '—'} wake</div>
                  </div>
                  <div className="rounded-2xl border p-3">
                    <div className="flex items-center gap-2 font-medium">
                      <Moon className="h-4 w-4" /> Night anchor
                    </div>
                    <div className="text-slate-500">{data.notifications.alarms.sleep?.time || '—'} sleep</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}>
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5" /> About this app
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-600">
                <div className="space-y-2">
                  <p>Build daily habits, track weekly goals, and measure progress toward a personal reset. Everything saves automatically to your device.</p>
                  <p>Customize your task lists, set a goal countdown, and configure alarms in the Editor and Alerts tabs.</p>
                  <p>On mobile, swipe left and right to switch between tabs. Tap a past day on the Calendar to view your archived progress.</p>
                </div>
                <Button variant="outline" className="rounded-2xl w-full" onClick={restartTutorial}>
                  Take the tour
                </Button>
              </CardContent>
            </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

