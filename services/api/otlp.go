package main

// A read-only walk over an OTLP protobuf export request, far enough in to see
// which organisation and cluster the payload claims to belong to.
//
// It reads; it does not rewrite. Checking that the claim matches the token is
// enough to close the hole, and checking needs no protobuf re-encoding, no
// generated code and no dependency. The trade is that the collector must still
// declare orchestr8.org.id — but a wrong declaration is now a 403 instead of a
// silent write into someone else's tenant. Loud beats silent.
//
// ponytail: hand-rolled scan of four nested fields. If the chart should ever
// stop declaring org at all, this becomes a rewrite and earns
// go.opentelemetry.io/proto/otlp.

import (
	"encoding/binary"
	"errors"
)

// Wire types, from the protobuf encoding spec.
const (
	wireVarint = 0
	wireI64    = 1
	wireLen    = 2
	wireI32    = 5
)

var errMalformedOTLP = errors.New("malformed OTLP payload")

// nextField splits one field off the front of a protobuf message.
func nextField(b []byte) (num, typ int, val, rest []byte, ok bool) {
	tag, n := binary.Uvarint(b)
	if n <= 0 {
		return 0, 0, nil, nil, false
	}
	b = b[n:]
	num, typ = int(tag>>3), int(tag&7)
	switch typ {
	case wireVarint:
		_, n := binary.Uvarint(b)
		if n <= 0 {
			return 0, 0, nil, nil, false
		}
		return num, typ, b[:n], b[n:], true
	case wireI64:
		if len(b) < 8 {
			return 0, 0, nil, nil, false
		}
		return num, typ, b[:8], b[8:], true
	case wireI32:
		if len(b) < 4 {
			return 0, 0, nil, nil, false
		}
		return num, typ, b[:4], b[4:], true
	case wireLen:
		l, n := binary.Uvarint(b)
		if n <= 0 || uint64(len(b)-n) < l {
			return 0, 0, nil, nil, false
		}
		return num, typ, b[n : n+int(l)], b[n+int(l):], true
	}
	return 0, 0, nil, nil, false
}

// otlpResourceAttrs returns the resource attributes of every resource block in
// an export request — one map per block.
//
// Metrics, traces and logs share a shape: the request holds a repeated wrapper
// at field 1 (resource_metrics / resource_spans / resource_logs), each wrapper
// holds a Resource at field 1, and a Resource holds repeated KeyValue
// attributes at field 1. So one walk covers all three signals.
func otlpResourceAttrs(body []byte) ([]map[string]string, error) {
	var out []map[string]string
	for b := body; len(b) > 0; {
		num, typ, val, rest, ok := nextField(b)
		if !ok {
			return nil, errMalformedOTLP
		}
		b = rest
		if num == 1 && typ == wireLen {
			out = append(out, resourceAttrs(val))
		}
	}
	return out, nil
}

// resourceAttrs pulls the attributes out of one ResourceMetrics/Spans/Logs.
func resourceAttrs(wrapper []byte) map[string]string {
	attrs := map[string]string{}
	for b := wrapper; len(b) > 0; {
		num, typ, val, rest, ok := nextField(b)
		if !ok {
			return attrs
		}
		b = rest
		if num != 1 || typ != wireLen { // Resource
			continue
		}
		for res := val; len(res) > 0; {
			n, t, kv, rem, ok := nextField(res)
			if !ok {
				return attrs
			}
			res = rem
			if n != 1 || t != wireLen { // repeated KeyValue
				continue
			}
			if k, v, ok := keyValue(kv); ok {
				attrs[k] = v
			}
		}
	}
	return attrs
}

// keyValue decodes one KeyValue, keeping only string values. Org and cluster
// ids are strings; anything else cannot match a slug and is left out so it
// cannot accidentally satisfy a comparison.
func keyValue(kv []byte) (key, val string, ok bool) {
	for b := kv; len(b) > 0; {
		num, typ, payload, rest, good := nextField(b)
		if !good {
			return "", "", false
		}
		b = rest
		if typ != wireLen {
			continue
		}
		switch num {
		case 1:
			key, ok = string(payload), true
		case 2: // AnyValue
			for av := payload; len(av) > 0; {
				n, t, sv, rem, good := nextField(av)
				if !good {
					break
				}
				av = rem
				if n == 1 && t == wireLen { // string_value
					val = string(sv)
				}
			}
		}
	}
	return key, val, ok
}
