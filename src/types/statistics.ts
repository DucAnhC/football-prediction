export interface ShotStatistics {
  total: number;
  onTarget: number;
  offTarget: number;
  insideBox: number;
  bigChances: number;
  expectedGoals: number;
}

export interface PassingStatistics {
  attempted: number;
  completed: number;
  accuracy: number;
  progressivePasses: number;
  finalThirdEntries: number;
}

export interface DefensiveStatistics {
  tacklesWon: number;
  interceptions: number;
  clearances: number;
  blocks: number;
  saves: number;
}

export interface DisciplineStatistics {
  fouls: number;
  yellowCards: number;
  redCards: number;
  offsides: number;
  corners: number;
}

export interface TeamMatchStatistics {
  possession: number;
  shots: ShotStatistics;
  passing: PassingStatistics;
  defensive: DefensiveStatistics;
  discipline: DisciplineStatistics;
}

export interface MatchStatistics {
  home: TeamMatchStatistics;
  away: TeamMatchStatistics;
  pressureIndex: {
    home: number;
    away: number;
  };
  territoryControl: {
    home: number;
    away: number;
  };
}
