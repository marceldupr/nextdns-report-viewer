# WhatsApp & Facebook Communication Detection Algorithms

This document explains the sophisticated algorithms used to detect real communication activity from DNS logs, developed through extensive real-world testing and pattern analysis.

## Overview

The detection algorithms analyze DNS request patterns to identify genuine communication activities while filtering out background app activity, keep-alive requests, and false positives. All algorithms are based on actual communication patterns observed in real usage scenarios.

## Core Principles

### 1. Evidence-Based Detection
- **Objective**: Present technical evidence, not accusations
- **Conservative**: Require multiple indicators for high confidence
- **Context-Aware**: Consider timing, sequence, and related activity
- **Honest Uncertainty**: Acknowledge when DNS data cannot provide definitive answers

### 2. Temporal Pattern Analysis
- **Time Windows**: Analyze activity within specific time ranges (10 seconds to 5 minutes)
- **Sequence Detection**: Look for ordered patterns of DNS requests
- **Burst Analysis**: Distinguish between isolated requests and activity clusters

### 3. False Positive Prevention
- **App Launch Detection**: Identify and exclude app startup patterns
- **Keep-Alive Filtering**: Ignore routine maintenance requests
- **Background Noise**: Filter out unrelated system activity

## WhatsApp Detection Algorithms

### 1. Voice Note Detection (Revised)

**Pattern**: WhatsApp signalling followed by media CDN or mmg upload sequence

```
Timeline: g.whatsapp.net → media-jnb2-1.cdn.whatsapp.net (within 2 minutes)
OR: mmg.whatsapp.net → dit.whatsapp.net → static.whatsapp.net
```

**Implementation**:
- **Voice Note Sent**: Primary indicator is `mmg.whatsapp.net` (multimedia messaging gateway)
- **Voice Note Received**: APNs → WhatsApp signalling → media CDN playback
- **Conservative Approach**: Classify as "Voice Note" rather than ambiguous "Call or Voice Note"
- Determine direction based on preceding APNs notifications and upload vs download patterns

**Key Change**: Based on real-world testing, most "call" detections are actually voice notes. DNS patterns cannot reliably distinguish voice calls from voice notes, so we classify conservatively as voice notes unless clear call indicators are present.

**Confidence Levels**:
- **Very High (9/10)**: mmg.whatsapp.net + complete sequence (voice note sent)
- **High (8/10)**: APNs + signalling + media CDN (voice note received)
- **Medium (6/10)**: Signalling + media CDN, no APNs (voice note sent/received)

**Real-World Example**:
```
16:16:45 UTC - g.whatsapp.net (activity initiation)
16:17:25 UTC - media-jnb2-1.cdn.whatsapp.net (audio/data)
= Call or Voice Note (outgoing) - DNS cannot distinguish
```

### 2. Voice Note Sent Detection

**Pattern**: Media upload followed by complete processing sequence

```
Timeline: mmg.whatsapp.net → dit.whatsapp.net → static.whatsapp.net → media-*.cdn.whatsapp.net
```

**Implementation**:
- Primary indicator: `mmg.whatsapp.net` (multimedia messaging gateway)
- Supporting evidence: `dit.whatsapp.net`, `static.whatsapp.net`, media CDN
- Boost confidence when complete sequence is present

**Confidence Levels**:
- **Very High (9/10)**: Complete sequence (mmg + dit + static + media CDN)
- **High (6/10)**: mmg.whatsapp.net present

**Real-World Example**:
```
16:16:30 UTC - mmg.whatsapp.net (voice note upload)
16:16:45 UTC - dit.whatsapp.net (data processing)
16:17:25 UTC - media-jnb2-1.cdn.whatsapp.net (immediate playback)
= Voice Note Sent (with playback)
```

### 3. Voice Note Received Detection

**Pattern**: APNs notification followed by WhatsApp signalling and media playback

```
Timeline: courier*.push.apple.com → g.whatsapp.net → media-*.cdn.whatsapp.net
```

**Implementation**:
- Detect APNs notifications (`courier*.push.apple.com`)
- Look for WhatsApp signalling within 5 minutes
- Check for media CDN (indicates playback)
- Exclude if Apple system domains suggest voice call

**Confidence Levels**:
- **High (6/10)**: APNs + signalling + media CDN, minimal Apple system activity

**Real-World Example**:
```
16:16:55 UTC - 1-courier2.push.apple.com (incoming notification)
16:17:00 UTC - g.whatsapp.net (processing notification)
16:17:25 UTC - media-jnb2-1.cdn.whatsapp.net (voice note playback)
= Voice Note Received
```

### 4. Text Message Detection

**Pattern**: Multiple indicators of active messaging

**Implementation**:
Three detection patterns (in order of confidence):

1. **APNs + Signalling** (Highest Confidence - 7/10):
   ```
   courier*.push.apple.com → g.whatsapp.net/graph.whatsapp.com
   ```

2. **Active Conversation** (Medium-High Confidence - 5/10):
   ```
   dit.whatsapp.net + graph.whatsapp.com + g.whatsapp.net
   ```

3. **Messaging Session** (Medium Confidence - 4/10):
   ```
   mmg.whatsapp.net present (indicates active messaging)
   ```

**Exclusions**:
- Isolated `g.whatsapp.net` (keep-alive, ~3 minute intervals)
- Single domain requests without context

### 5. Keep-Alive Detection and Filtering

**Pattern**: Regular, isolated `g.whatsapp.net` requests

**Analysis Results**:
- **Average interval**: 182 seconds (~3 minutes)
- **Pattern**: Single domain requests without supporting activity
- **Action**: Exclude from communication evidence

## Facebook Detection Algorithms

### 1. App Launch Detection

**Pattern**: Burst of multiple Facebook domains

```
Threshold: 4+ unique Facebook domains + 8+ total requests in same time window
```

**Implementation**:
- Count unique Facebook domains in time window
- Count total Facebook requests
- If thresholds exceeded, classify as background app launch
- Exclude from communication evidence

**Domains Typically Seen in App Launch**:
- `rupload.facebook.com`
- `chat-e2ee.facebook.com`
- `graph.facebook.com`
- `gateway.facebook.com`
- `edge-mqtt.facebook.com`
- `star.fallback.c10r.facebook.com`

### 2. Message + Possible Media Exchange Detection (Revised)

**Pattern**: Upload and download activity with messaging context

```
Timeline: rupload.facebook.com + scontent-*.fbcdn.net + edge-mqtt/graph activity
```

**Implementation**:
- **Possible Media Sent**: `rupload.facebook.com` with messaging context
- **Possible Media Received**: `scontent-*.fbcdn.net` with messaging activity
- **Complete Exchange**: Both upload and download patterns present
- **Context Validation**: Must have messaging domains (edge-mqtt, graph, gateway) within time window
- **Timing Window**: Extended to 5 minutes to account for processing delays

**Key Change**: Based on real-world testing at 10:08 and 18:08 SAST, removed strict APNs requirement and focus on upload/download patterns with messaging context. Updated terminology to "Possible Media" to reflect DNS analysis limitations.

**Confidence Levels**:
- **Very High (9/10)**: rupload + scontent + messaging context (complete exchange)
- **High (8/10)**: rupload + messaging context (possible media sent)
- **High (7/10)**: scontent + messaging context (possible media received)
- **Medium (5/10)**: Upload/download without clear messaging context

**Note**: DNS analysis cannot determine exact media type (photos, videos, documents) - hence "Possible Media" terminology for accuracy.

### 3. Message Sent Detection

**Pattern**: Send UI activity with messaging backend

```
Timeline: pm.facebook.com/web.facebook.com + edge-mqtt.facebook.com
```

**Requirements**:
- Must be isolated activity (not part of app launch)
- No concurrent media upload/download
- Must have messaging MQTT activity

### 4. Notification Received Detection

**Pattern**: Isolated MQTT activity

```
Domain: edge-mqtt.facebook.com (alone, not during app launch)
```

**Requirements**:
- MQTT activity without send UI
- No media upload/download
- Not part of app launch burst
- Minimal other Facebook activity (≤2 domains)

### 5. Background Activity Exclusions

**Patterns Excluded**:
- App launch bursts (4+ domains, 8+ requests)
- Isolated media domains without messaging context
- Facebook domains during WhatsApp usage (iOS background sync)

## Technical Implementation Details

### Data Processing Pipeline

1. **DNS Record Deduplication**:
   ```typescript
   // Group A, AAAA, HTTPS queries for same domain within 30 seconds
   const key = `${entry.domain}_${roundedTime}`
   ```

2. **Timezone Conversion**:
   ```typescript
   // Smart detection of timestamp format
   if (entry.timestamp.includes('+02:00')) {
     // Already SAST, no conversion
   } else if (entry.timestamp.endsWith('Z')) {
     // UTC, convert to SAST (+2 hours)
   }
   ```

3. **Time Window Analysis**:
   ```typescript
   // Find entries within specific time ranges
   function findEntriesInWindow(entries, targetTime, beforeSeconds, afterSeconds)
   ```

### Detection Function Structure

```typescript
function detectWhatsAppActivity(windowEntries: ProcessedLogEntry[]) {
  // 1. Sort by timestamp for temporal analysis
  // 2. Check for APNs incoming call patterns
  // 3. Detect voice calls (signalling → media CDN)
  // 4. Detect text messages (APNs + signalling, conversation patterns)
  // 5. Detect voice notes sent (mmg + sequence)
  // 6. Detect voice notes received (APNs → signalling → media)
  // 7. Apply confidence scoring
}
```

### Confidence Scoring System

**Score Ranges**:
- **8-10**: Very High Confidence (APNs + complete patterns)
- **6-7**: High Confidence (Strong indicators)
- **4-5**: Medium Confidence (Multiple indicators)
- **1-3**: Low Confidence (Minimal evidence)
- **0**: No evidence (excluded)

## Algorithm Evolution

### Development Process

1. **Initial Implementation**: Simple domain matching
2. **Real-World Testing**: User provided actual communication logs from both perspectives
3. **Pattern Analysis**: Identified false positives and missed detections
4. **Algorithm Refinement**: Added temporal analysis and sequence detection
5. **Conservative Tuning**: Reduced false positives based on feedback
6. **Perspective Validation**: Validated detection accuracy using sender's chat log vs receiver's DNS logs
7. **Final Calibration**: Balanced accuracy vs false positive prevention with cross-perspective validation

### Key Insights Learned

1. **`g.whatsapp.net` alone** = keep-alive (average 3-minute intervals)
2. **`dit.whatsapp.net`** = normal app usage, not call-specific
3. **Media CDN timing** = crucial for voice call vs voice note distinction
4. **Facebook app launch** = creates domain bursts that aren't messaging
5. **APNs patterns** = most reliable indicator of incoming activity

### Validation Methodology

**Test Cases Used**:
- Clean baseline data (no communication)
- WhatsApp voice calls vs voice notes (cross-validated)
- WhatsApp voice note exchanges (both directions)
- WhatsApp text conversations
- Facebook message + photo exchanges (validated with real tests)
- Mixed communication scenarios
- Cross-device validation (sender vs receiver perspectives)

**Real-World Validation Results**:
- **Facebook Messenger Test 1**: 10:08 SAST (08:08 UTC) - "Hello lief" message
  - ✅ Detected: Marcel iPhone (BH02D) `rupload.facebook.com` at 08:08:14 UTC
  - ✅ Detected: Melissa iPhone (CL8T6) `chat-e2ee.facebook.com` at 08:08:15 UTC
- **Facebook Messenger Test 2**: 18:08 SAST (16:08 UTC) - Picture + message
  - ✅ Detected: Multiple Facebook domains including `rupload.facebook.com`, `scontent-*.fbcdn.net`, `edge-mqtt.facebook.com` at 16:08-16:09 UTC
- **WhatsApp Voice Notes**: Cross-validated chat log vs DNS activity
  - ✅ Confirmed: Most "call" detections are actually voice notes
  - ✅ Refined: Conservative classification as voice notes rather than ambiguous calls

**Validation Criteria**:
- Zero false positives on clean data
- Accurate detection of known communication events with cross-device validation
- Proper classification of activity types (voice notes vs calls)
- Realistic confidence scoring based on actual communication patterns
- Algorithm refinement based on sender/receiver DNS activity correlation

## Usage in Application

### PDF Report Generation
- Shows only detected communication evidence
- Includes detection algorithm used for each event
- Color-coded by activity type (calls, media, messages)
- Excludes background activity and low-confidence detections

### Real-Time Analysis
- Minute-level granularity for detailed analysis
- Interactive charts with zoom functionality
- Filter-based analysis (day selection required)
- Evidence-based language (not accusatory)

### Performance Considerations
- Deduplication for large datasets (>50k entries)
- Asynchronous processing to prevent UI blocking
- Smart thresholds to balance accuracy vs performance

## Future Improvements

### Potential Enhancements
1. **Flow-based analysis**: Incorporate network flow metadata
2. **TLS fingerprinting**: Add JA3/JA4 analysis for encrypted traffic
3. **Machine learning**: Pattern recognition for unknown communication apps
4. **Real-time monitoring**: Live detection capabilities

### Known Limitations
1. **DNS-only analysis**: Cannot detect content or determine message recipients
2. **Call vs Voice Note ambiguity**: DNS patterns are similar for both activities
3. **Encrypted traffic**: Limited visibility into HTTPS/QUIC communications
4. **Privacy-focused apps**: May use domain fronting or other evasion techniques
5. **VPN interference**: May obscure or redirect traffic patterns
6. **Temporal uncertainty**: Activity timing may not reflect exact communication timing

---

*This documentation reflects the current state of the detection algorithms as of the implementation date. Algorithms are continuously refined based on real-world usage patterns and feedback.*
