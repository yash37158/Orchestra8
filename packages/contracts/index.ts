import { z } from "zod"

/**
 * The Orchestr8 wire contract. This is the ONLY definition of what the API
 * returns and what the UI may assume. Go structs in services/api mirror it;
 * both sides validate the same golden fixtures (see fixtures/ + verify.mjs),
 * so drift on either side fails a test rather than a dashboard.
 */

const Iso = z.string().datetime()
const Pct = z.number().min(0).max(100)

/* ---------------------------------------------------------------- layer 1
 * Infrastructure. What the dashboard renders today.
 * ------------------------------------------------------------------------ */

export const ClusterStatus = z.enum(["healthy", "degraded", "offline"])

export const Cluster = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(["aws", "gcp", "azure", "edge", "onprem", "unknown"]),
  region: z.string(),
  status: ClusterStatus,
  nodes: z.number().int().nonnegative(),
  cpuPct: Pct,
  memoryPct: Pct,
  uptimePct: Pct,
  costPerHourUsd: z.number().nonnegative(),
})

export const TopologyLink = z.object({
  source: z.string(),
  target: z.string(),
  status: ClusterStatus,
  latencyMs: z.number().nonnegative(),
})

export const Topology = z.object({
  clusters: z.array(Cluster),
  links: z.array(TopologyLink),
})

export const ActivityEvent = z.object({
  id: z.string(),
  kind: z.enum(["deployment", "scaling", "security", "error", "inference"]),
  severity: z.enum(["info", "warning", "critical"]),
  title: z.string(),
  description: z.string(),
  at: Iso,
  // Set when this event was raised by the correlation engine rather than a
  // raw signal — carries the id of the correlation that explains it.
  correlationId: z.string().nullable().default(null),
})

/* ---------------------------------------------------------------- layer 2
 * AI workloads. The half no infra tool models and no LLM tool can see.
 * ------------------------------------------------------------------------ */

/** Per-GPU silicon telemetry. Sourced from DCGM exporter on GPU nodes. */
export const GpuDevice = z.object({
  uuid: z.string(),
  clusterId: z.string(),
  nodeName: z.string(),
  model: z.string(),              // "H100-SXM5-80GB"
  migProfile: z.string().nullable(), // "1g.10gb" when partitioned, else null
  utilizationPct: Pct,            // DCGM_FI_DEV_GPU_UTIL — busy, not healthy
  memoryUsedGb: z.number().nonnegative(),
  memoryTotalGb: z.number().positive(),
  temperatureC: z.number(),
  powerWatts: z.number().nonnegative(),
  // Thermal/power throttling. The usual reason "GPU looks fine" and latency isn't.
  throttled: z.boolean(),
  xidErrors: z.number().int().nonnegative(),
})

/**
 * Per-model serving telemetry. Sourced from the inference engine's own
 * metrics endpoint (vLLM /metrics) plus OTel GenAI spans.
 */
export const InferenceService = z.object({
  id: z.string(),
  clusterId: z.string(),
  model: z.string(),              // "llama-3.3-70b-instruct"
  engine: z.enum(["vllm", "tgi", "triton", "sglang", "ray-serve", "other"]),
  replicas: z.number().int().nonnegative(),
  // The metrics that actually define inference health. Utilization does not.
  ttftMsP50: z.number().nonnegative(),
  ttftMsP95: z.number().nonnegative(),
  ttftMsP99: z.number().nonnegative(),
  tokensPerSecond: z.number().nonnegative(),
  queueDepth: z.number().int().nonnegative(),
  batchSize: z.number().int().nonnegative(),
  kvCacheUsagePct: Pct,
  errorRatePct: Pct,
  // SLO target for p95 TTFT; breach drives alerting and the correlation engine.
  ttftSloMs: z.number().positive(),
})

/** Token + spend attribution, rolled up per model per window. */
export const TokenSpend = z.object({
  model: z.string(),
  clusterId: z.string(),
  windowStart: Iso,
  windowEnd: Iso,
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
})

/* ---------------------------------------------------------------- layer 3
 * Correlation. The product. Joins layer 1 and layer 2 into one explanation.
 * ------------------------------------------------------------------------ */

/**
 * One line of evidence. Structured rather than a bare string so the UI can draw
 * the metric it refers to over the exact window the engine looked at — a claim
 * the reader cannot inspect is a claim they have to take on faith, which is the
 * opposite of what an on-call engineer needs at 3am.
 */
export const Evidence = z.object({
  text: z.string(),
  metric: z.string().nullable(),   // e.g. "DCGM_FI_DEV_GPU_TEMP"; null if qualitative
  subject: z.string().nullable(),  // GPU uuid or model name the metric belongs to
  windowStart: Iso,
  windowEnd: Iso,
})

export const CorrelationStatus = z.enum(["open", "acknowledged", "suppressed", "resolved"])

export const Correlation = z.object({
  id: z.string(),
  detectedAt: Iso,
  updatedAt: Iso,
  status: CorrelationStatus,
  severity: z.enum(["info", "warning", "critical"]),
  // Plain-language claim, e.g. "p95 TTFT breached SLO because GPU 3 on
  // node gpu-a-04 is thermally throttling, not because traffic rose."
  summary: z.string(),
  // The window the engine analysed. Pinned into every shared link so a
  // correlation opened tomorrow shows what the sender saw, not "last 15 min".
  windowStart: Iso,
  windowEnd: Iso,
  // What broke, in SLO terms.
  symptom: z.object({
    serviceId: z.string(),
    model: z.string(),
    metric: z.enum(["ttft_p95", "error_rate", "queue_depth", "tokens_per_second"]),
    observed: z.number(),
    threshold: z.number(),
  }),
  // What the evidence points at, on the infra side.
  cause: z.object({
    kind: z.enum([
      "gpu_thermal_throttle",
      "gpu_memory_pressure",
      "kv_cache_saturation",
      "node_pressure",
      "xid_error",
      "traffic_surge",
      "model_rollout",
      "unknown",
    ]),
    gpuUuid: z.string().nullable(),
    nodeName: z.string().nullable(),
    clusterId: z.string(),
    evidence: z.array(Evidence),
  }),
  // 0..1. Shown to the user; never hidden behind a "the AI decided" black box.
  confidence: z.number().min(0).max(1),
  recommendedAction: z.string(),
})

/* ---------------------------------------------------------------- layer 4
 * Fleet inventory and cost. What a platform team reports upward.
 * ------------------------------------------------------------------------ */

/** GPUs of one model within a cluster, rolled up for inventory and chargeback. */
export const GpuInventoryEntry = z.object({
  model: z.string(),
  count: z.number().int().nonnegative(),
  // MIG partitions a single card into up to 7 addressable instances, each
  // potentially serving a different model for a different tenant. Counting
  // cards instead of instances undercounts a partitioned fleet sevenfold.
  migProfile: z.string().nullable(),
  totalMemoryGb: z.number().nonnegative(),
  avgUtilizationPct: Pct,
  throttledCount: z.number().int().nonnegative(),
  ratePerHourUsd: z.number().nonnegative(),
  costPerHourUsd: z.number().nonnegative(),
})

export const ClusterDetail = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(["aws", "gcp", "azure", "edge", "onprem", "unknown"]),
  region: z.string(),
  status: ClusterStatus,
  nodeCount: z.number().int().nonnegative(),
  gpuCount: z.number().int().nonnegative(),
  throttledCount: z.number().int().nonnegative(),
  avgUtilizationPct: Pct,
  memoryUsedGb: z.number().nonnegative(),
  memoryTotalGb: z.number().nonnegative(),
  models: z.array(z.string()),
  inventory: z.array(GpuInventoryEntry),
  gpus: z.array(GpuDevice),
  costPerHourUsd: z.number().nonnegative(),
  costPer24hUsd: z.number().nonnegative(),
  lastSeenAt: Iso.nullable(),
})

export const ClustersResponse = z.object({
  generatedAt: Iso,
  currency: z.string(),
  clusters: z.array(ClusterDetail),
})

/* ---------------------------------------------------------------- layer 5
 * Security scanning, inference economics, and configuration.
 * ------------------------------------------------------------------------ */

export const ScanSummary = z.object({
  id: z.string(),
  at: Iso,
  target: z.string(),
  critical: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  fixable: z.number().int().nonnegative(),
  outcome: z.enum(["ok", "failed"]),
})

export const ScanFinding = z.object({
  vulnId: z.string(),
  severity: z.string(),
  package: z.string(),
  installed: z.string(),
  fixedVersion: z.string(),
  title: z.string(),
  primaryUrl: z.string(),
  // Ranked alongside severity: a critical with a published patch is a version
  // bump, one without is an architectural conversation. Counting only severity
  // hides that difference.
  fixable: z.boolean(),
})

export const ScansResponse = z.object({
  scans: z.array(ScanSummary),
})

/** Per-model serving economics. Joins inference performance to GPU spend. */
export const ModelEconomics = z.object({
  clusterId: z.string(),
  model: z.string(),
  ttftMsP50: z.number().nonnegative(),
  ttftMsP95: z.number().nonnegative(),
  ttftSloMs: z.number().positive(),
  withinSlo: z.boolean(),
  requestsPerMin: z.number().nonnegative(),
  queueDepth: z.number().nonnegative(),
  kvCacheUsagePct: Pct,
  gpuCount: z.number().int().nonnegative(),
  gpuUtilizationPct: Pct,
  costPerHourUsd: z.number().nonnegative(),
  // Cost per thousand requests is the number that makes two models comparable
  // when they run on different hardware at different scales.
  costPerKRequestsUsd: z.number().nonnegative(),
})

export const Recommendation = z.object({
  id: z.string(),
  kind: z.enum(["rightsize", "consolidate", "slo_mismatch", "idle"]),
  severity: z.enum(["info", "warning"]),
  title: z.string(),
  detail: z.string(),
  evidence: z.array(z.string()),
  estimatedSavingUsdPerDay: z.number(),
  action: z.string(),
})

export const InferenceResponse = z.object({
  generatedAt: Iso,
  models: z.array(ModelEconomics),
  recommendations: z.array(Recommendation),
  totalCostPerDayUsd: z.number().nonnegative(),
})

export const ConfigResponse = z.object({
  slos: z.object({
    defaultTtftP95Ms: z.number(),
    models: z.record(z.number()),
  }),
  notifications: z.object({
    publicUrl: z.string(),
    destinations: z.array(z.object({
      id: z.string(),
      kind: z.string(),
      minSeverity: z.string(),
      enabled: z.boolean(),
      configured: z.boolean(),
    })),
  }),
  gpuRates: z.object({
    currency: z.string(),
    defaultPerHour: z.number(),
    rates: z.record(z.number()),
  }),
  clusters: z.array(z.object({
    id: z.string(),
    gpuCount: z.number().int(),
    lastSeenAt: Iso.nullable(),
  })),
  gitops: z.object({
    repo: z.string(),
    reachable: z.boolean(),
    branch: z.string(),
  }),
})

/* ------------------------------------------------------------- responses
 * One object per dashboard endpoint. These are the API's public surface.
 * ------------------------------------------------------------------------ */

export const OverviewResponse = z.object({
  generatedAt: Iso,
  // When telemetry last arrived. null means none has ever arrived — a new
  // install, not a healthy quiet period. The UI must render those differently:
  // stale numbers that still look plausible are the worst failure mode here.
  lastTelemetryAt: Iso.nullable(),
  clusters: z.object({ healthy: z.number().int(), total: z.number().int() }),
  fleetUptimePct: Pct,
  // GPU fleet utilization, carried alongside the SLO it is NOT a proxy for.
  gpuUtilizationPct: Pct,
  inferenceSloAttainmentPct: Pct,
  // GPU spend, derived from measured inventory x the rate card. Replaces a
  // token-spend figure that was structurally always zero: token cost needs
  // GenAI spans, and until an instrumented application emits them there is no
  // source for it. A permanent $0 on a dashboard teaches people to ignore the
  // tile.
  fleetCostPerDayUsd: z.number().nonnegative(),
  openCorrelations: z.number().int().nonnegative(),
})

export const DashboardResponse = z.object({
  overview: OverviewResponse,
  topology: Topology,
  activity: z.array(ActivityEvent),
  gpus: z.array(GpuDevice),
  services: z.array(InferenceService),
  correlations: z.array(Correlation),
})

export type Cluster = z.infer<typeof Cluster>
export type TopologyLink = z.infer<typeof TopologyLink>
export type Topology = z.infer<typeof Topology>
export type ActivityEvent = z.infer<typeof ActivityEvent>
export type GpuDevice = z.infer<typeof GpuDevice>
export type InferenceService = z.infer<typeof InferenceService>
export type TokenSpend = z.infer<typeof TokenSpend>
export type Evidence = z.infer<typeof Evidence>
export type CorrelationStatus = z.infer<typeof CorrelationStatus>
export type Correlation = z.infer<typeof Correlation>
export type GpuInventoryEntry = z.infer<typeof GpuInventoryEntry>
export type ClusterDetail = z.infer<typeof ClusterDetail>
export type ClustersResponse = z.infer<typeof ClustersResponse>
export type ScanSummary = z.infer<typeof ScanSummary>
export type ScanFinding = z.infer<typeof ScanFinding>
export type ScansResponse = z.infer<typeof ScansResponse>
export type ModelEconomics = z.infer<typeof ModelEconomics>
export type Recommendation = z.infer<typeof Recommendation>
export type InferenceResponse = z.infer<typeof InferenceResponse>
export type ConfigResponse = z.infer<typeof ConfigResponse>
export type OverviewResponse = z.infer<typeof OverviewResponse>
export type DashboardResponse = z.infer<typeof DashboardResponse>
