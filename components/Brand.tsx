// ANOTHER ME 로고: 채워진 원(지금의 나)과 겹친 빈 원(또 하나의 나)
export default function Brand({ large = false }: { large?: boolean }) {
  return (
    <span className={`brand-mark${large ? ' large' : ''}`} role="img" aria-label="ANOTHER ME">
      <svg viewBox="0 0 38 29" aria-hidden="true">
        <defs>
          <linearGradient id="am-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9a88ff" />
            <stop offset="1" stopColor="#ff9cc4" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="14.5" r="10" fill="url(#am-logo)" />
        <circle cx="26" cy="14.5" r="9" fill="none" stroke="url(#am-logo)" strokeWidth="3" />
      </svg>
      <span aria-hidden="true">
        ANOTHER <em>ME</em>
      </span>
    </span>
  );
}
