# Stands in for a GPU node's DCGM exporter. Speaks the real exposition format,
# so the collector scrapes it with the config it would use on real hardware.
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY *.go ./
RUN CGO_ENABLED=0 go build -o /devkit .

FROM alpine:3.21
COPY --from=build /devkit /devkit
EXPOSE 9400
ENTRYPOINT ["/devkit", "-addr", ":9400", "-interval", "5s"]
