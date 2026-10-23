# Saathi text evaluation · keyword-only

2026-10-23T18:57:30.088Z

Run completed.

engineering_authored_not_clinician_validated

Text only. No STT, no real patients, no database writes or outbound messages. Confidence calibration, extra-field correctness and translation quality are not scored.

Corpus: 60 authored examples, 20 per language. The keyword-only baseline deliberately performs no extraction. Live mode calls Groq once per example, with no automatic retries. Provider failures and unrun cases remain in the recall/field denominators.

| Language | Cases | RED recall | RED precision | Labelled-field accuracy | Errors / not run |
|---|---:|---:|---:|---:|---:|
| overall | 60 | 33.3% | 71.4% | 0.0% | 0 / 0 |
| en | 20 | 50.0% | 71.4% | 0.0% | 0 / 0 |
| hi | 20 | 30.0% | 75.0% | 0.0% | 0 / 0 |
| kn | 20 | 20.0% | 66.7% | 0.0% | 0 / 0 |

Overall median latency: 0 ms. This includes failed attempts; it is not end-to-end voice latency.

Confusion matrix (expected → actual):
```json
{
  "RED": {
    "RED": 10,
    "PENDING": 20
  },
  "AMBER": {
    "PENDING": 15
  },
  "PENDING": {
    "PENDING": 11,
    "RED": 4
  }
}
```

## Mismatches
- en-cannot-wake: expected RED, got RED; fields 0/1
- hi-cannot-wake: expected RED, got RED; fields 0/1
- kn-cannot-wake: expected RED, got PENDING; fields 0/1
- en-falls-asleep: expected RED, got RED; fields 0/1
- hi-falls-asleep: expected RED, got PENDING; fields 0/1
- kn-falls-asleep: expected RED, got PENDING; fields 0/1
- en-rate-boundary: expected RED, got PENDING; fields 0/2
- hi-rate-boundary: expected RED, got PENDING; fields 0/2
- kn-rate-boundary: expected RED, got PENDING; fields 0/2
- en-slow-pauses: expected RED, got RED; fields 0/1
- hi-slow-pauses: expected RED, got PENDING; fields 0/1
- kn-slow-pauses: expected RED, got PENDING; fields 0/1
- en-sudden-confusion: expected RED, got PENDING; fields 0/1
- hi-sudden-confusion: expected RED, got PENDING; fields 0/1
- kn-sudden-confusion: expected RED, got PENDING; fields 0/1
- en-hallucinations: expected RED, got PENDING; fields 0/1
- hi-hallucinations: expected RED, got PENDING; fields 0/1
- kn-hallucinations: expected RED, got PENDING; fields 0/1
- en-blood-vomit: expected RED, got RED; fields 0/1
- hi-blood-vomit: expected RED, got RED; fields 0/1
- kn-blood-vomit: expected RED, got RED; fields 0/1
- en-seizure: expected RED, got RED; fields 0/1
- hi-seizure: expected RED, got RED; fields 0/1
- kn-seizure: expected RED, got RED; fields 0/1
- en-double-dose: expected RED, got PENDING; fields 0/1
- hi-double-dose: expected RED, got PENDING; fields 0/1
- kn-double-dose: expected RED, got PENDING; fields 0/1
- en-not-coping: expected RED, got PENDING; fields 0/1
- hi-not-coping: expected RED, got PENDING; fields 0/1
- kn-not-coping: expected RED, got PENDING; fields 0/1
- en-rescue-three: expected AMBER, got PENDING; fields 0/1
- hi-rescue-three: expected AMBER, got PENDING; fields 0/1
- kn-rescue-three: expected AMBER, got PENDING; fields 0/1
- en-rescue-four: expected AMBER, got PENDING; fields 0/1
- hi-rescue-four: expected AMBER, got PENDING; fields 0/1
- kn-rescue-four: expected AMBER, got PENDING; fields 0/1
- en-vomit-three: expected AMBER, got PENDING; fields 0/1
- hi-vomit-three: expected AMBER, got PENDING; fields 0/1
- kn-vomit-three: expected AMBER, got PENDING; fields 0/1
- en-missed-two: expected AMBER, got PENDING; fields 0/1
- hi-missed-two: expected AMBER, got PENDING; fields 0/1
- kn-missed-two: expected AMBER, got PENDING; fields 0/1
- en-missed-four: expected AMBER, got PENDING; fields 0/1
- hi-missed-four: expected AMBER, got PENDING; fields 0/1
- kn-missed-four: expected AMBER, got PENDING; fields 0/1
- en-low-pain: expected PENDING, got PENDING; fields 0/1
- hi-low-pain: expected PENDING, got PENDING; fields 0/1
- kn-low-pain: expected PENDING, got PENDING; fields 0/1
- en-stool-no-context: expected PENDING, got PENDING; fields 0/1
- hi-stool-no-context: expected PENDING, got PENDING; fields 0/1
- kn-stool-no-context: expected PENDING, got PENDING; fields 0/1
- en-negated-seizure: expected PENDING, got RED; fields 0/1
- hi-negated-seizure: expected PENDING, got RED; fields 0/1
- kn-negated-seizure: expected PENDING, got RED; fields 0/1
- en-historical-bleeding: expected PENDING, got RED; fields 0/1
- hi-historical-bleeding: expected PENDING, got PENDING; fields 0/1
- kn-historical-bleeding: expected PENDING, got PENDING; fields 0/1

Finite synthetic results do not establish clinical safety. Negated and historical keyword matches intentionally remain conservative RED false alarms until reviewed. Full ~200-example clinician-reviewed and ~30-clip STT evaluation from the build plan is still outstanding.

Corpus SHA-256: 5785f2ffba580c4d911d579a2fe013aebe001517ce40c6aa4978fe1c661ba925
