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
--
-- Every table below keys on OrgId FIRST. See migrations/002_org_scoping.sql
-- for why that ordering is load-bearing rather than cosmetic.

CREATE TABLE IF NOT EXISTS orchestr8.gpu_minute
(
    OrgId          LowCardinality(String) DEFAULT 'local',
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
ORDER BY (OrgId, ClusterId, NodeName, GpuUuid, Minute)
TTL Minute + INTERVAL 13 MONTH;

CREATE MATERIALIZED VIEW IF NOT EXISTS orchestr8.gpu_minute_mv TO orchestr8.gpu_minute AS
SELECT
    ifNull(nullIf(ResourceAttributes['orchestr8.org.id'], ''), 'local') AS OrgId,
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
GROUP BY OrgId, Minute, ClusterId, NodeName, GpuUuid, GpuModel;

CREATE TABLE IF NOT EXISTS orchestr8.inference_minute
(
    OrgId       LowCardinality(String) DEFAULT 'local',
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
ORDER BY (OrgId, ClusterId, Model, Minute)
TTL Minute + INTERVAL 13 MONTH;

CREATE MATERIALIZED VIEW IF NOT EXISTS orchestr8.inference_minute_mv TO orchestr8.inference_minute AS
SELECT
    ifNull(nullIf(ResourceAttributes['orchestr8.org.id'], ''), 'local') AS OrgId,
    toStartOfMinute(TimeUnix)                  AS Minute,
    ResourceAttributes['orchestr8.cluster.id'] AS ClusterId,
    Attributes['model_name']                   AS Model,
    any(ExplicitBounds)                        AS Bounds,
    sumForEachState(BucketCounts)              AS BucketSums,
    sumState(Count)                            AS Requests,
    sumState(Sum)                              AS TtftSumSec
FROM orchestr8.otel_metrics_histogram
WHERE MetricName = 'vllm:time_to_first_token_seconds'
GROUP BY OrgId, Minute, ClusterId, Model;

CREATE TABLE IF NOT EXISTS orchestr8.correlations
(
    OrgId             LowCardinality(String) DEFAULT 'local',
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
    EvidenceJson      String CODEC(ZSTD(1)),
    Confidence        Float32,
    RecommendedAction String CODEC(ZSTD(1)),
    NotifiedAt        DateTime64(3) DEFAULT toDateTime64(0, 3),
    NotifiedSeverity  LowCardinality(String) DEFAULT ''
)
ENGINE = ReplacingMergeTree(UpdatedAt)
PARTITION BY toYYYYMM(DetectedAt)
ORDER BY (OrgId, ClusterId, Id)
TTL toDateTime(DetectedAt) + INTERVAL 13 MONTH;

-- The audit chain becomes PER-ORGANISATION. Seq restarts per org and the hash
-- covers OrgId, so one tenant can neither break another's chain nor move an
-- entry between tenants — and sequence numbers stop leaking how active a
-- neighbouring organisation is.
CREATE TABLE IF NOT EXISTS orchestr8.audit_log
(
    OrgId       LowCardinality(String) DEFAULT 'local',
    Seq         UInt64,
    At          DateTime64(3),
    Actor       LowCardinality(String),
    Action      LowCardinality(String),
    Subject     String,
    ClusterId   LowCardinality(String),
    Outcome     LowCardinality(String),
    Detail      String CODEC(ZSTD(1)),
    PrevHash    String,
    Hash        String
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(At)
ORDER BY (OrgId, Seq)
TTL toDateTime(At) + INTERVAL 13 MONTH;

CREATE TABLE IF NOT EXISTS orchestr8.scans
(
    OrgId       LowCardinality(String) DEFAULT 'local',
    Id          String,
    At          DateTime64(3),
    Target      String,
    TargetKind  LowCardinality(String),
    Scanner     LowCardinality(String),
    DurationMs  UInt32,
    Critical    UInt32,
    High        UInt32,
    Medium      UInt32,
    Low         UInt32,
    Fixable     UInt32,
    SbomJson    String CODEC(ZSTD(3)),
    Outcome     LowCardinality(String)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(At)
ORDER BY (OrgId, Target, At)
TTL toDateTime(At) + INTERVAL 13 MONTH;

CREATE TABLE IF NOT EXISTS orchestr8.scan_findings
(
    OrgId        LowCardinality(String) DEFAULT 'local',
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
    Fixable      UInt8
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(At)
ORDER BY (OrgId, Target, Severity, VulnId)
TTL toDateTime(At) + INTERVAL 13 MONTH;

-- Added after the fact: a scan of an end-of-life OS comes back empty because
-- the distribution stopped publishing advisories, not because the image is
-- clean. Stored so the history can tell those two apart later, not just the
-- drawer at the moment of the scan.
ALTER TABLE orchestr8.scans ADD COLUMN IF NOT EXISTS OsFamily LowCardinality(String) DEFAULT '';
ALTER TABLE orchestr8.scans ADD COLUMN IF NOT EXISTS OsName String DEFAULT '';
ALTER TABLE orchestr8.scans ADD COLUMN IF NOT EXISTS OsEosl UInt8 DEFAULT 0;

-- The failure reason lived only in the audit ledger, which is the wrong place
-- to read it from: a scan is polled by id, and a poll that can say "failed"
-- but not why sends the reader back to a spinner with no explanation.
ALTER TABLE orchestr8.scans ADD COLUMN IF NOT EXISTS Error String DEFAULT '';
