# The query API, the ingest gateway and the schema bootstrap: one binary,
# two ports, one -migrate mode.
#
# Build context is the repository root, not services/api — the control-plane
# schema lives under services/control and travels in the image so the migration
# Job needs no second artefact.
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY services/api/go.mod services/api/go.sum ./
RUN go mod download
COPY services/api/*.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /orchestr8-api .

# Alpine rather than distroless, deliberately.
#
# Deploy shells out to git and the security scan shells out to trivy. On a
# distroless base both features fail at runtime with "executable file not
# found" — a smaller image that cannot do two of the things the product sells.
# The shell is the cost; it is paid down by running as a non-root user with a
# read-only root filesystem and no capabilities (see the chart's
# containerSecurityContext).
FROM aquasec/trivy:0.58.1 AS trivy

FROM alpine:3.21
RUN apk add --no-cache git ca-certificates && adduser -D -u 10001 orchestr8
COPY --from=trivy /usr/local/bin/trivy /usr/local/bin/trivy
COPY --from=build /orchestr8-api /orchestr8-api
COPY services/control/migrations/ /migrations/
COPY services/api/schema.sql /schema.sql
COPY config/ /config/
USER orchestr8
EXPOSE 8088 4319
ENTRYPOINT ["/orchestr8-api"]
