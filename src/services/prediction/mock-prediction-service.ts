import { leagues } from "@/data/leagues";
import { findHandbookRuleById } from "@/lib/utils";
import { buildPredictionInput, buildPredictionRawData } from "@/services/prediction/mapper";
import { assertPredictionSchemaOutput } from "@/services/prediction/schema";
import type { Match } from "@/types/match";
import type {
  BothTeamsToScoreLean,
  DerivedMatchIndicators,
  GoalsLean,
  IndicatorEdge,
  MatchOutcomeLean,
  MatchPrediction,
  PredictionConfidence,
  PredictionExplanation,
  PredictionHandbookRuleReference,
  PredictionInput,
  PredictionRawData,
  PredictionSchemaOutput,
  RiskLevel,
} from "@/types/prediction";

export function buildMockPredictions(
  matchList: readonly Match[],
  leagueNamesById?: ReadonlyMap<string, string>,
): MatchPrediction[] {
  return matchList.map((match) =>
    buildMockPrediction(match, leagueNamesById?.get(match.leagueId)),
  );
}

export function buildMockPrediction(
  match: Match,
  leagueNameOverride?: string,
): MatchPrediction {
  const leagueName = resolvePredictionLeagueName(match, leagueNameOverride);
  const input = buildPredictionInput(match, leagueName);
  const rawData = buildPredictionRawData(match);
  const derivedIndicators = buildDerivedIndicators(match, input, rawData);
  const explanation = buildExplanation(match, input, rawData, derivedIndicators);
  const output = buildSchemaOutput(match, input, rawData, derivedIndicators, explanation);

  assertPredictionSchemaOutput(output);

  return {
    id: `prediction-${match.id}`,
    matchId: match.id,
    generatedAt: buildGeneratedAt(match),
    source: "mock",
    input,
    rawData,
    derivedIndicators,
    explanation,
    output,
  };
}

function buildDerivedIndicators(
  match: Match,
  input: PredictionInput,
  rawData: PredictionRawData,
): DerivedMatchIndicators {
  const attackingEdge = getAttackingEdge(input, rawData);
  const controlEdge = getControlEdge(input);
  const goalExpectation = getGoalExpectation(match, rawData);
  const bothTeamsToScore = getBothTeamsToScoreLean(match, rawData, goalExpectation);
  const volatility = getVolatility(match, rawData, attackingEdge, controlEdge, goalExpectation);

  return {
    attackingEdge,
    controlEdge,
    goalExpectation,
    bothTeamsToScore,
    volatility,
  };
}

function buildExplanation(
  match: Match,
  input: PredictionInput,
  rawData: PredictionRawData,
  derivedIndicators: DerivedMatchIndicators,
): PredictionExplanation {
  const hasHomeFormSnapshot = hasFormSnapshot(input.homeTeam);
  const hasAwayFormSnapshot = hasFormSnapshot(input.awayTeam);
  const importantIndicators = [
    {
      label:
        hasHomeFormSnapshot || hasAwayFormSnapshot
          ? "Phong độ gần đây"
          : "Độ dày dữ liệu",
      detail:
        hasHomeFormSnapshot && hasAwayFormSnapshot
          ? `${input.homeTeam.shortName} có ${rawData.homeFormPoints} điểm phong độ, trong khi ${input.awayTeam.shortName} đạt ${rawData.awayFormPoints} điểm trong 5 trận gần nhất.`
          : hasHomeFormSnapshot || hasAwayFormSnapshot
            ? "Hiện mới có tín hiệu phong độ rõ hơn ở một phía, nên góc nhìn trước trận vẫn cần được giữ ở mức tham khảo."
            : "Phong độ gần đây của hai đội còn thiếu, nên phần insight chỉ giữ ở mức gợi ý ngắn thay vì suy diễn sâu.",
    },
    {
      label: match.status === "live" ? "Diễn biến trực tiếp" : "Cân bằng cơ hội",
      detail: buildChanceDetail(match, input, rawData),
    },
    {
      label: "Nhịp bàn thắng",
      detail: buildGoalDetail(input, rawData, derivedIndicators.goalExpectation),
    },
  ] as const;

  const riskNotes = [
    buildAvailabilityRisk(input),
    buildVolatilityRisk(match, derivedIndicators.volatility),
  ] as const;

  return {
    matchContext: buildMatchContext(match, input, rawData, derivedIndicators),
    importantIndicators,
    riskNotes,
  };
}

function buildSchemaOutput(
  match: Match,
  input: PredictionInput,
  rawData: PredictionRawData,
  derivedIndicators: DerivedMatchIndicators,
  explanation: PredictionExplanation,
): PredictionSchemaOutput {
  const outcome = getSuggestedOutcome(match, input, rawData, derivedIndicators);
  const goals: GoalsLean = derivedIndicators.goalExpectation === "low" ? "under-2.5" : "over-2.5";
  const bothTeamsToScore = derivedIndicators.bothTeamsToScore;
  const likelyScoreline = buildLikelyScoreline(match, outcome, goals, bothTeamsToScore);
  const confidenceScore = getConfidenceScore(match, input, rawData, derivedIndicators, outcome);
  const confidence = getConfidenceLevel(confidenceScore);
  const handbookRulesUsed = buildHandbookRulesUsed(
    input,
    rawData,
    derivedIndicators,
    outcome,
  );
  const summary = buildSummary(
    match,
    input,
    outcome,
    goals,
    likelyScoreline,
    confidence,
  );
  const suggestedPrediction = {
    outcome,
    goals,
    both_teams_to_score: bothTeamsToScore,
    likely_scoreline: likelyScoreline,
    rationale: buildRationale(
      match,
      explanation,
      derivedIndicators,
      confidence,
    ),
  };

  return {
    summary,
    match_context: explanation.matchContext,
    key_indicators: explanation.importantIndicators,
    handbook_rules_used: handbookRulesUsed,
    risks: explanation.riskNotes,
    suggested_prediction: suggestedPrediction,
    confidence,
    confidence_score: confidenceScore,
  };
}

function buildGeneratedAt(match: Match) {
  const kickoff = new Date(match.kickoffTime);
  const generatedAt = new Date(kickoff);

  if (match.status === "live") {
    generatedAt.setUTCMinutes(generatedAt.getUTCMinutes() + (match.clock.minute ?? 60));
    return generatedAt.toISOString();
  }

  if (match.status === "finished") {
    generatedAt.setUTCMinutes(generatedAt.getUTCMinutes() + 110);
    return generatedAt.toISOString();
  }

  generatedAt.setUTCHours(generatedAt.getUTCHours() - 10);
  return generatedAt.toISOString();
}

function getAttackingEdge(
  input: PredictionInput,
  rawData: PredictionRawData,
): IndicatorEdge {
  const homeAttackScore =
    rawData.homeExpectedGoals + rawData.homeGoalsPerMatch * 0.35 + input.homeTeam.attackRating / 120;
  const awayAttackScore =
    rawData.awayExpectedGoals + rawData.awayGoalsPerMatch * 0.35 + input.awayTeam.attackRating / 120;
  const difference = homeAttackScore - awayAttackScore;

  if (difference >= 0.18) {
    return "home";
  }

  if (difference <= -0.18) {
    return "away";
  }

  return "balanced";
}

function getControlEdge(input: PredictionInput): IndicatorEdge {
  if (input.liveContext) {
    const controlDifference = input.liveContext.homePossession - input.liveContext.awayPossession;

    if (controlDifference >= 8) {
      return "home";
    }

    if (controlDifference <= -8) {
      return "away";
    }

    return "balanced";
  }

  const midfieldDifference = input.homeTeam.midfieldRating - input.awayTeam.midfieldRating;

  if (midfieldDifference >= 5) {
    return "home";
  }

  if (midfieldDifference <= -5) {
    return "away";
  }

  return "balanced";
}

function getGoalExpectation(match: Match, rawData: PredictionRawData) {
  const totalExpectedGoals = rawData.homeExpectedGoals + rawData.awayExpectedGoals;
  const currentTotalGoals = match.score.home + match.score.away;

  if (currentTotalGoals >= 3 || totalExpectedGoals >= 3.2) {
    return "high";
  }

  if (totalExpectedGoals <= 2.2) {
    return "low";
  }

  return "balanced";
}

function getBothTeamsToScoreLean(
  match: Match,
  rawData: PredictionRawData,
  goalExpectation: DerivedMatchIndicators["goalExpectation"],
): BothTeamsToScoreLean {
  if (match.status === "live" && match.score.home > 0 && match.score.away > 0) {
    return "yes";
  }

  const lowerExpectedGoals = Math.min(rawData.homeExpectedGoals, rawData.awayExpectedGoals);

  if (lowerExpectedGoals >= 1.05) {
    return "yes";
  }

  if (goalExpectation === "low" || lowerExpectedGoals <= 0.75) {
    return "no";
  }

  return "balanced";
}

function getVolatility(
  match: Match,
  rawData: PredictionRawData,
  attackingEdge: IndicatorEdge,
  controlEdge: IndicatorEdge,
  goalExpectation: DerivedMatchIndicators["goalExpectation"],
): RiskLevel {
  const expectedGoalGap = Math.abs(rawData.homeExpectedGoals - rawData.awayExpectedGoals);
  const scoreGap = Math.abs(match.score.home - match.score.away);

  if (
    goalExpectation === "high" &&
    expectedGoalGap <= 0.12 &&
    scoreGap <= 1
  ) {
    return "high";
  }

  if (
    attackingEdge !== "balanced" &&
    attackingEdge === controlEdge &&
    expectedGoalGap >= 0.45 &&
    scoreGap <= 1
  ) {
    return "low";
  }

  return "medium";
}

function getSuggestedOutcome(
  match: Match,
  input: PredictionInput,
  rawData: PredictionRawData,
  derivedIndicators: DerivedMatchIndicators,
): MatchOutcomeLean {
  const homeFormEdge = input.homeTeam.formPoints - input.awayTeam.formPoints;
  const homePointEdge = input.homeTeam.points - input.awayTeam.points;
  const homeExpectedGoalEdge = rawData.homeExpectedGoals - rawData.awayExpectedGoals;
  const liveScoreEdge = match.score.home - match.score.away;

  let delta = 0.25;
  delta += homeExpectedGoalEdge * 1.1;
  delta += homeFormEdge * 0.08;
  delta += homePointEdge / 30;

  if (derivedIndicators.attackingEdge === "home") {
    delta += 0.35;
  }

  if (derivedIndicators.attackingEdge === "away") {
    delta -= 0.35;
  }

  if (derivedIndicators.controlEdge === "home") {
    delta += 0.25;
  }

  if (derivedIndicators.controlEdge === "away") {
    delta -= 0.25;
  }

  if (match.status === "live") {
    delta += liveScoreEdge * 0.7;
  }

  if (delta >= 0.75) {
    return "home-win";
  }

  if (delta <= -0.75) {
    return "away-win";
  }

  return "draw";
}

function buildLikelyScoreline(
  match: Match,
  outcome: MatchOutcomeLean,
  goals: GoalsLean,
  bothTeamsToScore: BothTeamsToScoreLean,
) {
  if (match.status === "live") {
    if (outcome === "home-win" && match.score.home >= match.score.away) {
      return goals === "over-2.5" ? "3-1" : "2-1";
    }

    if (outcome === "away-win" && match.score.away >= match.score.home) {
      return goals === "over-2.5" ? "1-3" : "1-2";
    }

    return goals === "over-2.5" ? "2-2" : "1-1";
  }

  if (outcome === "draw") {
    return goals === "over-2.5" ? "2-2" : bothTeamsToScore === "yes" ? "1-1" : "0-0";
  }

  if (outcome === "home-win") {
    return goals === "over-2.5" ? "2-1" : bothTeamsToScore === "yes" ? "2-1" : "1-0";
  }

  return goals === "over-2.5" ? "1-2" : bothTeamsToScore === "yes" ? "1-2" : "0-1";
}

function getConfidenceScore(
  match: Match,
  input: PredictionInput,
  rawData: PredictionRawData,
  derivedIndicators: DerivedMatchIndicators,
  outcome: MatchOutcomeLean,
) {
  const expectedGoalGap = Math.abs(rawData.homeExpectedGoals - rawData.awayExpectedGoals);
  const formGap = Math.abs(input.homeTeam.formPoints - input.awayTeam.formPoints);
  const pointGap = Math.abs(input.homeTeam.points - input.awayTeam.points);
  const scoreGap = Math.abs(match.score.home - match.score.away);
  const alignedEdges =
    derivedIndicators.attackingEdge !== "balanced" &&
    derivedIndicators.attackingEdge === derivedIndicators.controlEdge;
  const missingSignals = [
    !hasStandingSnapshot(input.homeTeam),
    !hasStandingSnapshot(input.awayTeam),
    !hasFormSnapshot(input.homeTeam),
    !hasFormSnapshot(input.awayTeam),
  ].filter(Boolean).length;

  let score = 64;
  score += Math.round(expectedGoalGap * 10);
  score += Math.min(9, Math.round(formGap * 1.6));
  score += Math.min(6, Math.round(pointGap / 4));

  if (alignedEdges) {
    score += 6;
  }

  if (match.status === "live") {
    score += Math.min(6, scoreGap * 4);
  }

  if (outcome === "draw") {
    score -= 5;
  }

  if (derivedIndicators.volatility === "high") {
    score -= 4;
  }

  if (derivedIndicators.volatility === "medium") {
    score -= 2;
  }

  if (derivedIndicators.volatility === "low") {
    score += 2;
  }

  score -= missingSignals * 4;

  if (match.status !== "scheduled") {
    score -= 2;
  }

  return clamp(score, 50, 84);
}

function getConfidenceLevel(score: number): PredictionConfidence {
  if (score >= 75) {
    return "high";
  }

  if (score >= 60) {
    return "medium";
  }

  return "low";
}

function buildHandbookRulesUsed(
  input: PredictionInput,
  rawData: PredictionRawData,
  derivedIndicators: DerivedMatchIndicators,
  outcome: MatchOutcomeLean,
): readonly PredictionHandbookRuleReference[] {
  return [
    {
      id: "SR-01",
      title: getHandbookRuleTitle("SR-01", "Tóm tắt trước"),
      reason: `Mở đầu bằng xu hướng ${getOutcomeLabel(outcome, input).toLowerCase()} trước khi đi sâu vào chi tiết.`,
    },
    {
      id: "SR-02",
      title: getHandbookRuleTitle("SR-02", "Ưu tiên chỉ báo hơn tính từ"),
      reason: hasReliablePreMatchSignals(input)
        ? `Dùng phong độ ${rawData.homeFormPoints}-${rawData.awayFormPoints} và xG ${rawData.homeExpectedGoals}-${rawData.awayExpectedGoals} để giải thích dự đoán.`
        : "Ưu tiên nói rõ độ dày dữ liệu hiện có thay vì đẩy ra những con số dễ tạo cảm giác chắc chắn quá mức.",
    },
    {
      id: "SR-03",
      title: getHandbookRuleTitle("SR-03", "Nêu rõ rủi ro"),
      reason: `Đánh dấu mức biến động ${getVolatilityLabel(derivedIndicators.volatility)} để người đọc biết dự đoán này ổn định đến đâu.`,
    },
  ];
}

function getHandbookRuleTitle(id: string, fallbackTitle: string) {
  return findHandbookRuleById(id)?.title ?? fallbackTitle;
}

function buildSummary(
  match: Match,
  input: PredictionInput,
  outcome: MatchOutcomeLean,
  goals: GoalsLean,
  likelyScoreline: string,
  confidence: PredictionConfidence,
) {
  const outcomeLabel = getOutcomeShortLabel(outcome, input);
  const goalsLabel = goals === "over-2.5" ? "cởi mở hơn thường lệ" : "khá chặt chẽ";

  if (match.status === "finished") {
    return "Trận đã khép lại. Phần dưới đây chỉ tóm tắt những tín hiệu dữ liệu nổi bật đã ghi nhận.";
  }

  if (match.status === "live") {
    if (confidence === "low") {
      return "Cục diện còn khá mở. Đây chỉ là góc nhìn dữ liệu theo diễn biến hiện tại.";
    }

    return pickVariant(match.id, [
      `${outcomeLabel} đang có đôi chút lợi thế dữ liệu, nhưng thế trận vẫn có thể đổi nhanh.`,
      `Dữ liệu lúc này nghiêng nhẹ về ${outcomeLabel.toLowerCase()}, song đây chưa phải tín hiệu chắc chắn.`,
      `${outcomeLabel} là hướng nổi bật hơn ở thời điểm này, dù trận đấu vẫn còn độ mở đáng kể.`,
    ]);
  }

  if (confidence === "low") {
    return `Cặp đấu này khá cân bằng. Kịch bản ${likelyScoreline} chỉ nên xem là tín hiệu tham khảo.`;
  }

  return pickVariant(match.id, [
    `${outcomeLabel}; kịch bản ${likelyScoreline} là hướng dễ thấy hơn và nhịp trận có thể ${goalsLabel}.`,
    `Tín hiệu hiện có nghiêng về ${outcomeLabel.toLowerCase()}, với kịch bản ${likelyScoreline} nổi bật hơn các phương án còn lại.`,
    `${outcomeLabel} là góc nhìn đáng chú ý trước giờ bóng lăn, còn ${likelyScoreline} là tỷ số dễ hình dung nhất.`,
  ]);
}

function buildRationale(
  match: Match,
  explanation: PredictionExplanation,
  derivedIndicators: DerivedMatchIndicators,
  confidence: PredictionConfidence,
) {
  const volatilityLabel = getVolatilityLabel(derivedIndicators.volatility);

  if (confidence === "low") {
    return match.status === "scheduled"
      ? "Tín hiệu hiện tại còn mỏng, nên chờ thêm đội hình và thông tin sát giờ bóng lăn."
      : "Dữ liệu hiện tại chưa đủ dày để đưa ra góc nhìn chắc chắn hơn.";
  }

  return pickVariant(explanation.matchContext, [
    `${explanation.importantIndicators[0].detail} Mức biến động đang ở ngưỡng ${volatilityLabel}.`,
    `${explanation.importantIndicators[0].detail} Vì vậy đây là một góc nhìn tham khảo ở mức ${volatilityLabel}.`,
    `${explanation.importantIndicators[0].detail} Cần tiếp tục theo dõi vì độ biến động đang ở mức ${volatilityLabel}.`,
  ]);
}

function buildMatchContext(
  match: Match,
  input: PredictionInput,
  rawData: PredictionRawData,
  derivedIndicators: DerivedMatchIndicators,
) {
  if (match.status === "finished") {
    return "Trận đã kết thúc. Phần insight bên dưới chỉ tóm lược dữ liệu đã ghi nhận, không còn là dự đoán trước trận.";
  }

  if (match.status === "live") {
    const currentMinute = match.clock.minute ?? 0;

    return `Trận đang ở phút ${currentMinute}, ${buildLiveScoreState(match, input)}. Các tín hiệu kiểm soát bóng và chất lượng cơ hội hiện tại đang nghiêng nhẹ về ${getEdgeLabel(derivedIndicators.attackingEdge, input)}.`;
  }

  if (!hasReliablePreMatchSignals(input)) {
    return "Dữ liệu trước trận còn hạn chế, vì vậy phần insight bên dưới chỉ mang tính tham khảo nhanh.";
  }

  return pickVariant(match.id, [
    `${input.homeTeam.shortName} và ${input.awayTeam.shortName} bước vào trận với xG dự kiến ${rawData.homeExpectedGoals}-${rawData.awayExpectedGoals} và cán cân phong độ ${rawData.homeFormPoints}-${rawData.awayFormPoints} trong 5 trận gần nhất.`,
    `Trước giờ bóng lăn, cán cân dữ liệu của cặp đấu này xoay quanh xG ${rawData.homeExpectedGoals}-${rawData.awayExpectedGoals} cùng nhịp phong độ ${rawData.homeFormPoints}-${rawData.awayFormPoints}.`,
    `${input.homeTeam.shortName} và ${input.awayTeam.shortName} có mức chênh đáng chú ý về xG ${rawData.homeExpectedGoals}-${rawData.awayExpectedGoals}, trong khi phong độ gần đây đang tạo thêm bối cảnh cho trận đấu này.`,
  ]);
}

function buildLiveScoreState(match: Match, input: PredictionInput) {
  const scoreline = `${match.score.home}-${match.score.away}`;

  if (match.score.home > match.score.away) {
    return `${input.homeTeam.shortName} đang dẫn ${scoreline}`;
  }

  if (match.score.away > match.score.home) {
    return `${input.awayTeam.shortName} đang dẫn ${scoreline}`;
  }

  return `hai đội đang hòa ${scoreline}`;
}

function buildChanceDetail(
  match: Match,
  input: PredictionInput,
  rawData: PredictionRawData,
) {
  if (match.status === "live" && input.liveContext) {
    return `${input.homeTeam.shortName} đang có ${input.liveContext.homeShotsOnTarget} cú sút trúng đích, trong khi ${input.awayTeam.shortName} có ${input.liveContext.awayShotsOnTarget}, cho thấy nhịp tấn công đã được định hình rõ hơn trong trận.`;
  }

  if (!hasReliablePreMatchSignals(input)) {
    return "Chưa đủ dữ liệu tiền trận để ước lượng chất lượng cơ hội một cách rõ ràng.";
  }

  return `${input.homeTeam.shortName} được ước tính ${rawData.homeExpectedGoals} xG và ${input.awayTeam.shortName} được ${rawData.awayExpectedGoals} xG trước giờ bóng lăn.`;
}

function buildGoalDetail(
  input: PredictionInput,
  rawData: PredictionRawData,
  goalExpectation: DerivedMatchIndicators["goalExpectation"],
) {
  if (!hasReliablePreMatchSignals(input)) {
    return "Nguồn dữ liệu hiện tại chưa đủ dày để ước lượng nhịp bàn một cách đáng tin cậy.";
  }

  const totalExpectedGoals = roundToOne(rawData.homeExpectedGoals + rawData.awayExpectedGoals);
  const expectationLabel =
    goalExpectation === "high"
      ? "cao"
      : goalExpectation === "low"
        ? "thấp"
        : "cân bằng";

  return `Tổng xG ước tính khoảng ${totalExpectedGoals}, tạo ra kỳ vọng bàn thắng ở mức ${expectationLabel} cho cặp đấu ${input.homeTeam.shortName} gặp ${input.awayTeam.shortName}.`;
}

function buildAvailabilityRisk(input: PredictionInput) {
  const absenceNotes = [input.homeTeam.absences[0], input.awayTeam.absences[0]]
    .filter((note): note is string => Boolean(note))
    .map((note) => localizeAvailabilityNote(note));

  if (absenceNotes.length === 0) {
    return "Chưa có cập nhật nhân sự đủ rõ trong tập dữ liệu hiện tại.";
  }

  return `Nhân sự cần theo dõi: ${absenceNotes.join("; ")}.`;
}

function buildVolatilityRisk(match: Match, volatility: RiskLevel) {
  if (volatility === "high") {
    return "Trận đấu có biến động cao, một bàn thắng sớm hoặc tình huống cố định có thể làm đổi hướng dự đoán nhanh chóng.";
  }

  if (match.status === "live") {
    return "Vì trận đang diễn ra, góc nhìn dữ liệu có thể đổi nhanh theo từng phút và diễn biến tỷ số.";
  }

  return "Tín hiệu hiện tại ở mức vừa phải, nhưng vẫn nên theo dõi đội hình chính thức trước giờ bóng lăn.";
}

function getOutcomeLabel(outcome: MatchOutcomeLean, input: PredictionInput) {
  if (outcome === "home-win") {
    return `${input.homeTeam.shortName} được đánh giá nhỉnh hơn cho khả năng chiến thắng`;
  }

  if (outcome === "away-win") {
    return `${input.awayTeam.shortName} được đánh giá nhỉnh hơn cho khả năng chiến thắng`;
  }

  return "Trận đấu nghiêng về kịch bản hòa";
}

function getOutcomeShortLabel(outcome: MatchOutcomeLean, input: PredictionInput) {
  if (outcome === "home-win") {
    return input.homeTeam.shortName;
  }

  if (outcome === "away-win") {
    return input.awayTeam.shortName;
  }

  return "Kịch bản hòa";
}

function getEdgeLabel(edge: IndicatorEdge, input: PredictionInput) {
  if (edge === "home") {
    return input.homeTeam.shortName;
  }

  if (edge === "away") {
    return input.awayTeam.shortName;
  }

  return "thế trận cân bằng";
}

function getVolatilityLabel(volatility: RiskLevel) {
  if (volatility === "high") {
    return "cao";
  }

  if (volatility === "low") {
    return "thấp";
  }

  return "trung bình";
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}

function resolvePredictionLeagueName(match: Match, leagueNameOverride?: string) {
  if (leagueNameOverride?.trim()) {
    return leagueNameOverride.trim();
  }

  return (
    leagues.find((league) => league.id === match.leagueId)?.name ??
    (match.leagueId.startsWith("league-") ? "Giải đấu đang cập nhật" : match.leagueId)
  );
}

function hasStandingSnapshot(team: PredictionInput["homeTeam"]) {
  return team.standingPosition > 0 || team.points > 0;
}

function hasFormSnapshot(team: PredictionInput["homeTeam"]) {
  return (
    team.formPoints > 0 ||
    team.goalsScoredLastFive > 0 ||
    team.goalsConcededLastFive > 0 ||
    team.cleanSheets > 0
  );
}

function hasReliablePreMatchSignals(input: PredictionInput) {
  const homeHasSignal =
    hasStandingSnapshot(input.homeTeam) || hasFormSnapshot(input.homeTeam);
  const awayHasSignal =
    hasStandingSnapshot(input.awayTeam) || hasFormSnapshot(input.awayTeam);

  return homeHasSignal && awayHasSignal;
}

function localizeAvailabilityNote(note: string) {
  return note
    .replace(/\(doubtful\)/gi, "(chưa chắc ra sân)")
    .replace(/\(out\)/gi, "(vắng mặt)")
    .replace(/\(injured\)/gi, "(chấn thương)")
    .replace(/\(suspended\)/gi, "(treo giò)")
    .replace(/\(unavailable\)/gi, "(không sẵn sàng)");
}

function pickVariant(seed: string, variants: readonly string[]) {
  return variants[Math.abs(hashString(seed)) % variants.length] ?? variants[0] ?? "";
}

function hashString(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }

  return hash;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
