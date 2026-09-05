import logo from '@resource/img/logo.svg'
import { Link } from 'react-router'

import config from '@/config/config'

interface AuthCardProps {
  children: React.ReactNode
  leftDescription?: string
  leftTitle?: string
}

function AuthIllustration() {
  return (
    <svg fill="none" viewBox="0 0 320 280" xmlns="http://www.w3.org/2000/svg">
      {/* Background circle */}
      <circle cx="160" cy="140" fill="#c8e6c9" opacity="0.5" r="110" />

      {/* Desk */}
      <rect fill="#a5d6a7" height="8" rx="4" width="160" x="80" y="190" />
      <rect fill="#81c784" height="40" rx="4" width="8" x="108" y="198" />
      <rect fill="#81c784" height="40" rx="4" width="8" x="204" y="198" />

      {/* Monitor */}
      <rect fill="#fff" height="70" rx="6" width="90" x="115" y="112" />
      <rect fill="#e8f5e9" height="58" rx="4" width="78" x="121" y="118" />
      <rect fill="#a5d6a7" height="6" rx="3" width="40" x="140" y="182" />
      <rect fill="#a5d6a7" height="3" rx="1.5" width="60" x="130" y="188" />

      {/* Code lines on monitor */}
      <rect fill="#66bb6a" height="4" rx="2" width="40" x="128" y="128" />
      <rect fill="#81c784" height="4" rx="2" width="30" x="128" y="138" />
      <rect fill="#66bb6a" height="4" rx="2" width="50" x="128" y="148" />
      <rect fill="#81c784" height="4" rx="2" width="35" x="128" y="158" />

      {/* Person */}
      {/* Head */}
      <circle cx="100" cy="120" fill="#ffcc80" r="18" />
      {/* Hair */}
      <path d="M82 115 Q90 98 100 96 Q110 98 118 115" fill="#5d4037" />
      {/* Body */}
      <rect fill="#42a5f5" height="35" rx="8" width="38" x="81" y="136" />
      {/* Left arm pointing at screen */}
      <path d="M81 148 Q60 145 52 148" stroke="#ffcc80" strokeLinecap="round" strokeWidth="8" />
      {/* Right arm */}
      <path d="M119 148 Q130 145 138 150" stroke="#ffcc80" strokeLinecap="round" strokeWidth="8" />
      {/* Legs */}
      <rect fill="#1565c0" height="30" rx="5" width="16" x="84" y="171" />
      <rect fill="#1565c0" height="30" rx="5" width="16" x="104" y="171" />
      {/* Shoes */}
      <rect fill="#37474f" height="8" rx="4" width="20" x="82" y="198" />
      <rect fill="#37474f" height="8" rx="4" width="20" x="102" y="198" />

      {/* Floating elements */}
      {/* Chat bubble 1 */}
      <rect fill="#fff" height="28" rx="8" width="60" x="195" y="85" />
      <path d="M210 113 L205 122 L218 113Z" fill="#fff" />
      <rect fill="#a5d6a7" height="4" rx="2" width="40" x="205" y="93" />
      <rect fill="#c8e6c9" height="4" rx="2" width="30" x="205" y="101" />

      {/* Chat bubble 2 */}
      <rect fill="#fff" height="24" rx="6" width="50" x="55" y="82" />
      <path d="M70 106 L65 115 L78 106Z" fill="#fff" />
      <rect fill="#a5d6a7" height="4" rx="2" width="32" x="63" y="90" />
      <rect fill="#c8e6c9" height="4" rx="2" width="22" x="63" y="98" />

      {/* Star sparkles */}
      <path d="M248 60 L250 54 L252 60 L258 62 L252 64 L250 70 L248 64 L242 62Z" fill="#ffb300" />
      <path d="M72 68 L73.5 64 L75 68 L79 69.5 L75 71 L73.5 75 L72 71 L68 69.5Z" fill="#66bb6a" />
      <path
        d="M230 165 L231 162 L232 165 L235 166 L232 167 L231 170 L230 167 L227 166Z"
        fill="#42a5f5"
      />

      {/* Plant */}
      <rect fill="#795548" height="20" rx="3" width="14" x="272" y="215" />
      <ellipse cx="279" cy="210" fill="#4caf50" rx="16" ry="20" />
      <ellipse cx="269" cy="218" fill="#66bb6a" rx="10" ry="12" />
      <ellipse cx="289" cy="218" fill="#66bb6a" rx="10" ry="12" />
    </svg>
  )
}

export default function AuthCard({ children, leftDescription, leftTitle }: AuthCardProps) {
  const siteName = config.COMMUNITY_TITLE || config.PRODUCT_NAME
  const logoSource = config.LOGO_LIGHT || logo
  const { banner, description, title } = config.LOGIN_PAGE_CUSTOMIZATION
  const displayTitle = leftTitle || title || siteName
  const displayDesc =
    leftDescription || description || `Welcome to ${siteName}. Connect, collaborate and grow together.`

  return (
    <div className="bc-min-h-screen bc-flex bc-bg-surface">
      <div className="bc-w-full bc-flex bc-flex-col md:bc-flex-row">
        {/* Left decorative panel */}
        <div className="bc-hidden md:bc-flex bc-flex-col bc-items-center bc-justify-between bc-bg-primary/10 bc-p-10 md:bc-w-2/5 bc-text-center bc-min-h-screen">
          <div className="bc-flex-1 bc-flex bc-flex-col bc-items-center bc-justify-center bc-gap-4">
            <div className="bc-w-full bc-max-w-xs">
              {banner ? (
                <img
                  alt={displayTitle}
                  className="bc-w-full bc-h-auto bc-object-contain bc-rounded-lg"
                  src={banner}
                />
              ) : (
                <AuthIllustration />
              )}
            </div>
            <h2 className="bc-text-xl bc-font-bold bc-text-ink bc-mt-2 bc-mb-0">{displayTitle}</h2>
            <p className="bc-text-sm bc-text-ink-muted bc-leading-relaxed bc-mb-0">{displayDesc}</p>
          </div>
          {/* Decorative dots */}
          <div className="bc-flex bc-gap-2 bc-mt-6">
            <span className="bc-w-2 bc-h-2 bc-rounded-full bc-bg-line-strong bc-inline-block" />
            <span className="bc-w-6 bc-h-2 bc-rounded-full bc-bg-primary bc-inline-block" />
            <span className="bc-w-2 bc-h-2 bc-rounded-full bc-bg-line-strong bc-inline-block" />
            <span className="bc-w-2 bc-h-2 bc-rounded-full bc-bg-line-strong bc-inline-block" />
          </div>
        </div>

        {/* Right form panel */}
        <div className="bc-flex bc-flex-col bc-items-center bc-justify-center bc-p-8 sm:bc-p-12 md:bc-w-3/5 bc-w-full bc-min-h-screen">
          <div className="bc-w-full bc-max-w-sm">
            {/* Logo */}
            <div className="bc-flex bc-flex-col bc-items-center bc-mb-8">
              {config.LOGO_PERMALINK_MODE === 'custom' && config.LOGO_PERMALINK_CUSTOM ? (
                <a
                  className="bc-flex bc-items-center bc-gap-2 bc-no-underline"
                  href={config.LOGO_PERMALINK_CUSTOM}
                >
                  <img
                    alt={`${siteName} logo`}
                    className="bc-w-8 bc-h-8 bc-object-contain"
                    src={logoSource}
                  />
                  <span className="bc-font-bold bc-text-xl bc-tracking-wide bc-text-ink">
                    {siteName}
                  </span>
                </a>
              ) : (
                <Link className="bc-flex bc-items-center bc-gap-2 bc-no-underline" to="/">
                  <img
                    alt={`${siteName} logo`}
                    className="bc-w-8 bc-h-8 bc-object-contain"
                    src={logoSource}
                  />
                  <span className="bc-font-bold bc-text-xl bc-tracking-wide bc-text-ink">
                    {siteName}
                  </span>
                </Link>
              )}
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
