-- Orchestr8 telemetry store. ClickHouse, not Prometheus, for one reason:
-- this product's primary key is high-cardinality by nature (gpu_uuid x model x
-- pod x request_id). Prometheus creates a new series per label combination and
-- a single high-cardinality label can multiply the bill overnight; ClickHouse
-- stores those as columns and compresses them 10-20x.
--
-- Retention is deliberately tiered. Raw spans are the largest cost line, so
-- they live 30d; the rollups the dashboard actually reads live 13 months and
-- cost almost nothing.

CREATE DATABASE IF NOT EXISTS orchestr8;

-- ---------------------------------------------------------------- raw layer
--
-- NOT DEFINED HERE. The ClickHouse exporter owns the otel_* tables and creates
-- them itself (create_schema: true), because it knows its own storage layout —
-- which splits metrics by type into otel_metrics_gauge / _sum / _histogram /
-- _summary / _exponential_histogram rather than one table. Declaring them here
-- too means fighting the exporter over DDL on every version bump, and losing
-- silently: writes fail into a table shape it did not expect.
--
-- This file owns the ROLLUP layer only: the aggregates the dashboard reads.

-- ------------------------------------------------------------ rollup layer
-- What the dashboard reads. Pre-aggregated at write time so a page load is a
-- key lookup, not a scan of 30 days of spans.

-- GPU state per minute. Throttled is carried alongside utilization on purpose:
-- the correlation engine's most valuable single join is "utilization high AND
-- throttled true AND ttft_p95 breaching".
CREATE TABLE IF NOT EXISTS orchestr8.gpu_minute
(
    Minute         DateTime CODEC(Delta, ZSTD(1)),
    ClusterId      LowCardinality(String),
    NodeName       LowCardinality(String),
    GpuUuid        String,
    GpuModel       SimpleAggregateFunction(any, LowCardinality(String)),
    UtilizationPct AggregateFunction(avgIf, Float64, UInt8),
    MemoryUsedMib  AggregateFunction(avgIf, Float64, UInt8),
    MemoryTotalMib AggregateFunction(maxIf, Float64, UInt8),
    TemperatureC   AggregateFunction(maxIf, Float64, UInt8),
    PowerWatts     AggregateFunction(avgIf, Float64, UInt8),
    SmClockMhz     AggregateFunction(minIf, Float64, UInt8)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(Minute)
ORDER BY (ClusterId, NodeName, GpuUuid, Minute)
TTL Minute + INTERVAL 13 MONTH;

CREATE MATERIALIZED VIEW IF NOT EXISTS orchestr8.gpu_minute_mv TO orchestr8.gpu_minute AS
SELECT
    toStartOfMinute(TimeUnix)                  AS Minute,
    ResourceAttributes['orchestr8.cluster.id'] AS ClusterId,
    Attributes['Hostname']                     AS NodeName,
    Attributes['UUID']                         AS GpuUuid,
    Attributes['modelName']                    AS GpuModel,
    avgIfState(Value, MetricName = 'DCGM_FI_DEV_GPU_UTIL')    AS UtilizationPct,
    avgIfState(Value, MetricName = 'DCGM_FI_DEV_FB_USED')     AS MemoryUsedMib,
    maxIfState(Value, MetricName = 'DCGM_FI_DEV_FB_TOTAL')    AS MemoryTotalMib,
    maxIfState(Value, MetricName = 'DCGM_FI_DEV_GPU_TEMP')    AS TemperatureC,
    avgIfState(Value, MetricName = 'DCGM_FI_DEV_POWER_USAGE') AS PowerWatts,
    minIfState(Value, MetricName = 'DCGM_FI_DEV_SM_CLOCK')    AS SmClockMhz
FROM orchestr8.otel_metrics_gauge
WHERE MetricName LIKE 'DCGM\_%'
GROUP BY Minute, ClusterId, NodeName, GpuUuid, GpuModel;

-- Histogram buckets are summed element-wise so an arbitrary window can be
-- re-quantiled correctly. Averaging pre-computed p95s across minutes is the
-- classic silent error this avoids.
CREATE TABLE IF NOT EXISTS orchestr8.inference_minute
(
    Minute      DateTime CODEC(Delta, ZSTD(1)),
    ClusterId   LowCardinality(String),
    Model       LowCardinality(String),
    Bounds      SimpleAggregateFunction(any, Array(Float64)),
    BucketSums  AggregateFunction(sumForEach, Array(UInt64)),
    Requests    AggregateFunction(sum, UInt64),
    TtftSumSec  AggregateFunction(sum, Float64)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(Minute)
ORDER BY (ClusterId, Model, Minute)
TTL Minute + INTERVAL 13 MONTH;

CREATE MATERIALIZED VIEW IF NOT EXISTS orchestr8.inference_minute_mv TO orchestr8.inference_minute AS
SELECT
    toStartOfMinute(TimeUnix)                  AS Minute,
    ResourceAttributes['orchestr8.cluster.id'] AS ClusterId,
    Attributes['model_name']                   AS Model,
    any(ExplicitBounds)                        AS Bounds,
    sumForEachState(BucketCounts)              AS BucketSums,
    sumState(Count)                            AS Requests,
    sumState(Sum)                              AS TtftSumSec
FROM orchestr8.otel_metrics_histogram
WHERE MetricName = 'vllm:time_to_first_token_seconds'
GROUP BY Minute, ClusterId, Model;

-- Correlations are written by the engine, not derived by a view. The Id is
-- stable per (cluster, model, cause) so a condition that persists updates one
-- row as evidence accumulates, rather than spamming a new row every tick —
-- ReplacingMergeTree collapses on UpdatedAt.
CREATE TABLE IF NOT EXISTS orchestr8.correlations
(
    Id                String,
    DetectedAt        DateTime64(3),
    UpdatedAt         DateTime64(3),
    Status            LowCardinality(String),
    Severity          LowCardinality(String),
    Summary           String CODEC(ZSTD(1)),
    WindowStart       DateTime64(3),
    WindowEnd         DateTime64(3),
    ServiceId         LowCardinality(String),
    Model             LowCardinality(String),
    SymptomMetric     LowCardinality(String),
    SymptomObserved   Float64,
    SymptomThreshold  Float64,
    CauseKind         LowCardinality(String),
    CauseGpuUuid      String,
    CauseNodeName     String,
    ClusterId         LowCardinality(String),
    -- Evidence is a small, write-once array of heterogeneous records that is
    -- only ever read back whole. JSON keeps it one column instead of five
    -- parallel Nested arrays that would have to be kept in lockstep.
    EvidenceJson      String CODEC(ZSTD(1)),
    Confidence        Float32,
    RecommendedAction String CODEC(ZSTD(1)),
    -- Notification state, kept on the row so it survives a restart. The engine
    -- re-detects an ongoing condition every tick; without this, an incident
    -- that lasts an hour would page the on-call engineer 180 times.
    NotifiedAt        DateTime64(3) DEFAULT toDateTime64(0, 3),
    NotifiedSeverity  LowCardinality(String) DEFAULT ''
)
ENGINE = ReplacingMergeTree(UpdatedAt)
PARTITION BY toYYYYMM(DetectedAt)
ORDER BY (ClusterId, Id)
TTL toDateTime(DetectedAt) + INTERVAL 13 MONTH;

-- ---------------------------------------------------------------- audit log
--
-- Append-only. No blockchain: a signed, hash-chained, append-only table gives
-- an auditor every property they actually ask for — immutability, ordering and
-- verifiability — without a distributed consensus problem nobody asked for.
--
-- PrevHash/Hash form a chain over the whole fleet's history. Recomputing the
-- chain detects any edit or deletion after the fact, which is the real
-- requirement behind "tamper-evident".
CREATE TABLE IF NOT EXISTS orchestr8.audit_log
(
    Seq         UInt64,                      -- monotonic, assigned by the writer
    At          DateTime64(3),
    Actor       LowCardinality(String),      -- who
    Action      LowCardinality(String),      -- what: deploy.request, deploy.approve, scan.run, correlation.acknowledge...
    Subject     String,                      -- the thing acted on
    ClusterId   LowCardinality(String),
    Outcome     LowCardinality(String),      -- allowed | denied | failed
    Detail      String CODEC(ZSTD(1)),       -- JSON payload; the evidence
    PrevHash    String,
    Hash        String
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(At)
ORDER BY (Seq)
TTL toDateTime(At) + INTERVAL 13 MONTH;

-- ------------------------------------------------------------------- scans
--
-- One row per scan run, plus the findings and the SBOM.
--
-- The SBOM is kept deliberately. When a new CVE lands, a stored SBOM can be
-- re-matched against the updated vulnerability database WITHOUT rebuilding or
-- re-pulling the image — turning "are we exposed to this?" from a multi-hour
-- rebuild into a query. It is the cheapest high-leverage feature in the whole
-- security surface.
CREATE TABLE IF NOT EXISTS orchestr8.scans
(
    Id          String,
    At          DateTime64(3),
    Target      String,                  -- image ref or filesystem path
    TargetKind  LowCardinality(String),  -- image | filesystem | repo
    Scanner     LowCardinality(String),
    DurationMs  UInt32,
    Critical    UInt32,
    High        UInt32,
    Medium      UInt32,
    Low         UInt32,
    Fixable     UInt32,
    SbomJson    String CODEC(ZSTD(3)),
    Outcome     LowCardinality(String)   -- ok | failed
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(At)
ORDER BY (Target, At)
TTL toDateTime(At) + INTERVAL 13 MONTH;

CREATE TABLE IF NOT EXISTS orchestr8.scan_findings
(
    ScanId       String,
    At           DateTime64(3),
    Target       String,
    VulnId       String,
    Severity     LowCardinality(String),
    Package      String,
    Installed    String,
    FixedVersion String,
    Title        String CODEC(ZSTD(1)),
    PrimaryUrl   String,
    -- Findings are ranked by fixability as well as severity: "9 of 12 have a
    -- patched version" is the actionable framing, and a critical with no fix
    -- available is a different conversation from one that is a version bump.
    Fixable      UInt8
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(At)
ORDER BY (Target, Severity, VulnId)
TTL toDateTime(At) + INTERVAL 13 MONTH;
