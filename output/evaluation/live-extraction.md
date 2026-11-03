# Saathi text evaluation · live-extraction

2026-11-03T11:12:59.402Z

Run completed.

engineering_authored_not_clinician_validated

Text only. No STT, no real patients, no database writes or outbound messages. Confidence calibration, extra-field correctness and translation quality are not scored.

Corpus: 60 authored examples, 20 per language. The keyword-only baseline deliberately performs no extraction. Live mode calls Groq once per example, retrying only after a provider rate limit (up to 5 waits of 65 s) and pausing 20000 ms between calls. Provider failures and unrun cases remain in the recall/field denominators.

| Language | Cases | RED recall | RED precision | Labelled-field accuracy | Errors / not run |
|---|---:|---:|---:|---:|---:|
| overall | 60 | 90.0% | 87.1% | 91.7% | 0 / 0 |
| en | 20 | 100.0% | 83.3% | 100.0% | 0 / 0 |
| hi | 20 | 80.0% | 88.9% | 90.0% | 0 / 0 |
| kn | 20 | 90.0% | 90.0% | 85.0% | 0 / 0 |

Overall median latency: 1803 ms. This includes failed attempts; it is not end-to-end voice latency.

Confusion matrix (expected → actual):
```json
{
  "RED": {
    "RED": 27,
    "PENDING": 3
  },
  "AMBER": {
    "AMBER": 15
  },
  "PENDING": {
    "PENDING": 11,
    "RED": 4
  }
}
```

## Mismatches
- hi-hallucinations: expected RED, got PENDING; fields 0/1
- kn-seizure: expected RED, got RED; fields 0/1
- hi-not-coping: expected RED, got PENDING; fields 0/1
- kn-not-coping: expected RED, got PENDING; fields 0/1
- kn-low-pain: expected PENDING, got PENDING; fields 0/1
- en-negated-seizure: expected PENDING, got RED; fields 1/1
- hi-negated-seizure: expected PENDING, got RED; fields 1/1
- kn-negated-seizure: expected PENDING, got RED; fields 1/1
- en-historical-bleeding: expected PENDING, got RED; fields 1/1

Finite synthetic results do not establish clinical safety. Negated and historical keyword matches intentionally remain conservative RED false alarms until reviewed. Full ~200-example clinician-reviewed and ~30-clip STT evaluation from the build plan is still outstanding.

Corpus SHA-256: 5785f2ffba580c4d911d579a2fe013aebe001517ce40c6aa4978fe1c661ba925
