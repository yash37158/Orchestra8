-- Add OrgId to every long-lived table, FIRST in the sort key.
--
-- Why first: every query in a multi-tenant system filters by organisation, so
-- it must be the primary sort dimension for ClickHouse's data skipping to work.
-- Putting it second means every read scans other tenants' parts before
-- discarding them.
--
-- Why now: ClickHouse cannot ALTER a sort key. Retrofitting this later means
-- rewriting every table — which is exactly why PRD Q3 called it out as the
-- expensive decision.
--
-- Scope: the 13-month tables. Raw otel_* keeps its exporter-owned schema for
-- now; it has a 30-day TTL so it churns out on its own, and the ingest gateway
-- takes ownership of those writes in the next step.
--
-- DEFAULT 'local' is a migration crutch, not a design: it keeps writers that do
-- not yet set OrgId producing valid rows. The gateway derives OrgId from the
-- ingest token, and once it does this default should be dropped so a missing
-- org fails loudly instead of silently landing in someone else's tenant.

DROP TABLE IF EXISTS orchestr8.gpu_minute_mv;
DROP TABLE IF EXISTS orchestr8.inference_minute_mv;
DROP TABLE IF EXISTS orchestr8.gpu_minute;
DROP TABLE IF EXISTS orchestr8.inference_minute;
DROP TABLE IF EXISTS orchestr8.correlations;
DROP TABLE IF EXISTS orchestr8.audit_log;
DROP TABLE IF EXISTS orchestr8.scans;
DROP TABLE IF EXISTS orchestr8.scan_findings;

CREATE TABLE orchestr8.gpu_minute
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

CREATE MATERIALIZED VIEW orchestr8.gpu_minute_mv TO orchestr8.gpu_minute AS
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

CREATE TABLE orchestr8.inference_minute
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

CREATE MATERIALIZED VIEW orchestr8.inference_minute_mv TO orchestr8.inference_minute AS
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

CREATE TABLE orchestr8.correlations
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
CREATE TABLE orchestr8.audit_log
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

CREATE TABLE orchestr8.scans
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

CREATE TABLE orchestr8.scan_findings
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
