export interface DNSLogEntry {
  timestamp: string
  domain: string
  query_type: string
  dnssec: string
  protocol: string
  client_ip: string
  status: string
  reasons: string
  destination_country: string
  root_domain: string
  device_id: string
  device_name: string
  device_model: string
  device_local_ip: string
  matched_name: string
  client_name: string
}

export interface ProcessedLogEntry extends DNSLogEntry {
  parsedTimestamp: Date
  category: string
  isBlocked: boolean
  timeWindow: string
}

export interface TimeWindowStats {
  timeWindow: string
  totalRequests: number
  blockedRequests: number
  allowedRequests: number
  uniqueDomains: number
  categories: Record<string, number>
  devices: Record<string, number>
  isRealChat: boolean
  chatScore: number
  isPossibleVPN: boolean
  vpnScore: number
  isActingSecret: boolean
  secretScore: number
  // Enhanced WhatsApp activity detection
  whatsappActivity: {
    isTextMessage: boolean
    isMediaTransfer: boolean
    isVoiceCall: boolean
    isVideoCall: boolean
    activityScore: number
    callDirection: string // 'incoming', 'outgoing', or ''
  }
  // Enhanced Facebook/Messenger activity detection
  facebookActivity: {
    isMessaging: boolean
    isMediaTransfer: boolean
    isBackgroundRefresh: boolean
    isInstagramActivity: boolean
    isReelsScrolling: boolean // NEW: Specific Reels detection
    activityScore: number
    isCall: boolean
  }
  // Relationship concern detection
  relationshipConcerns: {
    datingApps: string[]
    alternativeMessaging: string[]
    videoCalling: string[]
    socialMessaging: string[]
    anonymousPlatforms: string[]
    concernScore: number
  }
  // Reels masking detection (hiding messaging with Reels scrolling)
  isReelsMasking: boolean
  maskingEvidence: string
}

export interface FilterOptions {
  dateRange: {
    start: Date | null
    end: Date | null
  }
  timeRange: {
    start: string
    end: string
  }
  devices: string[]
  categories: string[]
  status: string[]
  protocols: string[]
  countries: string[]
  behaviorPatterns?: string[]
  whatsappActivity?: string[]
  facebookActivity?: string[]
}

export const DOMAIN_CATEGORIES = {
  'WhatsApp Domain Access': [
    'whatsapp.com',
    'whatsapp.net',
    'wa.me',
    'web.whatsapp.com',
    'chat.whatsapp.com'
  ],
  'Facebook Domain Access': [
    'facebook.com',
    'messenger.com',
    'fb.com',
    'fbcdn.net',
    'facebook.net'
  ],
  'Other Messaging': [
    'telegram.org',
    'discord.com',
    'discordapp.com',
    'signal.org',
    'slack.com',
    'teams.microsoft.com',
    'zoom.us'
  ],
  'Social Media': [
    'twitter.com',
    'instagram.com',
    'linkedin.com',
    'tiktok.com',
    'snapchat.com',
    'reddit.com',
    'pinterest.com'
  ],
  'Streaming & Entertainment': [
    'youtube.com',
    'netflix.com',
    'spotify.com',
    'soundcloud.com',
    'twitch.tv',
    'hulu.com',
    'disney.com',
    'primevideo.com'
  ],
  'Google Services': [
    'google.com',
    'googleapis.com',
    'googleusercontent.com',
    'gstatic.com',
    'gmail.com',
    'google-analytics.com'
  ],
  'Cloud & CDN': [
    'cloudfront.net',
    'amazonaws.com',
    'cloudflare.com',
    'fastly.com',
    'akamai.net',
    'azure.com'
  ],
  'Advertising & Analytics': [
    'doubleclick.net',
    'googleadservices.com',
    'googlesyndication.com',
    'adsystem.com',
    'facebook.com/tr',
    'analytics.google.com',
    'quantserve.com',
    'scorecardresearch.com'
  ],
  'Security & Monitoring': [
    'sentry.io',
    'bugsnag.com',
    'newrelic.com',
    'datadog.com'
  ],
  'Other': []
} as const

export type CategoryName = keyof typeof DOMAIN_CATEGORIES

// Enhanced WhatsApp activity detection patterns - Based on sophisticated algorithm
export const WHATSAPP_ACTIVITY_INDICATORS = {
  // Core signalling & messaging (primary indicators)
  signalling: [
    'g.whatsapp.net',              // Main gateway - messages, call setup, presence
    'graph.whatsapp.com',          // WhatsApp Graph API
    'dit.whatsapp.net'             // Data interchange - appears in text conversations and calls
  ],
  
  // Media upload (sent messages)
  mediaUpload: [
    'mmg.whatsapp.net'             // Multimedia messaging gateway - media SENT
  ],
  
  // Media download (received messages)
  mediaDownload: [
    'media-', '.cdn.whatsapp.net', // Media CDN - media RECEIVED
    'mmx-ds.cdn.whatsapp.net'      // Media CDN alternative
  ],
  
  // Voice/video calls (STUN/relay indicators)
  calls: [
    'dit.whatsapp.net',            // Data interchange for calls
    'dyn.whatsapp.net',            // Dynamic relay nodes
    'relay.whatsapp.net'           // Voice/video relay servers
  ],
  
  // Core domains
  core: ['whatsapp.net', 'whatsapp.com'],
  
  // Apple Push Notifications for iOS incoming calls
  apns: ['courier', 'push.apple.com'],
  
  // Background/maintenance
  background: [
    'static.whatsapp.net',         // Static resources
    'edge-mqtt.whatsapp.net',      // Push notifications
    'edge-mqtt.facebook.com'       // Alternative push channel
  ]
}

// Enhanced Facebook/Messenger activity detection patterns - Based on sophisticated algorithm
export const FACEBOOK_ACTIVITY_INDICATORS = {
  // Call indicators (STUN + Messenger markers)
  calls: [
    'external.xx.fbcdn.net'        // STUN for Facebook/Messenger calls
  ],
  
  // Text message sending
  textSend: [
    'pm.facebook.com',             // Send UI for messages
    'web.facebook.com'             // Web interface send
  ],
  
  // Real-time messaging (text received)
  messaging: [
    'edge-mqtt.facebook.com',      // MQTT for real-time messages
    'gateway.facebook.com',        // Gateway for active sessions
    'chat-e2ee.facebook.com'       // End-to-end encrypted messaging
  ],
  
  // Media upload (sent)
  mediaUpload: [
    'rupload.facebook.com'         // Media upload endpoint
  ],
  
  // Media download (received)
  mediaDownload: [
    'scontent.', '.fbcdn.net',     // Media content downloads
    '.fbsbx.com'                   // Facebook CDN for media
  ],
  
  // Backend API and GraphQL calls
  api: [
    'star.c10r.facebook.com',      // Backend chat and GraphQL calls
    'star.fallback.c10r.facebook.com', // Fallback backend servers
    'graph.facebook.com',          // API calls, message fetches
    'graph.instagram.com'          // Instagram messaging API
  ],
  
  // Core domains
  core: ['facebook.com', 'messenger.com', 'instagram.com'],
  
  // Background/telemetry (helps distinguish from real activity)
  background: [
    'www.facebook.com',            // General web access
    'static.xx.fbcdn.net',         // Static resources
    'connect.facebook.net'         // Analytics/tracking
  ],
  
  // Reels/Video content indicators (creates false messaging positives)
  reelsVideo: [
    'static-', '.xx.fbcdn.net',    // Video static assets (specific pattern)
    'external-', '.xx.fbcdn.net',  // External video content
    '-netseer-ipaddr-assoc.',      // CDN optimization for video streaming (KEY INDICATOR)
    'oculuscdn.com',               // Oculus/Meta video content
    'securecdn.oculus.com',        // Secure video delivery
    'cdninstagram.com'             // Instagram video content
  ]
}

// Chat detection patterns - domains that indicate real messaging activity
export const REAL_CHAT_INDICATORS = {
  whatsapp: {
    // Core WhatsApp domains - any of these indicate WhatsApp usage
    core: ['whatsapp.net', 'whatsapp.com'],
    // Messaging-specific domains that strongly suggest active chatting
    messaging: [
      'g.whatsapp.net',           // Gateway - main messaging endpoint
      'mmg.whatsapp.net',         // Multimedia messaging gateway
      'media-', '.cdn.whatsapp.net', // Media/CDN endpoints for sharing
      'dit.whatsapp.net',         // Data interchange
      'static.whatsapp.net'       // Static resources during active use
    ],
    // API domains for active functionality
    api: ['graph.whatsapp.com']
  },
  facebook: {
    // Core Facebook domains
    core: ['facebook.com', 'instagram.com'],
    // Messaging-specific domains
    messaging: [
      'graph.facebook.com',        // Graph API - active interactions
      'edge-mqtt.facebook.com',    // Real-time messaging protocol
      'gateway.facebook.com',      // Gateway for active sessions
      'ep2.facebook.com',          // Endpoint for messaging
      'star.fallback.c10r.facebook.com', // Fallback messaging servers
      'gateway.instagram.com',     // Instagram messaging
      'graph.instagram.com'        // Instagram API interactions
    ],
    // Real-time/AI domains that suggest active use
    realtime: [
      'meta-ai-realtime.facebook.com',
      'wearable-ai-realtime.facebook.com'
    ]
  }
} as const

// Relationship concern indicators - dating apps, alternative messaging, video calls
export const RELATIONSHIP_CONCERN_INDICATORS = {
  // Dating and hookup apps
  datingApps: [
    'tinder.com', 'bumble.com', 'hinge.co', 'match.com', 'eharmony.com',
    'okcupid.com', 'pof.com', 'zoosk.com', 'badoo.com', 'happn.com',
    'grindr.com', 'scruff.com', 'jackd.com', 'hornet.com',
    'adultfriendfinder.com', 'ashley-madison.com', 'seeking.com',
    'raya.co', 'coffeemeetsbagel.com', 'theinner-circle.com',
    'elitesingles.com', 'silversingles.com', 'ourtime.com',
    'christianmingle.com', 'jdate.com', 'blackpeoplemeet.com',
    'loveandseek.com', 'farmersonly.com', 'militarycupid.com'
  ],
  
  // Alternative messaging platforms (potential secret communication)
  alternativeMessaging: [
    'telegram.org', 'signal.org', 'discord.com', 'slack.com',
    'snapchat.com', 'kik.com', 'viber.com', 'line.me',
    'wechat.com', 'qq.com', 'kakaotalk.com', 'threema.ch',
    'wickr.com', 'element.io', 'session.im', 'briar.app',
    'jami.net', 'riot.im', 'matrix.org', 'keybase.io',
    'dust.com', 'confide.com', 'coverme.ws', 'silent-phone.com'
  ],
  
  // Video calling platforms (potential private conversations)
  videoCalling: [
    'zoom.us', 'skype.com', 'teams.microsoft.com', 'meet.google.com',
    'webex.com', 'gotomeeting.com', 'bluejeans.com', 'jitsi.org',
    'whereby.com', 'appear.in', 'bigbluebutton.org', 'jami.net',
    'facetime.apple.com', 'duo.google.com', 'allo.google.com'
  ],
  
  // Social media with messaging capabilities
  socialMessaging: [
    'twitter.com', 'x.com', 'linkedin.com', 'reddit.com',
    'pinterest.com', 'tumblr.com', 'twitch.tv', 'onlyfans.com',
    'chaturbate.com', 'cam4.com', 'myfreecams.com', 'streamate.com',
    'flirt4free.com', 'camsoda.com', 'bongacams.com', 'stripchat.com'
  ],
  
  // Anonymous/secret communication platforms
  anonymousPlatforms: [
    'yolo.live', 'sarahah.com', 'tellonym.me', 'curiouscat.me',
    'ask.fm', 'lipsi.co', 'sendit.gg', 'ngl.link',
    'whisper.sh', 'anonymous.com', 'confession.co', 'secrets.co'
  ],
  
  // Exclude common false positives
  excludePatterns: [
    'chat.google.com', // Opened with Gmail/Google services
    'hangouts.google.com', // Legacy, often auto-triggered
    'mail.google.com', // Email service
    'accounts.google.com', // Authentication
    'apis.google.com', // API calls
    'fonts.google.com', // Web fonts
    'maps.google.com' // Maps service
  ]
} as const

// VPN and privacy detection patterns
export const VPN_INDICATORS = {
  // Direct VPN service domains
  vpnServices: [
    'nordvpn.com', 'expressvpn.com', 'surfshark.com', 'protonvpn.com',
    'cyberghost.com', 'ipvanish.com', 'purevpn.com', 'tunnelbear.com',
    'windscribe.com', 'hotspotshield.com', 'privatevpn.com', 'vyprvpn.com'
  ],
  // Tor and anonymity networks
  anonymityNetworks: [
    'torproject.org', 'onion', '.onion', 'tor.', 'i2p.', 'freenet.'
  ],
  // DNS-over-HTTPS providers (privacy-focused)
  privateDNS: [
    'cloudflare-dns.com', 'dns.google', 'quad9.net', 'opendns.com',
    '1.1.1.1', '8.8.8.8', '9.9.9.9', 'adguard-dns.io'
  ],
  // Proxy and tunnel services
  proxyServices: [
    'proxy.', 'tunnel.', 'socks.', 'shadowsocks', 'v2ray', 'trojan'
  ],
  // Browser privacy extensions/tools
  privacyTools: [
    'duckduckgo.com', 'startpage.com', 'searx.', 'brave.com',
    'ghostery.com', 'ublock.', 'adblock.', 'disconnect.me'
  ]
} as const

// Secret behavior detection patterns
export const SECRET_BEHAVIOR_INDICATORS = {
  // Temporary/disposable email services
  tempEmail: [
    '10minutemail.com', 'guerrillamail.com', 'temp-mail.org', 'mailinator.com',
    'throwaway.email', 'getnada.com', 'tempail.com', 'mohmal.com'
  ],
  // Encrypted messaging beyond WhatsApp/Facebook
  encryptedMessaging: [
    'signal.org', 'telegram.org', 'wickr.com', 'threema.ch',
    'wire.com', 'element.io', 'matrix.org', 'session.loki-project.org'
  ],
  // File sharing/storage with privacy focus
  anonymousStorage: [
    'mega.nz', 'anonfiles.com', 'file.io', 'transfer.sh',
    'wetransfer.com', 'send.firefox.com', 'onionshare.org'
  ],
  // Cryptocurrency and financial privacy
  cryptoPrivacy: [
    'monero.org', 'zcash.com', 'dash.org', 'coinmixer.', 'bitcoin-mixer.',
    'localbitcoins.com', 'bisq.network', 'wasabiwallet.io'
  ],
  // Social media with privacy focus
  altSocial: [
    'minds.com', 'gab.com', 'parler.com', 'mastodon.', 'diaspora.',
    'friendica.', 'peertube.', 'bitchute.com'
  ],
  // Search engines and browsers focused on privacy
  privateSearch: [
    'duckduckgo.com', 'startpage.com', 'searx.', 'yandex.com',
    'brave.com', 'tor.', 'tails.'
  ]
} as const
