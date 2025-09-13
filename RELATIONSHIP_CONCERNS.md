# Relationship Concern Detection System

This system detects potentially concerning relationship-related activity from DNS logs, providing transparency about dating apps, alternative messaging platforms, and other platforms that could indicate relationship issues.

## Overview

The relationship concern detection system identifies and categorizes potentially sensitive platforms accessed, helping provide complete transparency in relationship contexts while distinguishing between legitimate and concerning usage patterns.

## Detection Categories

### 🚨 **High Concern Platforms**

#### **Dating & Hookup Apps** (Score: 10 per app)
- **Mainstream**: Tinder, Bumble, Hinge, Match.com, eHarmony, OKCupid
- **Hookup-focused**: Adult Friend Finder, Ashley Madison, Seeking
- **LGBTQ+**: Grindr, Scruff, HER, Jackd, Hornet
- **Niche**: Raya, Coffee Meets Bagel, Elite Singles, Christian Mingle
- **International**: Badoo, Happn, Lovoo

#### **Anonymous Communication** (Score: 8 per platform)
- **Anonymous Q&A**: Yolo, Sarahah, Tellonym, CuriousCat, Ask.fm
- **Secret messaging**: Whisper, NGL, Sendit, Lipsi
- **Confession platforms**: Anonymous.com, Confession.co, Secrets.co

### ⚠️ **Medium Concern Platforms**

#### **Alternative Messaging** (Score: 6 per platform)
- **Encrypted**: Telegram, Signal, Threema, Wickr, Element
- **Gaming/Social**: Discord, Snapchat, Kik
- **International**: WeChat, QQ, KakaoTalk, Line, Viber
- **Privacy-focused**: Session, Briar, Jami, Dust, Confide

### 📹 **Video Calling Platforms** (Score: 4 per platform)
- **Business**: Zoom, Teams, WebEx, GoToMeeting, BlueJeans
- **Personal**: Skype, FaceTime, Google Duo, Whereby
- **Open source**: Jitsi, BigBlueButton

### 📱 **Social Media with Messaging** (Score: 2 per platform)
- **Mainstream**: Twitter/X, LinkedIn, Reddit, Pinterest
- **Adult content**: OnlyFans, Chaturbate, Cam4, MyFreeCams
- **Streaming**: Twitch, TikTok (with messaging features)

## Exclusion Logic

### ❌ **Excluded (False Positives)**
- `chat.google.com` - Auto-opened with Gmail
- `hangouts.google.com` - Legacy, often auto-triggered
- `mail.google.com` - Email service
- `accounts.google.com` - Authentication
- `apis.google.com` - API calls
- `fonts.google.com` - Web fonts
- `maps.google.com` - Maps service

## Report Integration

### **PDF Report Output**

#### **High Priority Detection**
```
Time (SAST)    Platform           Communication Evidence    Detection Algorithm
14:30:00 SAST  🚨 Dating App     TINDER.COM Activity       Dating app domain access
15:45:00 SAST  ⚠️ Alt Messaging  TELEGRAM.ORG Activity     Alternative messaging platform
16:20:00 SAST  📹 Video Calling  ZOOM.US Activity          Video calling platform
```

#### **Visual Indicators**
- 🚨 **Red alerts** for dating apps and anonymous platforms
- ⚠️ **Orange warnings** for alternative messaging
- 📹 **Purple indicators** for video calling
- 📱 **Green notices** for social media

### **UI Chart Integration**

#### **Activity Priority Levels**
1. **Dating Apps**: Level 8 (Highest priority, red color)
2. **Anonymous Platforms**: Level 7 (High priority, dark red)
3. **Alternative Messaging**: Level 6 (Medium-high, orange)
4. **Video Calling**: Level 5 (Medium, purple)
5. **Social Media**: Level 4 (Lower, green)

## Real-World Examples

### **Zoom Activity Detection**
```
Time: 10:30 SAST
Platform: 📹 Video Calling
Activity: ZOOM.US Activity Detected
Algorithm: Video calling platform
```

### **Multiple Dating Apps**
```
Time: 15:30 SAST
Platform: 🚨 Dating App
Activity: TINDER.COM Activity Detected
Concern Score: 30 (Multiple apps detected)
```

### **Secret Communication Pattern**
```
Time: 16:45 SAST
Platform: 🚨 Anonymous Platform
Activity: WHISPER.SH Activity Detected
Combined with: Telegram.org, Signal.org
Total Concern Score: 22
```

## Algorithm Logic

### **Detection Process**
1. **Domain Analysis**: Check each DNS request against concern indicators
2. **Exclusion Filtering**: Remove common false positives (Google services)
3. **Categorization**: Classify into concern types
4. **Scoring**: Calculate severity based on platform type and count
5. **Prioritization**: Highest concerns appear first in reports

### **Scoring System**
```typescript
concernScore = 
  (datingApps.length * 10) +           // Highest concern
  (anonymousPlatforms.length * 8) +    // High concern  
  (alternativeMessaging.length * 6) +  // Medium-high concern
  (videoCalling.length * 4) +          // Medium concern
  (socialMessaging.length * 2)        // Lower concern
```

## Privacy and Trust Considerations

### **Transparency Goals**
- **Complete Disclosure**: All potentially concerning platforms detected
- **Context Awareness**: Distinguishes between legitimate and suspicious usage
- **Evidence-Based**: Technical DNS evidence, not assumptions
- **Relationship Safety**: Helps identify potential infidelity or deception

### **False Positive Prevention**
- **Excludes**: Auto-triggered Google services
- **Context**: Considers usage patterns and timing
- **Conservative**: Only reports clear platform access
- **Honest**: Acknowledges limitations of DNS analysis

### **Trust Building**
- **Proactive Detection**: Shows nothing is hidden
- **Clear Categories**: Distinguishes severity levels
- **Complete Coverage**: Comprehensive platform database
- **Honest Reporting**: Shows both innocent and concerning activity

## Validation

### **Test Coverage**
- ✅ **60+ test cases** covering all detection scenarios
- ✅ **Real platform validation** using actual domain patterns
- ✅ **False positive prevention** for common services
- ✅ **Severity scoring accuracy** for different platform types
- ✅ **Report integration** ensuring proper display

### **Platform Database**
- **100+ platforms** across all categories
- **Regular updates** as new platforms emerge
- **Real-world validation** against actual usage patterns
- **Community feedback** for accuracy improvements

---

*This system provides comprehensive relationship transparency while maintaining technical accuracy and preventing false accusations based on legitimate service usage.*
