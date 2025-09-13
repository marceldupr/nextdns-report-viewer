# Reels Masking Analysis & Detection

## The Critical Discovery

Facebook Reels scrolling creates DNS patterns that are **identical** to messaging activity, leading to false positives that can cause relationship trust issues.

## Real Data Pattern Analysis

### Your Actual Data Pattern (Innocent Reels Scrolling)

```
4 minutes ago: 4bea6f62-*-netseer-ipaddr-assoc.xy.fbcdn.net  ← REELS CDN
4 minutes ago: 4bea6f62-*-netseer-ipaddr-assoc.xz.fbcdn.net  ← REELS CDN  
4 minutes ago: chat-e2ee.facebook.com                         ← Background sync
4 minutes ago: g.whatsapp.net                                 ← Keep-alive
6 minutes ago: aggr32-normal.tiktokv.com                      ← TikTok content
7 minutes ago: gateway.facebook.com                           ← Background API
7 minutes ago: edge-mqtt.facebook.com                         ← Background updates
9 minutes ago: 86ccfe52-*-netseer-ipaddr-assoc.xz.fbcdn.net  ← REELS CDN
20 min ago:    rupload.facebook.com                           ← Analytics upload
```

### Key Insight: **NetSeer CDN = Ongoing Video Consumption**

**NetSeer CDN Pattern**: `*-netseer-ipaddr-assoc.*.fbcdn.net`
- **Purpose**: Video CDN optimization for smooth streaming
- **Indicates**: Active video content consumption (Reels/Stories)
- **Critical**: When present, other messaging domains are likely background activity

## Conservative Detection Approach

### **When NetSeer CDN is Present:**
1. **Classify as**: Reels Scrolling
2. **Override**: Any messaging detection  
3. **Reason**: Background messaging domains during video consumption are sync, not communication
4. **Trust Impact**: Prevents false messaging accusations during innocent Reels viewing

### **When NetSeer CDN is Absent:**
1. **Normal Detection**: Apply standard messaging algorithms
2. **Higher Confidence**: Messaging domains more likely to be real communication
3. **Masking Detection**: Look for suspicious patterns (Reels stop → messaging → Reels resume)

## Masking vs Innocent Usage

### **Innocent Reels Scrolling (Your Data)**
```
Pattern: Continuous NetSeer CDN + background messaging domains
Classification: Reels Scrolling
Trust Impact: No false messaging alerts
```

### **Suspicious Masking Attempt**
```
Pattern: Reels → GAP → Strong messaging (APNs + uploads) → Reels resume
Classification: Messaging activity + Masking warning
Trust Impact: Flags potential deceptive behavior
```

## Algorithm Refinements

### **1. Conservative Reels Detection**
```typescript
if (hasNetSeerCDN || hasVideoStaticAssets) {
  isReelsScrolling = true
  isMessaging = false      // Override messaging detection
  isMediaTransfer = false  // Override media detection
  return // Exit early - don't continue with messaging detection
}
```

### **2. Masking Detection (For Suspicious Patterns)**
```typescript
// Only flag masking for STRONG messaging evidence after Reels gaps
const hasStrongMessagingEvidence = 
  (facebookActivity.isMessaging && facebookActivity.isMediaTransfer) ||
  (whatsappActivity.callDirection === 'incoming') ||
  whatsappActivity.isMediaTransfer ||
  activityScore > 6
```

### **3. TikTok Integration**
```typescript
reelsVideo: [
  '-netseer-ipaddr-assoc.',  // Facebook Reels CDN
  'tiktokv.com',             // TikTok video content
  'static-*.xx.fbcdn.net',   // Video static assets
]
```

## Report Output Examples

### **Before (False Positive)**
```
20:40 SAST - Facebook - Possible Media Sent - rupload + messaging
20:56 SAST - Facebook - Message Received - edge-mqtt + chat-e2ee
```

### **After (Accurate)**
```
20:40 SAST - Facebook - Reels Scrolling - Video CDN + static assets (NetSeer)
20:56 SAST - Facebook - Reels Scrolling - Video CDN + static assets (NetSeer)
```

## Trust Issue Resolution

### **Problem Solved**
- ✅ **No more false messaging alerts** during innocent Reels viewing
- ✅ **Clear "Reels Scrolling" classification** 
- ✅ **Conservative approach** prevents relationship conflicts
- ✅ **Still detects real messaging** when Reels aren't active

### **Masking Detection (Advanced)**
- ⚠️ **Flags suspicious patterns** when strong messaging evidence appears between Reels gaps
- ⚠️ **"Potential Reels Masking" warnings** for deliberate hiding attempts
- ⚠️ **Evidence-based approach** prevents false accusations

## Implementation Priority

### **Phase 1: Conservative Detection (CRITICAL)**
1. ✅ NetSeer CDN = Reels Scrolling (override messaging)
2. ✅ TikTok domains = Video content consumption
3. ✅ Background messaging domains ignored during video consumption

### **Phase 2: Masking Detection (ADVANCED)**
1. 🔄 Detect Reels gaps with strong messaging evidence
2. 🔄 Flag "sandwich" patterns (Reels → Message → Reels)
3. 🔄 Provide detailed evidence for suspicious timing

## Key Takeaway

**Conservative Approach**: When in doubt between Reels and messaging, classify as Reels to prevent relationship trust issues. Only flag as messaging when there's clear, strong evidence that can't be explained by background app activity.

This approach prioritizes **relationship harmony** while still detecting genuine communication patterns when they occur outside of video consumption periods.
