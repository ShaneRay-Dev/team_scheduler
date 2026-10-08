export type Discipline = '8-ball' | '9-ball'

export type TeamMatchup = {
  id: string
  discipline: Discipline
  teamAId: string
  teamBId: string
}

export type AssignmentPlan = {
  matchupId: string
  pair: [number, number]
  score: number
}

export type SavedWeek = {
  id: string
  weekNumber: number
  date: string
  status: 'draft' | 'saved'
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
}

export type TeamHistorySummary = Record<
  string,
  {
    pairCounts: Record<string, number>
    totalAssignments: number
    adjacentAssignments: number
  }
>

const ROOM_LAYOUT = {
  room1: [1, 2, 3, 4, 5, 6, 7, 8],
  room2: [9, 10],
}

const ALL_TABLES = [...ROOM_LAYOUT.room1, ...ROOM_LAYOUT.room2]

export function getPairKey(pair: [number, number]): string {
  return `${Math.min(pair[0], pair[1])}-${Math.max(pair[0], pair[1])}`
}

export function getRoomForTable(table: number): 'room1' | 'room2' {
  return ROOM_LAYOUT.room1.includes(table) ? 'room1' : 'room2'
}

export function getAllTablePairs(tableCount = ALL_TABLES.length): Array<[number, number]> {
  const pairs: Array<[number, number]> = []
  const tables = ALL_TABLES.filter((table) => table <= Math.max(2, Math.min(tableCount, ALL_TABLES.length)))

  for (let a = 0; a < tables.length; a += 1) {
    for (let b = a + 1; b < tables.length; b += 1) {
      pairs.push([tables[a], tables[b]])
    }
  }

  return pairs
}

export function buildTeamHistory(weeks: SavedWeek[]): TeamHistorySummary {
  const summary: TeamHistorySummary = {}

  for (const week of weeks) {
    for (const assignment of week.assignments) {
      const teams = [assignment.teamAId, assignment.teamBId]

      for (const teamId of teams) {
        if (!summary[teamId]) {
          summary[teamId] = {
            pairCounts: {},
            totalAssignments: 0,
            adjacentAssignments: 0,
          }
        }

        const key = getPairKey(assignment.tables)
        summary[teamId].pairCounts[key] = (summary[teamId].pairCounts[key] ?? 0) + 1
        summary[teamId].totalAssignments += 1

        const [tableA, tableB] = assignment.tables
        const isAdjacent = Math.abs(tableA - tableB) === 1 || (tableA === 9 && tableB === 10)
        if (isAdjacent) summary[teamId].adjacentAssignments += 1
      }
    }
  }

  return summary
}

function pairAdjacencyScore(pair: [number, number]): number {
  const [a, b] = pair
  const distance = Math.abs(a - b)

  if (a === 9 && b === 10) return 28
  if (distance === 1) return 30
  if (distance === 2) return 18
  if (getRoomForTable(a) === getRoomForTable(b)) return 10
  return -32
}

function getHistoricalPenalty(
  pair: [number, number],
  teamAId: string,
  teamBId: string,
  history: TeamHistorySummary,
): number {
  const key = getPairKey(pair)
  const teamAHistory = history[teamAId]?.pairCounts[key] ?? 0
  const teamBHistory = history[teamBId]?.pairCounts[key] ?? 0
  const totalRepeat = teamAHistory + teamBHistory
  const fairnessPenalty =
    ((history[teamAId]?.totalAssignments ?? 0) + (history[teamBId]?.totalAssignments ?? 0)) * 0.06

  return totalRepeat * 16 + fairnessPenalty
}

function sortPairsByPotential(pairCandidates: Array<{ pair: [number, number]; score: number }>) {
  return [...pairCandidates].sort((left, right) => right.score - left.score)
}

export function generateBestAssignments(
  matchups: TeamMatchup[],
  savedWeeks: SavedWeek[],
  tableCount = ALL_TABLES.length,
): { assignments: AssignmentPlan[]; summary: { overallScore: number; adjacency: string; historicalRepeat: string; roomSeparation: string } } {
  if (!matchups.length) {
    return {
      assignments: [],
      summary: {
        overallScore: 100,
        adjacency: 'No active matchups',
        historicalRepeat: 'No repeat history',
        roomSeparation: 'No room conflicts',
      },
    }
  }

  const history = buildTeamHistory(savedWeeks)
  const tablePairs = getAllTablePairs(tableCount)
  const candidateMap = new Map<string, Array<{ pair: [number, number]; score: number }>>()

  for (const matchup of matchups) {
    const options = tablePairs
      .map((pair) => {
        const pairScore = pairAdjacencyScore(pair)
        const roomPenalty =
          getRoomForTable(pair[0]) !== getRoomForTable(pair[1]) ? 35 : 0
        const historicalPenalty = getHistoricalPenalty(pair, matchup.teamAId, matchup.teamBId, history)
        const score = pairScore - roomPenalty - historicalPenalty

        return { pair, score }
      })
      .filter((candidate) => candidate.score > -999)

    candidateMap.set(matchup.id, sortPairsByPotential(options))
  }

  const matchupsOrdered = [...matchups].sort((left, right) => {
    const leftCount = (candidateMap.get(left.id) ?? []).length
    const rightCount = (candidateMap.get(right.id) ?? []).length
    return leftCount - rightCount
  })

  let bestPlan: AssignmentPlan[] = []
  let bestTotal = Number.NEGATIVE_INFINITY

  function search(index: number, usedTables: Set<number>, currentTotal: number, currentPlan: AssignmentPlan[]) {
    if (index === matchupsOrdered.length) {
      if (currentTotal > bestTotal) {
        bestTotal = currentTotal
        bestPlan = [...currentPlan]
      }
      return
    }

    const matchup = matchupsOrdered[index]
    const candidates = candidateMap.get(matchup.id) ?? []

    for (const candidate of candidates) {
      const [tableA, tableB] = candidate.pair
      if (usedTables.has(tableA) || usedTables.has(tableB)) continue

      const nextUsed = new Set(usedTables)
      nextUsed.add(tableA)
      nextUsed.add(tableB)

      currentPlan.push({
        matchupId: matchup.id,
        pair: candidate.pair,
        score: candidate.score,
      })

      search(index + 1, nextUsed, currentTotal + candidate.score, currentPlan)
      currentPlan.pop()
    }
  }

  search(0, new Set<number>(), 0, [])

  if (!bestPlan.length) {
    return {
      assignments: [],
      summary: {
        overallScore: 50,
        adjacency: 'Fallback allocation applied',
        historicalRepeat: 'No valid assignment found',
        roomSeparation: 'Manual review recommended',
      },
    }
  }

  const adjacentAssignments = bestPlan.filter(({ pair }) => {
    const [a, b] = pair
    return Math.abs(a - b) === 1 || (a === 9 && b === 10)
  }).length

  const historicalRepeat = bestPlan.filter(({ matchupId }) => {
    const matchup = matchups.find((item) => item.id === matchupId)
    if (!matchup) return false

    const pair = bestPlan.find((assignment) => assignment.matchupId === matchupId)?.pair
    if (!pair) return false

    const key = getPairKey(pair)
    return ((history[matchup.teamAId]?.pairCounts[key] ?? 0) + (history[matchup.teamBId]?.pairCounts[key] ?? 0)) > 0
  }).length

  const roomSeparation = bestPlan.filter(({ pair }) =>
    getRoomForTable(pair[0]) !== getRoomForTable(pair[1]),
  ).length

  const normalizedScore = Math.min(
    99,
    Math.max(52, Math.round((bestTotal / (matchups.length * 20)) * 100)),
  )

  return {
    assignments: bestPlan,
    summary: {
      overallScore: normalizedScore,
      adjacency: `${adjacentAssignments}/${matchups.length} adjacent table pairs`,
      historicalRepeat:
        historicalRepeat > 0 ? `${historicalRepeat} repeat pair(s) identified` : 'No historical repeats',
      roomSeparation:
        roomSeparation > 0 ? `${roomSeparation} cross-room pair(s)` : 'No cross-room assignments',
    },
  }
}
