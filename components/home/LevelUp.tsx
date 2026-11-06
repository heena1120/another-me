// 레벨업 연출: 배너 + 색종이. (캐릭터의 춤은 3D 쪽에서 `dance`로 처리합니다)
const COLORS = ['#ff5c8a', '#ffd35c', '#5aa0ff', '#7ed6a8', '#b79cff'];

export default function LevelUp({ level, rewards = [] }: { level: number; rewards?: string[] }) {
  return (
    <div className="levelup" role="status" aria-live="assertive">
      {Array.from({ length: 28 }, (_, i) => (
        <i
          key={i}
          className="confetti"
          style={{
            left: `${(i * 37) % 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${((i * 53) % 100) / 100}s`,
            animationDuration: `${1.8 + ((i * 29) % 10) / 10}s`,
          }}
        />
      ))}
      <div className="levelup-banner">
        <small>LEVEL UP!</small>
        <strong>Lv.{level}</strong>
        {rewards.length > 0 && <em>새로 열림: {rewards.join(' · ')}</em>}
      </div>
    </div>
  );
}
