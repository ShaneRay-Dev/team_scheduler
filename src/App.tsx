import { useEffect, useMemo, useState } from 'react'
import {
  buildTeamHistory,
  generateBestAssignments,
  getAllTablePairs,
  getPairKey,
  type Discipline,
  type SavedWeek,
  type TeamMatchup,
} from './assignmentEngine'

type Team = {
  id: string
  number?: string
  name: string
  active: boolean
  divisionId?: string
}

type DivisionType = '8 ball' | '9 ball' | 'Double Jeopardy' | 'Scotch Doubles' | 'Masters'

type Division = {
  id: string
  number: string
  name: string
  type: DivisionType
  tableCount: number
}

type LeagueSettings = {
  name: string
  tableCount: number
  tablesPerMatchup: number
  eightBallEnabled: boolean
  nineBallEnabled: boolean
  leagueNight: string
  defaultGenerationTime: string
}

type MatchupForm = {
  id: string
  discipline: Discipline
  teamAId: string
  teamBId: string
}

type Week = {
  id: string
  divisionId?: string
  weekNumber: number
  date: string
  status: 'draft' | 'saved'
  generatedAt?: string
  savedAt?: string
  eightBall: MatchupForm[]
  nineBall: MatchupForm[]
  assignments: Array<{
    id: string
    matchupId: string
    discipline: Discipline
    teamAId: string
    teamBId: string
    tables: [number, number]
    originalTables?: [number, number]
    manualOverride: boolean
    score: number
  }>
  summary?: {
    overallScore: number
    adjacency: string
    historicalRepeat: string
    roomSeparation: string
  }
}

type AppState = {
  league: LeagueSettings
  divisions: Division[]
  teams: Team[]
  weeks: Week[]
  activeWeekId: string
}

const STORAGE_KEY = 'pool-league-suite-state-v1'

const defaultTeams: Team[] = [
  { id: 'team-1', name: 'The Rack Pack', active: true },
  { id: 'team-2', name: 'Break Shot Society', active: true },
  { id: 'team-3', name: 'Corner Pocket Crew', active: true },
  { id: 'team-4', name: 'Blue Moon Billiards', active: true },
  { id: 'team-5', name: 'Rail Pressure', active: true },
  { id: 'team-6', name: 'The Golden Arcs', active: true },
  { id: 'team-7', name: 'Pocket Hustlers', active: true },
  { id: 'team-8', name: 'Velvet Breaks', active: true },
]

const defaultDivisions: Division[] = [{ id: 'division-1', number: '192', name: 'Thursday League', type: 'Double Jeopardy', tableCount: 10 }]

const defaultLeague: LeagueSettings = {
  name: 'Riverside City League',
  tableCount: 10,
  tablesPerMatchup: 2,
  eightBallEnabled: true,
  nineBallEnabled: true,
  leagueNight: 'Thursday',
  defaultGenerationTime: '7:30 PM',
}

const makeMatchup = (discipline: Discipline, teamAId: string, teamBId: string): MatchupForm => ({
  id: `${discipline}-${teamAId}-${teamBId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  discipline,
  teamAId,
  teamBId,
})

const createDefaultWeeks = (): Week[] => {
  const week12 = {
    id: 'week-12',
    divisionId: 'division-1',
    weekNumber: 12,
    date: '2026-10-15',
    status: 'draft' as const,
    eightBall: [
      makeMatchup('8-ball', 'team-1', 'team-2'),
      makeMatchup('8-ball', 'team-3', 'team-4'),
      makeMatchup('8-ball', 'team-5', 'team-6'),
      makeMatchup('8-ball', 'team-7', 'team-8'),
    ],
    nineBall: [
      makeMatchup('9-ball', 'team-1', 'team-3'),
      makeMatchup('9-ball', 'team-2', 'team-5'),
      makeMatchup('9-ball', 'team-4', 'team-7'),
    ],
    assignments: [],
  }

  const week10: Week = {
    id: 'week-10',
    divisionId: 'division-1',
    weekNumber: 10,
    date: '2026-10-01',
    status: 'saved',
    savedAt: '2026-10-02T19:45:00.000Z',
    eightBall: [
      makeMatchup('8-ball', 'team-1', 'team-2'),
      makeMatchup('8-ball', 'team-3', 'team-4'),
      makeMatchup('8-ball', 'team-5', 'team-6'),
    ],
    nineBall: [
      makeMatchup('9-ball', 'team-1', 'team-5'),
      makeMatchup('9-ball', 'team-2', 'team-7'),
    ],
    assignments: [
      {
        id: 'w10-a1',
        matchupId: 'generated-week10-1',
        discipline: '8-ball',
        teamAId: 'team-1',
        teamBId: 'team-2',
        tables: [1, 2],
        manualOverride: false,
        score: 31,
      },
      {
        id: 'w10-a2',
        matchupId: 'generated-week10-2',
        discipline: '8-ball',
        teamAId: 'team-3',
        teamBId: 'team-4',
        tables: [3, 4],
        manualOverride: false,
        score: 31,
      },
      {
        id: 'w10-a3',
        matchupId: 'generated-week10-3',
        discipline: '8-ball',
        teamAId: 'team-5',
        teamBId: 'team-6',
        tables: [5, 6],
        manualOverride: false,
        score: 31,
      },
      {
        id: 'w10-a4',
        matchupId: 'generated-week10-4',
        discipline: '9-ball',
        teamAId: 'team-1',
        teamBId: 'team-5',
        tables: [7, 8],
        manualOverride: false,
        score: 29,
      },
      {
        id: 'w10-a5',
        matchupId: 'generated-week10-5',
        discipline: '9-ball',
        teamAId: 'team-2',
        teamBId: 'team-7',
        tables: [9, 10],
        manualOverride: false,
        score: 27,
      },
    ],
    summary: {
      overallScore: 92,
      adjacency: '5/5 adjacent table pairs',
      historicalRepeat: 'No historical repeats',
      roomSeparation: 'No cross-room assignments',
    },
  }

  const week11: Week = {
    id: 'week-11',
    divisionId: 'division-1',
    weekNumber: 11,
    date: '2026-10-08',
    status: 'saved',
    savedAt: '2026-10-09T19:15:00.000Z',
    eightBall: [
      makeMatchup('8-ball', 'team-1', 'team-8'),
      makeMatchup('8-ball', 'team-2', 'team-6'),
      makeMatchup('8-ball', 'team-3', 'team-5'),
    ],
    nineBall: [
      makeMatchup('9-ball', 'team-2', 'team-4'),
      makeMatchup('9-ball', 'team-6', 'team-7'),
      makeMatchup('9-ball', 'team-1', 'team-3'),
    ],
    assignments: [
      {
        id: 'w11-a1',
        matchupId: 'generated-week11-1',
        discipline: '8-ball',
        teamAId: 'team-1',
        teamBId: 'team-8',
        tables: [2, 3],
        manualOverride: false,
        score: 30,
      },
      {
        id: 'w11-a2',
        matchupId: 'generated-week11-2',
        discipline: '8-ball',
        teamAId: 'team-2',
        teamBId: 'team-6',
        tables: [4, 5],
        manualOverride: false,
        score: 28,
      },
      {
        id: 'w11-a3',
        matchupId: 'generated-week11-3',
        discipline: '8-ball',
        teamAId: 'team-3',
        teamBId: 'team-5',
        tables: [7, 8],
        manualOverride: false,
        score: 29,
      },
      {
        id: 'w11-a4',
        matchupId: 'generated-week11-4',
        discipline: '9-ball',
        teamAId: 'team-2',
        teamBId: 'team-4',
        tables: [1, 2],
        manualOverride: false,
        score: 31,
      },
      {
        id: 'w11-a5',
        matchupId: 'generated-week11-5',
        discipline: '9-ball',
        teamAId: 'team-6',
        teamBId: 'team-7',
        tables: [9, 10],
        manualOverride: false,
        score: 24,
      },
      {
        id: 'w11-a6',
        matchupId: 'generated-week11-6',
        discipline: '9-ball',
        teamAId: 'team-1',
        teamBId: 'team-3',
        tables: [5, 6],
        manualOverride: true,
        originalTables: [6, 7],
        score: 22,
      },
    ],
    summary: {
      overallScore: 89,
      adjacency: '5/6 adjacent table pairs',
      historicalRepeat: '1 unavoidable repeat',
      roomSeparation: '0 cross-room assignments',
    },
  }

  return [week10, week11, week12]
}

const defaultState: AppState = {
  league: defaultLeague,
  divisions: defaultDivisions,
  teams: defaultTeams.map((team) => ({ ...team, divisionId: 'division-1' })),
  weeks: createDefaultWeeks(),
  activeWeekId: 'week-12',
}

function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw) as AppState
    const weeks = parsed.weeks?.length ? parsed.weeks : createDefaultWeeks()
    const divisions = parsed.divisions?.length
      ? parsed.divisions
      : [{ id: 'division-1', number: '192', name: 'Thursday League', type: 'Double Jeopardy' as const, tableCount: parsed.league?.tableCount ?? 10 }]
    const normalizedDivisions = divisions.map((division, index) => ({ ...division, number: division.number ?? String(192 + index), tableCount: division.tableCount ?? parsed.league?.tableCount ?? 10 }))
    const teams = parsed.teams?.length ? parsed.teams : defaultTeams
    const activeWeekId = weeks.some((week) => week.id === parsed.activeWeekId)
      ? parsed.activeWeekId!
      : weeks[0].id
    return {
      league: parsed.league ?? defaultLeague,
      teams: teams.map((team, index) => {
        const divisionId = team.divisionId ?? normalizedDivisions[0]?.id
        const division = normalizedDivisions.find((entry) => entry.id === divisionId)
        const inDivision = teams.filter((entry) => (entry.divisionId ?? normalizedDivisions[0]?.id) === divisionId)
        return { ...team, divisionId, number: team.number ?? (division ? `${division.number}${String(inDivision.findIndex((entry) => entry.id === team.id) + 1).padStart(2, '0')}` : `000${String(index + 1).padStart(2, '0')}`) }
      }),
      divisions: normalizedDivisions,
      weeks,
      activeWeekId,
    }
  } catch {
    return defaultState
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<'divisions' | 'division'>('divisions')
  const [divisionSection, setDivisionSection] = useState<'overview' | 'teams' | 'settings' | 'schedule'>('overview')
  const [selectedDivisionId, setSelectedDivisionId] = useState('division-1')
  const [state, setState] = useState<AppState>(loadState)
  const [teamForm, setTeamForm] = useState({ name: '' })
  const [divisionTeamName, setDivisionTeamName] = useState('')
  const [divisionForm, setDivisionForm] = useState({ number: '', name: '', type: '8 ball' as DivisionType, teamCount: 4 })
  const [selectedPairOverrides, setSelectedPairOverrides] = useState<Record<string, string>>({})
  const [scheduleRange, setScheduleRange] = useState({ start: 13, end: 20, firstDate: '2026-10-22' })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Keep the current session usable if browser storage is unavailable or full.
    }
  }, [state])

  const currentWeek = useMemo(
    () => state.weeks.find((week) => week.id === state.activeWeekId && week.divisionId === selectedDivisionId) ?? state.weeks.find((week) => week.divisionId === selectedDivisionId),
    [state, selectedDivisionId],
  )

  const selectedDivision = state.divisions.find((division) => division.id === selectedDivisionId) ?? state.divisions[0]
  const divisionTeams = state.teams.filter((team) => team.divisionId === selectedDivision?.id)
  const divisionWeeks = state.weeks.filter((week) => week.divisionId === selectedDivision?.id).sort((a, b) => a.weekNumber - b.weekNumber)
  const nextUpcomingWeeks = divisionWeeks.filter((week) => week.date >= new Date().toISOString().slice(0, 10)).slice(0, 3)

  const teamHistory = useMemo(() => buildTeamHistory(state.weeks.filter((week) => week.status === 'saved' && week.divisionId === selectedDivisionId)), [state.weeks, selectedDivisionId])

  const activeTeams = useMemo(
    () => state.teams.filter((team) => team.active),
    [state.teams],
  )

  const tableCount = selectedDivision?.tableCount ?? state.league.tableCount
  const tablePairOptions = useMemo(() => getAllTablePairs(tableCount), [tableCount])

  const byeTeams = useMemo(() => {
    if (!currentWeek) return []

    const used = new Set(
      [...currentWeek.eightBall, ...currentWeek.nineBall].flatMap((matchup) => [
        matchup.teamAId,
        matchup.teamBId,
      ]),
    )

    return state.teams.filter((team) => team.active && team.divisionId === selectedDivisionId && !used.has(team.id))
  }, [currentWeek, state.teams])

  const totalSavedWeeks = state.weeks.filter((week) => week.status === 'saved').length

  const handleSelectWeek = (id: string) => {
    setState((previous) => ({ ...previous, activeWeekId: id }))
  }

  const handleSelectDivision = (id: string) => {
    setSelectedDivisionId(id)
    const firstWeek = state.weeks.find((week) => week.divisionId === id)
    if (firstWeek) setState((previous) => ({ ...previous, activeWeekId: firstWeek.id }))
    setDivisionSection('overview')
    setActiveTab('division')
    setDivisionSection('overview')
  }

  const createScheduleRange = () => {
    if (!selectedDivision) return
    const start = Math.max(1, Math.floor(scheduleRange.start))
    const end = Math.max(start, Math.floor(scheduleRange.end))
    if (end - start > 51) {
      window.alert('Create up to 52 weeks at a time.')
      return
    }
    const missing = Array.from({ length: end - start + 1 }, (_, index) => start + index)
      .filter((weekNumber) => !divisionWeeks.some((week) => week.weekNumber === weekNumber))
    if (!missing.length) {
      window.alert('That date range already has schedules.')
      return
    }
    const firstDate = new Date(`${scheduleRange.firstDate}T12:00:00`)
    const newWeeks = missing.map((weekNumber) => {
      const date = new Date(firstDate)
      date.setDate(firstDate.getDate() + (weekNumber - start) * 7)
      return {
        id: `week-${selectedDivision.id}-${weekNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        divisionId: selectedDivision.id,
        weekNumber,
        date: date.toISOString().slice(0, 10),
        status: 'draft' as const,
        eightBall: [] as MatchupForm[],
        nineBall: [] as MatchupForm[],
        assignments: [] as Week['assignments'],
      }
    })
    setState((previous) => ({ ...previous, weeks: [...previous.weeks, ...newWeeks], activeWeekId: newWeeks[0].id }))
    setDivisionSection('schedule')
  }

  const handleAddTeam = () => {
    const name = teamForm.name.trim()
    if (!name) return

    const id = `team-${Date.now()}`
    setState((previous) => ({
      ...previous,
      teams: [...previous.teams, { id, name, active: true }],
    }))
    setTeamForm({ name: '' })
  }

  const handleAddDivision = () => {
    const name = divisionForm.name.trim()
    const number = divisionForm.number.trim()
    if (!name || !/^\d{1,4}$/.test(number)) { window.alert('Enter a division name and a numeric division number (1–4 digits).'); return }
    if (state.divisions.some((division) => division.number === number)) { window.alert('That division number is already in use.'); return }
    const divisionId = `division-${Date.now()}`
    const count = Math.max(4, Math.floor(divisionForm.teamCount) || 4)
    if (count > 99) { window.alert('A division can have up to 99 numbered teams.'); return }
    const newTeams = Array.from({ length: count }, (_, index) => ({
      id: `team-${Date.now()}-${index}`,
      number: `${number}${String(index + 1).padStart(2, '0')}`,
      name: `Team ${index + 1}`,
      active: true,
      divisionId,
    }))
    setState((previous) => ({
      ...previous,
      divisions: [...previous.divisions, { id: divisionId, number, name, type: divisionForm.type, tableCount: previous.league.tableCount }],
      teams: [...previous.teams, ...newTeams],
    }))
    setDivisionForm({ number: '', name: '', type: '8 ball', teamCount: 4 })
  }

  const updateTeamName = (teamId: string, name: string) => {
    setState((previous) => ({
      ...previous,
      teams: previous.teams.map((team) => team.id === teamId ? { ...team, name } : team),
    }))
  }

  const addTeamToDivision = () => {
    const name = divisionTeamName.trim()
    if (!name || !selectedDivision) return
    setState((previous) => {
      const used = new Set(previous.teams.filter((team) => team.divisionId === selectedDivision.id).map((team) => Number(team.number?.slice(-2))))
      let suffix = 1
      while (used.has(suffix) && suffix <= 99) suffix += 1
      if (suffix > 99) { window.alert('This division already has the maximum of 99 numbered teams.'); return previous }
      return { ...previous, teams: [...previous.teams, { id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, number: `${selectedDivision.number}${String(suffix).padStart(2, '0')}`, name, active: true, divisionId: selectedDivision.id }] }
    })
    setDivisionTeamName('')
  }

  const handleToggleTeam = (teamId: string) => {
    setState((previous) => ({
      ...previous,
      teams: previous.teams.map((team) =>
        team.id === teamId ? { ...team, active: !team.active } : team,
      ),
    }))
  }

  const handleDeleteTeam = (teamId: string) => {
    setState((previous) => ({
      ...previous,
      teams: previous.teams.filter((team) => team.id !== teamId),
    }))
  }

  const handleDeleteDivision = (divisionId: string) => {
    setState((previous) => {
      const removedTeamIds = new Set(previous.teams.filter((team) => team.divisionId === divisionId).map((team) => team.id))
      const weeks = previous.weeks.filter((week) => week.divisionId !== divisionId).map((week) => ({
        ...week,
        eightBall: week.eightBall.filter((matchup) => !removedTeamIds.has(matchup.teamAId) && !removedTeamIds.has(matchup.teamBId)),
        nineBall: week.nineBall.filter((matchup) => !removedTeamIds.has(matchup.teamAId) && !removedTeamIds.has(matchup.teamBId)),
        assignments: week.assignments.filter((assignment) => !removedTeamIds.has(assignment.teamAId) && !removedTeamIds.has(assignment.teamBId)),
      }))
      const divisions = previous.divisions.filter((division) => division.id !== divisionId)
      const teams = previous.teams.filter((team) => !removedTeamIds.has(team.id))
      const activeWeekId = weeks.some((week) => week.id === previous.activeWeekId) ? previous.activeWeekId : weeks[0]?.id ?? ''
      return { ...previous, divisions, teams, weeks, activeWeekId }
    })
    const remaining = state.divisions.filter((division) => division.id !== divisionId)
    if (selectedDivisionId === divisionId) {
      const nextDivision = remaining[0]
      if (nextDivision) setSelectedDivisionId(nextDivision.id)
      setActiveTab('divisions')
    }
  }

  const addMatchup = (discipline: Discipline) => {
    if (divisionTeams.filter((team) => team.active).length < 2) {
      window.alert('Add at least two active teams before creating a matchup.')
      return
    }
    setState((previous) => {
      const nextWeek = previous.weeks.find((week) => week.id === previous.activeWeekId && week.divisionId === selectedDivisionId) ?? previous.weeks.find((week) => week.divisionId === selectedDivisionId)
      if (!nextWeek) return previous
      const pool = discipline === '8-ball' ? nextWeek.eightBall : nextWeek.nineBall
      const usedIds = new Set(pool.flatMap((matchup) => [matchup.teamAId, matchup.teamBId]))
      const available = previous.teams.filter((team) => team.active && !usedIds.has(team.id))
      const firstAvailable = available[0] ?? previous.teams.find((team) => team.active && team.divisionId === selectedDivisionId)!
      const secondAvailable = available[1] ?? previous.teams.find((team) => team.active && team.divisionId === selectedDivisionId && team.id !== firstAvailable.id)!
      const updatedWeek = { ...nextWeek }
      updatedWeek[discipline === '8-ball' ? 'eightBall' : 'nineBall'] = [
        ...updatedWeek[discipline === '8-ball' ? 'eightBall' : 'nineBall'],
        makeMatchup(discipline, firstAvailable.id, secondAvailable.id),
      ]

      return {
        ...previous,
        weeks: previous.weeks.map((week) => (week.id === nextWeek.id ? updatedWeek : week)),
      }
    })
  }

  const invalidateWeekSchedule = (week: Week): Week => ({ ...week, assignments: [], summary: undefined, generatedAt: undefined })

  const updateMatchup = (discipline: Discipline, matchupId: string, teamKey: 'teamAId' | 'teamBId', teamId: string) => {
    setState((previous) => {
      const nextWeek = previous.weeks.find((week) => week.id === previous.activeWeekId && week.divisionId === selectedDivisionId) ?? previous.weeks.find((week) => week.divisionId === selectedDivisionId)
      if (!nextWeek) return previous
      const pool = discipline === '8-ball' ? nextWeek.eightBall : nextWeek.nineBall

      const updatedPool = pool.map((matchup) =>
        matchup.id === matchupId ? { ...matchup, [teamKey]: teamId } : matchup,
      )

      return {
        ...previous,
        weeks: previous.weeks.map((week) =>
          week.id === nextWeek.id
          ? { ...invalidateWeekSchedule(week), [discipline === '8-ball' ? 'eightBall' : 'nineBall']: updatedPool }
            : week,
        ),
      }
    })
  }

  const removeMatchup = (discipline: Discipline, matchupId: string) => {
    setState((previous) => {
      const nextWeek = previous.weeks.find((week) => week.id === previous.activeWeekId && week.divisionId === selectedDivisionId) ?? previous.weeks.find((week) => week.divisionId === selectedDivisionId)
      if (!nextWeek) return previous
      const targetKey = discipline === '8-ball' ? 'eightBall' : 'nineBall'

      return {
        ...previous,
        weeks: previous.weeks.map((week) =>
          week.id === nextWeek.id
            ? {
                ...invalidateWeekSchedule(week),
                [targetKey]: week[targetKey].filter((matchup) => matchup.id !== matchupId),
              }
            : week,
        ),
      }
    })
  }

  const generateAssignments = () => {
    if (!currentWeek) return

    const matchups: TeamMatchup[] = [
      ...currentWeek.eightBall.map((matchup) => ({
        id: matchup.id,
        discipline: matchup.discipline,
        teamAId: matchup.teamAId,
        teamBId: matchup.teamBId,
      })),
      ...currentWeek.nineBall.map((matchup) => ({
        id: matchup.id,
        discipline: matchup.discipline,
        teamAId: matchup.teamAId,
        teamBId: matchup.teamBId,
      })),
    ]

    const seenIds = new Set<string>()
    const usedTeams = new Map<Discipline, Set<string>>()
    for (const matchup of matchups) {
      const teams = usedTeams.get(matchup.discipline) ?? new Set<string>()
      if (seenIds.has(matchup.id) || matchup.teamAId === matchup.teamBId || teams.has(matchup.teamAId) || teams.has(matchup.teamBId)) {
        window.alert('Each matchup needs two different teams, and a team can appear only once per discipline.')
        return
      }
      seenIds.add(matchup.id)
      teams.add(matchup.teamAId)
      teams.add(matchup.teamBId)
      usedTeams.set(matchup.discipline, teams)
    }

    const result = generateBestAssignments(matchups, state.weeks.filter((week) => week.status === 'saved' && week.divisionId === selectedDivisionId), tableCount)
    if (matchups.length && result.assignments.length !== matchups.length) {
      window.alert('There are not enough available tables for these matchups. Reduce the matchups or increase the table count.')
      return
    }

    const nextAssignments = result.assignments.map((assignment, index) => {
      const matchup = matchups.find((entry) => entry.id === assignment.matchupId)
      const pair = assignment.pair

      return {
        id: `${matchup?.discipline ?? 'match'}-${assignment.matchupId}-${index}`,
        matchupId: assignment.matchupId,
        discipline: matchup?.discipline ?? '8-ball',
        teamAId: matchup?.teamAId ?? '',
        teamBId: matchup?.teamBId ?? '',
        tables: pair,
        manualOverride: false,
        score: assignment.score,
      }
    })

    setState((previous) => ({
      ...previous,
      weeks: previous.weeks.map((week) =>
        week.id === previous.activeWeekId
          ? {
              ...week,
              assignments: nextAssignments,
              summary: result.summary,
              generatedAt: new Date().toISOString(),
            }
          : week,
      ),
    }))
  }

  const saveWeek = () => {
    if (!currentWeek) return
    if (!currentWeek.assignments.length || currentWeek.assignments.length !== currentWeek.eightBall.length + currentWeek.nineBall.length) {
      window.alert('Generate a complete schedule before saving this week.')
      return
    }
    if (currentWeek.status === 'saved') {
      window.alert('This week is already saved. Duplicate it as a new week before changing its saved schedule.')
      return
    }

    setState((previous) => ({
      ...previous,
      weeks: previous.weeks.map((week) =>
        week.id === previous.activeWeekId
          ? {
              ...week,
              status: 'saved',
              savedAt: new Date().toISOString(),
            }
          : week,
      ),
    }))
  }

  const handleOverride = (assignmentId: string, selectedTables: string) => {
    if (!currentWeek) return

    const [first, second] = selectedTables.split('-').map(Number)
    const pair: [number, number] = [first, second]
    const conflicting = currentWeek.assignments.some((assignment) =>
      assignment.id !== assignmentId && assignment.tables.some((table) => pair.includes(table)),
    )
    if (conflicting) {
      window.alert('Those tables are already assigned to another matchup.')
      return
    }

    setSelectedPairOverrides((previous) => ({
      ...previous,
      [assignmentId]: selectedTables,
    }))

    setState((previous) => ({
      ...previous,
      weeks: previous.weeks.map((week) =>
        week.id === previous.activeWeekId
          ? {
              ...week,
              assignments: week.assignments.map((assignment) =>
                assignment.id === assignmentId
                  ? {
                      ...assignment,
                      tables: pair,
                      originalTables: assignment.originalTables ?? assignment.tables,
                      manualOverride: true,
                    }
                  : assignment,
              ),
            }
          : week,
      ),
    }))
  }

  const currentAssignments = currentWeek?.assignments ?? []

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">League management</p>
          <h1>{state.league.name}</h1>
        </div>
        <nav className="main-nav" aria-label="Main navigation"><button type="button" className={activeTab === 'divisions' ? 'nav-button active' : 'nav-button'} onClick={() => setActiveTab('divisions')}>Divisions</button>{activeTab === 'division' && <span className="muted">{selectedDivision?.name}</span>}</nav>
      </header>

      {activeTab === 'divisions' && (
        <main className="content-grid single-col">
          <section className="panel">
            <div className="panel-header">
              <h2>Divisions</h2>
            </div>
            <div className="division-adder">
              <h3>Create a division</h3>
              <div className="settings-grid">
                <label><span>Division number</span><input inputMode="numeric" value={divisionForm.number} onChange={(event) => setDivisionForm({ ...divisionForm, number: event.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="e.g. 192" /></label>
                <label><span>Division name</span><input value={divisionForm.name} onChange={(event) => setDivisionForm({ ...divisionForm, name: event.target.value })} placeholder="e.g. Thursday Night" /></label>
                <label><span>Division type</span><select value={divisionForm.type} onChange={(event) => setDivisionForm({ ...divisionForm, type: event.target.value as DivisionType })}>{['8 ball', '9 ball', 'Double Jeopardy', 'Scotch Doubles', 'Masters'].map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                <label><span>Number of teams (minimum 4)</span><input type="number" min={4} step={1} value={divisionForm.teamCount} onChange={(event) => setDivisionForm({ ...divisionForm, teamCount: Math.max(4, Number(event.target.value) || 4) })} /></label>
                <button type="button" onClick={handleAddDivision}>Create division and teams</button>
              </div>
            </div>
            <div className="division-list">
              {state.divisions.map((division) => (
                <div key={division.id} className="division-card division-card-row">
                  <button type="button" className="division-card-button" onClick={() => handleSelectDivision(division.id)}>
                    <div className="panel-header"><div><h3>Division {division.number} · {division.name}</h3><span className="muted">{division.type} · {state.teams.filter((team) => team.divisionId === division.id).length} teams</span></div><span>Open division →</span></div>
                    <p className="muted">{state.teams.filter((team) => team.divisionId === division.id && team.active).slice(0, 5).map((team) => team.name).join(' · ')}</p>
                  </button>
                  <button type="button" className="danger" onClick={() => handleDeleteDivision(division.id)}>Remove division</button>
                </div>
              ))}
              {state.teams.some((team) => !team.divisionId || !state.divisions.some((division) => division.id === team.divisionId)) && (
                <section className="division-card"><h3>Unassigned teams</h3><div className="team-adder"><input value={teamForm.name} onChange={(event) => setTeamForm({ name: event.target.value })} placeholder="New team name" /><button type="button" onClick={handleAddTeam}>Add team</button></div><div className="team-list">
                  {state.teams.filter((team) => !team.divisionId || !state.divisions.some((division) => division.id === team.divisionId)).map((team) => (
                    <div key={team.id} className="team-card"><div><strong>{team.name}</strong><div className="meta-row"><span className={team.active ? 'status active' : 'status inactive'}>{team.active ? 'Active' : 'Inactive'}</span><span>Team ID {team.id}</span></div></div><div className="team-actions"><button type="button" onClick={() => handleToggleTeam(team.id)}>{team.active ? 'Disable' : 'Reactivate'}</button><button type="button" className="danger" onClick={() => handleDeleteTeam(team.id)}>Delete</button></div></div>
                  ))}
                </div></section>
              )}
            </div>
          </section>
        </main>
      )}

      {false && (
        <main className="content-grid single-col">
          <section className="panel form-panel">
            <div className="panel-header">
              <h2>League settings</h2>
            </div>
            <div className="settings-grid">
              <label>
                <span>League name</span>
                <input
                  value={state.league.name}
                  onChange={(event) =>
                    setState((previous) => ({
                      ...previous,
                      league: { ...previous.league, name: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                <span>Number of tables</span>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={state.league.tableCount}
                  onChange={(event) =>
                    setState((previous) => ({
                      ...previous,
                      league: { ...previous.league, tableCount: Number(event.target.value) },
                    }))
                  }
                />
              </label>
              <label>
                <span>Tables per matchup</span>
                <input
                  type="number"
                  min={2}
                  max={4}
                  value={state.league.tablesPerMatchup}
                  onChange={(event) =>
                    setState((previous) => ({
                      ...previous,
                      league: { ...previous.league, tablesPerMatchup: Number(event.target.value) },
                    }))
                  }
                />
              </label>
              <label>
                <span>8-ball enabled</span>
                <input
                  type="checkbox"
                  checked={state.league.eightBallEnabled}
                  onChange={(event) =>
                    setState((previous) => ({
                      ...previous,
                      league: { ...previous.league, eightBallEnabled: event.target.checked },
                    }))
                  }
                />
              </label>
              <label>
                <span>9-ball enabled</span>
                <input
                  type="checkbox"
                  checked={state.league.nineBallEnabled}
                  onChange={(event) =>
                    setState((previous) => ({
                      ...previous,
                      league: { ...previous.league, nineBallEnabled: event.target.checked },
                    }))
                  }
                />
              </label>
              <label>
                <span>League night</span>
                <input
                  value={state.league.leagueNight}
                  onChange={(event) =>
                    setState((previous) => ({
                      ...previous,
                      league: { ...previous.league, leagueNight: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                <span>Default generation time</span>
                <input
                  value={state.league.defaultGenerationTime}
                  onChange={(event) =>
                    setState((previous) => ({
                      ...previous,
                      league: { ...previous.league, defaultGenerationTime: event.target.value },
                    }))
                  }
                />
              </label>
            </div>
            <div className="topology-box">
              <h3>Table topology</h3>
              <div className="room-block">
                <strong>Room 1</strong>
                <span>1 — 2 — 3 — 4 — 5 — 6 — 7 — 8</span>
              </div>
              <div className="room-block">
                <strong>Room 2</strong>
                <span>9 — 10</span>
              </div>
            </div>
          </section>
        </main>
      )}

      {activeTab === 'division' && selectedDivision && (
        <main className="content-grid single-col week-layout">
          <section className="panel">
            <div className="panel-header"><div><button type="button" className="ghost" onClick={() => setActiveTab('divisions')}>← Divisions</button><h2>Division {selectedDivision.number} · {selectedDivision.name}</h2><p className="muted">{selectedDivision.type}</p></div></div>
            <div className="division-workspace-tabs">
              {(['overview', 'teams', 'settings', 'schedule'] as const).map((section) => <button key={section} className={divisionSection === section ? 'nav-button active' : 'nav-button'} onClick={() => setDivisionSection(section)}>{section[0].toUpperCase() + section.slice(1)}</button>)}
            </div>
            {divisionSection === 'overview' && <div className="division-overview">
              <section><div className="panel-header"><h3>Teams</h3><span className="muted">{divisionTeams.length} teams</span></div><button type="button" onClick={() => setDivisionSection('teams')}>Manage teams</button></section>
              <section><div className="panel-header"><h3>Next upcoming matches</h3><button type="button" onClick={() => setDivisionSection('schedule')}>Open schedule</button></div>{nextUpcomingWeeks.length ? nextUpcomingWeeks.map((week) => <div key={week.id} className="upcoming-week"><strong>Week {week.weekNumber} · {week.date}</strong>{[...week.eightBall, ...week.nineBall].length ? [...week.eightBall, ...week.nineBall].map((matchup) => <p key={matchup.id}>{state.teams.find((team) => team.id === matchup.teamAId)?.name ?? 'Team'} vs {state.teams.find((team) => team.id === matchup.teamBId)?.name ?? 'Team'} <span className="muted">({matchup.discipline})</span></p>) : <p className="muted">Matchups not entered yet</p>}</div>) : <p className="muted">No upcoming matches scheduled.</p>}</section>
            </div>}
            {divisionSection === 'teams' && <div className="team-list"><div className="team-adder"><input aria-label="New team name" value={divisionTeamName} onChange={(event) => setDivisionTeamName(event.target.value)} placeholder="New team name" /><button type="button" onClick={addTeamToDivision}>Add team</button></div>{divisionTeams.map((team, index) => <div key={team.id} className="team-card"><div className="team-name-field"><label htmlFor={`division-team-${team.id}`}>Team name</label><input id={`division-team-${team.id}`} value={team.name} onChange={(event) => updateTeamName(team.id, event.target.value)} /><span>Team number <strong>{team.number}</strong></span><span>Team number <strong>{team.number ?? `${selectedDivision.number}${String(index + 1).padStart(2, '0')}`}</strong></span><span className={team.active ? 'status active' : 'status inactive'}>{team.active ? 'Active' : 'Inactive'}</span></div><div className="team-actions"><button type="button" onClick={() => handleToggleTeam(team.id)}>{team.active ? 'Disable' : 'Reactivate'}</button><button type="button" className="danger" onClick={() => handleDeleteTeam(team.id)}>Delete</button></div></div>)}</div>}
            {divisionSection === 'settings' && <div className="settings-grid"><label><span>Division number</span><input inputMode="numeric" value={selectedDivision.number} onChange={(event) => { const number = event.target.value.replace(/\D/g, '').slice(0, 4); setState((previous) => ({ ...previous, divisions: previous.divisions.map((division) => division.id === selectedDivisionId ? { ...division, number } : division), teams: previous.teams.map((team) => { if (team.divisionId !== selectedDivisionId) return team; const index = previous.teams.filter((entry) => entry.divisionId === selectedDivisionId).findIndex((entry) => entry.id === team.id) + 1; return { ...team, number: `${number}${String(index).padStart(2, '0')}` } }) })) }} /></label><label><span>Division name</span><input value={selectedDivision.name} onChange={(event) => setState((previous) => ({ ...previous, divisions: previous.divisions.map((division) => division.id === selectedDivisionId ? { ...division, name: event.target.value } : division) }))} /></label><label><span>Division type</span><select value={selectedDivision.type} onChange={(event) => setState((previous) => ({ ...previous, divisions: previous.divisions.map((division) => division.id === selectedDivisionId ? { ...division, type: event.target.value as DivisionType } : division) }))}>{['8 ball', '9 ball', 'Double Jeopardy', 'Scotch Doubles', 'Masters'].map((type) => <option key={type}>{type}</option>)}</select></label><label><span>Tables available for this division</span><input type="number" min={2} max={10} value={selectedDivision.tableCount} onChange={(event) => setState((previous) => ({ ...previous, divisions: previous.divisions.map((division) => division.id === selectedDivisionId ? { ...division, tableCount: Math.max(2, Math.min(10, Number(event.target.value) || 2)) } : division) }))} /></label></div>}
            {divisionSection === 'schedule' && <div className="schedule-management"><section className="schedule-range"><h3>Season schedule</h3><p className="muted">Choose this division’s week range. Teams are entered manually each week. Table assignments are generated separately on match day.</p><div className="settings-grid"><label><span>Start week</span><input type="number" min={1} value={scheduleRange.start} onChange={(event) => setScheduleRange({ ...scheduleRange, start: Number(event.target.value) })} /></label><label><span>End week</span><input type="number" min={scheduleRange.start} value={scheduleRange.end} onChange={(event) => setScheduleRange({ ...scheduleRange, end: Number(event.target.value) })} /></label><label><span>First week date</span><input type="date" value={scheduleRange.firstDate} onChange={(event) => setScheduleRange({ ...scheduleRange, firstDate: event.target.value })} /></label><button type="button" className="primary" onClick={createScheduleRange}>Create week schedules</button></div></section>
              {divisionWeeks.length > 0 && <div className="week-selector"><label className="schedule-select-label"><span>Schedule week</span><select value={currentWeek?.id ?? ''} onChange={(event) => handleSelectWeek(event.target.value)}>{divisionWeeks.map((week) => <option key={week.id} value={week.id}>Week {week.weekNumber} · {week.date}</option>)}</select></label><span className="muted">Manual team entries · generated tables are division-specific</span></div>}
            </div>}
          </section>
          {divisionSection === 'schedule' && currentWeek && <section className="panel">
            <div className="panel-header"><h2>Week {currentWeek.weekNumber} · {currentWeek.date}</h2><div className="action-buttons">{(selectedDivision.type === '8 ball' || selectedDivision.type === 'Double Jeopardy' || selectedDivision.type === 'Masters') && <button type="button" onClick={() => addMatchup('8-ball')}>Add 8-ball matchup</button>}{(selectedDivision.type === '9 ball' || selectedDivision.type === 'Double Jeopardy' || selectedDivision.type === 'Masters') && <button type="button" onClick={() => addMatchup('9-ball')}>Add 9-ball matchup</button>}<button type="button" className="primary" onClick={generateAssignments}>Generate tables (match day)</button><button type="button" className="secondary" onClick={saveWeek}>Save schedule</button></div></div>
            <div className="discipline-block"><h3>8-Ball</h3>{currentWeek.eightBall.length ? currentWeek.eightBall.map((matchup) => <div className="matchup-row" key={matchup.id}><select value={matchup.teamAId} onChange={(event) => updateMatchup('8-ball', matchup.id, 'teamAId', event.target.value)}>{divisionTeams.filter((team) => team.active).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><span>vs</span><select value={matchup.teamBId} onChange={(event) => updateMatchup('8-ball', matchup.id, 'teamBId', event.target.value)}>{divisionTeams.filter((team) => team.active).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><button type="button" className="ghost" onClick={() => removeMatchup('8-ball', matchup.id)}>Remove</button></div>) : <p className="muted">No 8-ball matchups yet.</p>}</div>
            <div className="discipline-block"><h3>9-Ball</h3>{currentWeek.nineBall.length ? currentWeek.nineBall.map((matchup) => <div className="matchup-row" key={matchup.id}><select value={matchup.teamAId} onChange={(event) => updateMatchup('9-ball', matchup.id, 'teamAId', event.target.value)}>{divisionTeams.filter((team) => team.active).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><span>vs</span><select value={matchup.teamBId} onChange={(event) => updateMatchup('9-ball', matchup.id, 'teamBId', event.target.value)}>{divisionTeams.filter((team) => team.active).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><button type="button" className="ghost" onClick={() => removeMatchup('9-ball', matchup.id)}>Remove</button></div>) : <p className="muted">No 9-ball matchups yet.</p>}</div>
            {byeTeams.length > 0 && <div className="byes-box"><label>Bye</label><p>{byeTeams.map((team) => team.name).join(', ')}</p></div>}
            {currentAssignments.length > 0 && <div className="assignment-table-wrap"><table className="assignment-table"><thead><tr><th>Discipline</th><th>Teams</th><th>Tables</th><th>Table override</th></tr></thead><tbody>{currentAssignments.map((assignment) => { const teamAName = state.teams.find((team) => team.id === assignment.teamAId)?.name ?? 'Unknown'; const teamBName = state.teams.find((team) => team.id === assignment.teamBId)?.name ?? 'Unknown'; const defaultPair = `${assignment.tables[0]}-${assignment.tables[1]}`; const overrideValue = selectedPairOverrides[assignment.id] ?? defaultPair; return <tr key={assignment.id}><td>{assignment.discipline}</td><td>{teamAName} vs {teamBName}</td><td>{assignment.tables[0]}–{assignment.tables[1]}<div className="tiny-score">Score {assignment.score}</div></td><td><select value={overrideValue} onChange={(event) => handleOverride(assignment.id, event.target.value)}>{tablePairOptions.filter(([first, second]) => currentAssignments.every((other) => other.id === assignment.id || (!other.tables.includes(first) && !other.tables.includes(second))) || (first === assignment.tables[0] && second === assignment.tables[1])).map(([first, second]) => <option key={`${first}-${second}`} value={`${first}-${second}`}>{first}–{second}</option>)}</select>{assignment.manualOverride && <span className="override-tag">Manual</span>}</td></tr> })}</tbody></table></div>}
          </section>}
        </main>
      )}

    </div>
  )
}

export default App
