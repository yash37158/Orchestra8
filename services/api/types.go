package main

// Go mirror of packages/contracts/index.ts. Field names and nullability must
// match exactly — contract_test.go round-trips the shared golden fixtures
// through these structs and fails on any drift in either direction.

type Cluster struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Provider       string  `json:"provider"`
	Region         string  `json:"region"`
	Status         string  `json:"status"`
	Nodes          int     `json:"nodes"`
	CPUPct         float64 `json:"cpuPct"`
	MemoryPct      float64 `json:"memoryPct"`
	UptimePct      float64 `json:"uptimePct"`
	CostPerHourUSD float64 `json:"costPerHourUsd"`
}

type TopologyLink struct {
	Source    string  `json:"source"`
	Target    string  `json:"target"`
	Status    string  `json:"status"`
	LatencyMs float64 `json:"latencyMs"`
}

type Topology struct {
	Clusters []Cluster      `json:"clusters"`
	Links    []TopologyLink `json:"links"`
}

type ActivityEvent struct {
	ID            string  `json:"id"`
	Kind          string  `json:"kind"`
	Severity      string  `json:"severity"`
	Title         string  `json:"title"`
	Description   string  `json:"description"`
	At            string  `json:"at"`
	CorrelationID *string `json:"correlationId"`
}

// GpuDevice is DCGM exporter telemetry for one physical GPU or MIG slice.
// Utilization is deliberately stored next to Throttled: a GPU pinned at 99%
// while throttling is the single most common cause of an inference SLO breach
// that infra dashboards report as healthy.
type GpuDevice struct {
	UUID           string  `json:"uuid"`
	ClusterID      string  `json:"clusterId"`
	NodeName       string  `json:"nodeName"`
	Model          string  `json:"model"`
	MigProfile     *string `json:"migProfile"`
	UtilizationPct float64 `json:"utilizationPct"`
	MemoryUsedGb   float64 `json:"memoryUsedGb"`
	MemoryTotalGb  float64 `json:"memoryTotalGb"`
	TemperatureC   float64 `json:"temperatureC"`
	PowerWatts     float64 `json:"powerWatts"`
	Throttled      bool    `json:"throttled"`
	XidErrors      int     `json:"xidErrors"`
}

type InferenceService struct {
	ID              string  `json:"id"`
	ClusterID       string  `json:"clusterId"`
	Model           string  `json:"model"`
	Engine          string  `json:"engine"`
	Replicas        int     `json:"replicas"`
	TtftMsP50       float64 `json:"ttftMsP50"`
	TtftMsP95       float64 `json:"ttftMsP95"`
	TtftMsP99       float64 `json:"ttftMsP99"`
	TokensPerSecond float64 `json:"tokensPerSecond"`
	QueueDepth      int     `json:"queueDepth"`
	BatchSize       int     `json:"batchSize"`
	KvCacheUsagePct float64 `json:"kvCacheUsagePct"`
	ErrorRatePct    float64 `json:"errorRatePct"`
	TtftSloMs       float64 `json:"ttftSloMs"`
}

type CorrelationSymptom struct {
	ServiceID string  `json:"serviceId"`
	Model     string  `json:"model"`
	Metric    string  `json:"metric"`
	Observed  float64 `json:"observed"`
	Threshold float64 `json:"threshold"`
}

// Evidence is structured so the UI can draw the metric it cites over the exact
// window the engine examined. A claim the reader cannot inspect is one they
// have to take on faith.
type Evidence struct {
	Text        string  `json:"text"`
	Metric      *string `json:"metric"`
	Subject     *string `json:"subject"`
	WindowStart string  `json:"windowStart"`
	WindowEnd   string  `json:"windowEnd"`
}

type CorrelationCause struct {
	Kind      string     `json:"kind"`
	GpuUUID   *string    `json:"gpuUuid"`
	NodeName  *string    `json:"nodeName"`
	ClusterID string     `json:"clusterId"`
	Evidence  []Evidence `json:"evidence"`
}

// Correlation is the product. Everything else is table stakes that Datadog,
// Grafana and Langfuse already sell. Confidence and Evidence are exposed
// deliberately: an unexplained verdict is not actionable at 3am.
type Correlation struct {
	ID                string             `json:"id"`
	DetectedAt        string             `json:"detectedAt"`
	UpdatedAt         string             `json:"updatedAt"`
	Status            string             `json:"status"`
	Severity          string             `json:"severity"`
	Summary           string             `json:"summary"`
	WindowStart       string             `json:"windowStart"`
	WindowEnd         string             `json:"windowEnd"`
	Symptom           CorrelationSymptom `json:"symptom"`
	Cause             CorrelationCause   `json:"cause"`
	Confidence        float64            `json:"confidence"`
	RecommendedAction string             `json:"recommendedAction"`
}

type ClusterCount struct {
	Healthy int `json:"healthy"`
	Total   int `json:"total"`
}

type Overview struct {
	GeneratedAt               string       `json:"generatedAt"`
	LastTelemetryAt           *string      `json:"lastTelemetryAt"`
	Clusters                  ClusterCount `json:"clusters"`
	FleetUptimePct            float64      `json:"fleetUptimePct"`
	GpuUtilizationPct         float64      `json:"gpuUtilizationPct"`
	InferenceSloAttainmentPct float64      `json:"inferenceSloAttainmentPct"`
	FleetCostPerDayUsd        float64      `json:"fleetCostPerDayUsd"`
	OpenCorrelations          int          `json:"openCorrelations"`
}

type DashboardResponse struct {
	Overview     Overview           `json:"overview"`
	Topology     Topology           `json:"topology"`
	Activity     []ActivityEvent    `json:"activity"`
	Gpus         []GpuDevice        `json:"gpus"`
	Services     []InferenceService `json:"services"`
	Correlations []Correlation      `json:"correlations"`
}
