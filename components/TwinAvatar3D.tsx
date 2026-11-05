'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BACKGROUNDS, BLUSHES, BODY_COLORS, OUTFIT_COLORS, type Avatar, type Mood } from '@/lib/avatar';

const INK = '#5a4545';

/** 두 색(#rrggbb)을 t(0~1)만큼 섞습니다. */
function mixHex(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}
const FACE = '#2f2424';
const OUTLINE = 1.05;

const SHAPE = {
  round: { a: 1.0, b: 0.92, c: 0.92, spread: 0.34 },
  egg: { a: 0.82, b: 1.1, c: 0.82, spread: 0.28 },
  chubby: { a: 1.14, b: 0.84, c: 0.96, spread: 0.42 },
} as const;

type Vec3 = [number, number, number];

// ───── 공용 지오메트리 ─────
const SPHERE = new THREE.SphereGeometry(1, 56, 40);
const CAPSULE = new THREE.CapsuleGeometry(1, 1, 12, 24);
const CONE = new THREE.ConeGeometry(1, 1, 40, 1);
// 끝이 살짝 둥근 귀 (고양이 귀용)
const ROUND_CONE = new THREE.LatheGeometry(
  Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    return new THREE.Vector2(Math.pow(Math.max(1 - Math.pow(t, 1.7), 0), 0.8), t - 0.5);
  }),
  40,
);
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

/** 타원체 표면 위의 한 점과, 그 점에서 바깥을 향하는 회전값 */
function surface(a: number, b: number, c: number, x: number, y: number, lift = 0) {
  const t = Math.max(1 - (x / a) ** 2 - (y / b) ** 2, 0.0004);
  const z = c * Math.sqrt(t);
  const n = new THREE.Vector3(x / (a * a), y / (b * b), z / (c * c)).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  const pos: Vec3 = [x + n.x * lift, y + n.y * lift, z + n.z * lift];
  return { pos, quat: q };
}

function Soft({ color, roughness = 0.55 }: { color: string; roughness?: number }) {
  // 말랑한 비닐 인형 같은 재질
  return <meshPhysicalMaterial color={color} roughness={roughness} clearcoat={0.25} clearcoatRoughness={0.5} />;
}

type PartProps = {
  geo: THREE.BufferGeometry;
  color: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3 | number;
  outline?: boolean;
  roughness?: number;
  children?: ReactNode;
};

/** 윤곽선(뒤집힌 껍질)이 붙은 부품 */
function Part({ geo, color, position, rotation, scale = 1, outline = true, roughness, children }: PartProps) {
  return (
    <mesh geometry={geo} position={position} rotation={rotation} scale={scale as number | Vec3}>
      <Soft color={color} roughness={roughness} />
      {outline && <mesh geometry={geo} scale={OUTLINE} material={OUTLINE_MAT} />}
      {children}
    </mesh>
  );
}

function Face({ a, b, c, x, y, children, lift = 0 }: { a: number; b: number; c: number; x: number; y: number; children: ReactNode; lift?: number }) {
  const s = useMemo(() => surface(a, b, c, x, y, lift), [a, b, c, x, y, lift]);
  return (
    <group position={s.pos} quaternion={s.quat}>
      {children}
    </group>
  );
}

function Tube({ points, radius = 0.016, color = FACE }: { points: [number, number][]; radius?: number; color?: string }) {
  const geo = useMemo(() => {
    const v = points.map(([x, y]) => new THREE.Vector3(x, y, 0));
    const curve = v.length === 3 ? new THREE.QuadraticBezierCurve3(v[0], v[1], v[2]) : new THREE.CatmullRomCurve3(v);
    return new THREE.TubeGeometry(curve, 24, radius, 10, false);
  }, [points, radius]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} roughness={0.4} />
    </mesh>
  );
}

function Star({ position, size, speed }: { position: Vec3; size: number; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime * speed;
    m.rotation.z = t;
    m.position.y = position[1] + Math.sin(t * 1.6) * 0.06;
    m.scale.setScalar(size * (0.85 + 0.25 * Math.sin(t * 3)));
  });
  return (
    <mesh ref={ref} position={position} scale={[size, size, size * 0.35]}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#ffd35c" emissive="#ffb800" emissiveIntensity={0.7} roughness={0.3} />
    </mesh>
  );
}

function Character({ avatar, mood, dance, vitality }: { avatar: Avatar; mood: Mood; dance: boolean; vitality: number }) {
  const v = Math.min(1, Math.max(0, vitality));
  const slump = (1 - v) * 0.26; // 생기가 낮을수록 앞으로 구부정
  const g = SHAPE[avatar.shape];
  const { a, b, c } = g;
  const body = mixHex(BODY_COLORS.find(x => x.id === avatar.body)?.value ?? '#ffffff', '#aaa3b0', (1 - v) * 0.7); // 생기가 낮으면 색이 바랩니다
  const outfitColor = OUTFIT_COLORS.find(x => x.id === avatar.outfitColor)?.value ?? '#ff8fa8';
  const blush = BLUSHES.find(x => x.id === avatar.blush)?.value ?? '';
  const earInner = '#ffc2d2';

  const eyesKind = mood === 'happy' ? 'happy' : mood === 'tired' ? 'sleepy' : avatar.eyes;
  const mouthKind = mood === 'happy' ? 'open' : mood === 'tired' ? 'flat' : avatar.mouth;

  const root = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const eyesRef = useRef<THREE.Group>(null);
  const earL = useRef<THREE.Group>(null);
  const earR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const hop = useRef(0);

  useFrame(({ clock, pointer }, dt) => {
    const t = clock.elapsedTime;
    const speed = (mood === 'tired' ? 1.2 : mood === 'happy' ? 3.2 : 2.2) * (0.6 + 0.6 * v);
    const amp = mood === 'tired' ? 0.012 : mood === 'happy' ? 0.04 : 0.025;
    if (root.current) {
      hop.current = Math.max(0, hop.current - dt * 2.2);
      const h = Math.sin(Math.PI * (1 - hop.current)) * (hop.current > 0 ? 0.42 : 0);
      if (dance) {
        // 레벨업 춤: 박자에 맞춰 통통 뛰고, 좌우로 흔들고, 가끔 한 바퀴 돕니다.
        const beat = t * 7;
        root.current.position.y = Math.abs(Math.sin(beat)) * 0.34;
        root.current.rotation.z = Math.sin(beat) * 0.2;
        const spin = (t % 2.4) / 2.4; // 2.4초마다 한 바퀴
        root.current.rotation.y = spin > 0.62 ? ((spin - 0.62) / 0.38) * Math.PI * 2 : Math.sin(beat * 0.5) * 0.5;
        root.current.rotation.x = Math.sin(beat * 2) * 0.05;
      } else {
        root.current.position.y = Math.sin(t * speed) * amp + h;
        root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, pointer.x * 0.5, 0.08);
        root.current.rotation.x = THREE.MathUtils.lerp(root.current.rotation.x, -pointer.y * 0.16 + slump, 0.08);
        root.current.rotation.z = Math.sin(t * speed * 0.5) * (mood === 'tired' ? 0.045 : 0.02);
      }
    }
    if (bodyRef.current) {
      const s = Math.sin(t * speed);
      const squash = hop.current > 0 ? 1 - Math.sin(Math.PI * (1 - hop.current)) * 0.08 : 1;
      bodyRef.current.scale.set(1 + s * 0.012, (1 - s * 0.012) * squash * (1 - slump * 0.15), 1 + s * 0.012);
    }
    if (eyesRef.current) {
      const phase = t % 3.8;
      const closing = phase > 3.62 ? 1 - Math.abs((phase - 3.71) / 0.09) : 0;
      eyesRef.current.scale.y = 1 - Math.max(0, closing) * 0.9;
    }
    const wig = dance ? Math.sin(t * 14) * 0.18 : Math.sin(t * 2.4) * 0.05;
    if (earL.current) earL.current.rotation.z = wig;
    if (earR.current) earR.current.rotation.z = -wig;
    // 팔: 평소엔 살짝 흔들, 춤출 때는 번쩍 들고 휘젓기
    const armAngle = dance ? 2.0 + Math.sin(t * 14) * 0.55 : 0.05 + Math.sin(t * speed + 1) * 0.04;
    if (armL.current) armL.current.rotation.z = -armAngle;
    if (armR.current) armR.current.rotation.z = armAngle;
    if (ring.current) {
      const p = 1 + Math.sin(t * (dance ? 9 : 2)) * (dance ? 0.1 : 0.03);
      ring.current.scale.set(p, p, 1);
    }
  });

  const ey = b * 0.0;
  const my = ey - b * 0.2;

  // ───── 눈 ─────
  const eye = (side: -1 | 1) => {
    const x = side * g.spread;
    let node: ReactNode;
    switch (eyesKind) {
      case 'sparkle':
        node = (
          <group scale={[1, 1.12, 0.55]}>
            <mesh geometry={SPHERE} scale={0.105}><meshStandardMaterial color={FACE} roughness={0.12} metalness={0.1} /></mesh>
            <mesh geometry={SPHERE} position={[-0.035, 0.04, 0.07]} scale={0.036}><meshBasicMaterial color="#fff" /></mesh>
            <mesh geometry={SPHERE} position={[0.03, -0.035, 0.08]} scale={0.018}><meshBasicMaterial color="#fff" /></mesh>
          </group>
        );
        break;
      case 'happy':
      case 'sleepy':
        node = (
          <mesh rotation={[0, 0, eyesKind === 'sleepy' ? Math.PI : 0]} position={[0, eyesKind === 'sleepy' ? 0.03 : -0.03, 0.004]}>
            <torusGeometry args={[0.085, 0.02, 12, 28, Math.PI]} />
            <meshStandardMaterial color={FACE} roughness={0.4} />
          </mesh>
        );
        break;
      default:
        node = (
          <group scale={[1, 1.12, 0.5]}>
            <mesh geometry={SPHERE} scale={0.078}><meshStandardMaterial color={FACE} roughness={0.12} metalness={0.1} /></mesh>
            <mesh geometry={SPHERE} position={[-0.026, 0.03, 0.05]} scale={0.024}><meshBasicMaterial color="#fff" /></mesh>
          </group>
        );
    }
    return (
      <Face key={side} a={a} b={b} c={c} x={x} y={ey}>
        {node}
      </Face>
    );
  };

  // ───── 입 ─────
  const mouth = (() => {
    const m = (child: ReactNode) => (
      <Face a={a} b={b} c={c} x={0} y={my}>
        {child}
      </Face>
    );
    switch (mouthKind) {
      case 'open':
        return m(
          <group>
            <mesh geometry={SPHERE} scale={[0.085, 0.075, 0.04]} position={[0, -0.02, 0.005]}>
              <meshStandardMaterial color="#6e2f3b" roughness={0.5} />
            </mesh>
            <mesh geometry={SPHERE} scale={[0.045, 0.028, 0.03]} position={[0, -0.055, 0.015]}>
              <meshStandardMaterial color="#ff8fa6" roughness={0.5} />
            </mesh>
          </group>,
        );
      case 'cat':
        return m(
          <group>
            <Tube points={[[-0.105, 0.0], [-0.055, -0.07], [0, 0.0]]} />
            <Tube points={[[0, 0.0], [0.055, -0.07], [0.105, 0.0]]} />
          </group>,
        );
      case 'o':
        return m(
          <mesh geometry={SPHERE} scale={[0.04, 0.05, 0.025]} position={[0, -0.03, 0.005]}>
            <meshStandardMaterial color="#6e2f3b" roughness={0.5} />
          </mesh>,
        );
      case 'flat':
        return m(<Tube points={[[-0.06, -0.02], [0, -0.02], [0.06, -0.02]]} />);
      default:
        return m(<Tube points={[[-0.085, 0.0], [0, -0.09], [0.085, 0.0]]} />);
    }
  })();

  // ───── 귀 ─────
  const ear = (side: -1 | 1, ref: React.RefObject<THREE.Group | null>) => {
    const s = side;
    switch (avatar.ears) {
      case 'pointy':
        return (
          <group key={s} ref={ref} position={[s * a * 0.52, b * 0.8, -0.02]}>
            <group rotation={[0, 0, -s * 0.42]}>
              <Part geo={ROUND_CONE} color={body} scale={[0.34, 0.7, 0.26]} position={[0, 0.22, 0]} />
              <mesh geometry={ROUND_CONE} scale={[0.2, 0.46, 0.12]} position={[0, 0.17, 0.115]}>
                <meshStandardMaterial color={earInner} roughness={0.7} />
              </mesh>
            </group>
          </group>
        );
      case 'long':
        return (
          <group key={s} ref={ref} position={[s * a * 0.4, b * 0.86, -0.03]}>
            <group rotation={[0, 0, -s * 0.2]}>
              <Part geo={CAPSULE} color={body} scale={[0.19, 0.3, 0.13]} position={[0, 0.42, 0]} />
              <mesh geometry={CAPSULE} scale={[0.1, 0.22, 0.05]} position={[0, 0.42, 0.125]}>
                <meshStandardMaterial color={earInner} roughness={0.7} />
              </mesh>
            </group>
          </group>
        );
      case 'tiny':
        return (
          <group key={s} ref={ref} position={[s * a * 0.74, b * 0.55, 0]}>
            <Part geo={SPHERE} color={body} scale={[0.15, 0.15, 0.12]} />
          </group>
        );
      default:
        return (
          <group key={s} ref={ref} position={[s * a * 0.62, b * 0.74, -0.04]}>
            <Part geo={SPHERE} color={body} scale={[0.27, 0.27, 0.17]} rotation={[0, 0, s * 0.25]}>
              <mesh geometry={SPHERE} scale={[0.6, 0.6, 0.3]} position={[0, 0, 0.8]}>
                <meshStandardMaterial color={earInner} roughness={0.7} />
              </mesh>
            </Part>
          </group>
        );
    }
  };

  // ───── 옷 ─────
  const shell = (thetaStart: number, thetaLength: number, color: string, k = 1.014) => (
    <mesh scale={[a * k, b * k, c * k]}>
      <sphereGeometry args={[1, 56, 40, 0, Math.PI * 2, thetaStart, thetaLength]} />
      <Soft color={color} roughness={0.7} />
    </mesh>
  );
  const outfit = (() => {
    switch (avatar.outfit) {
      case 'tee':
        return shell(Math.acos(-0.3), Math.PI - Math.acos(-0.3), outfitColor);
      case 'stripes': {
        const t0 = Math.acos(-0.3);
        const end = Math.PI;
        const bands: ReactNode[] = [];
        for (let i = 0; t0 + i * 0.36 < end; i++) {
          const s = t0 + i * 0.36;
          bands.push(<group key={i}>{shell(s, Math.min(0.18, end - s), outfitColor, 1.02)}</group>);
        }
        return (
          <group>
            {shell(t0, end - t0, '#ffffff', 1.014)}
            {bands}
          </group>
        );
      }
      case 'overalls': {
        const t0 = Math.acos(-0.42);
        const strap = (s: -1 | 1) => {
          const f = surface(a, b, c, s * a * 0.27, -b * 0.3, 0.012);
          return (
            <group key={s} position={f.pos} quaternion={f.quat}>
              <mesh>
                <boxGeometry args={[0.1, 0.34, 0.03]} />
                <Soft color={outfitColor} roughness={0.7} />
              </mesh>
              <mesh geometry={SPHERE} position={[0, -0.13, 0.02]} scale={0.026}>
                <meshStandardMaterial color="#fff" roughness={0.3} />
              </mesh>
            </group>
          );
        };
        return (
          <group>
            {shell(t0, Math.PI - t0, outfitColor)}
            {strap(-1)}
            {strap(1)}
          </group>
        );
      }
      default:
        return null;
    }
  })();

  // ───── 액세서리 ─────
  const accessory = (() => {
    switch (avatar.accessory) {
      case 'ribbon': {
        const f = surface(a, b, c, a * 0.5, b * 0.74, 0.02);
        return (
          <group position={f.pos} quaternion={f.quat} rotation={[0, 0, 0]}>
            <group rotation={[0, 0, -0.35]}>
              <Part geo={CONE} color="#ff7aa0" scale={[0.2, 0.25, 0.09]} position={[-0.17, 0, 0]} rotation={[0, 0, -Math.PI / 2]} />
              <Part geo={CONE} color="#ff7aa0" scale={[0.2, 0.25, 0.09]} position={[0.17, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
              <Part geo={SPHERE} color="#ff4f82" scale={[0.09, 0.09, 0.07]} />
            </group>
          </group>
        );
      }
      case 'flower': {
        const f = surface(a, b, c, -a * 0.5, b * 0.74, 0.02);
        return (
          <group position={f.pos} quaternion={f.quat}>
            {[0, 1, 2, 3, 4].map(i => {
              const ang = (i / 5) * Math.PI * 2;
              return <Part key={i} geo={SPHERE} color="#ffb3c8" scale={[0.085, 0.085, 0.05]} position={[Math.cos(ang) * 0.1, Math.sin(ang) * 0.1, 0]} outline />;
            })}
            <Part geo={SPHERE} color="#ffe27a" scale={[0.07, 0.07, 0.06]} position={[0, 0, 0.02]} />
          </group>
        );
      }
      case 'crown':
        return (
          <group position={[0, b * 0.97, 0.02]} rotation={[0.12, 0, 0]}>
            <mesh position={[0, 0.04, 0]}>
              <cylinderGeometry args={[0.28, 0.3, 0.14, 40, 1, true]} />
              <meshStandardMaterial color="#ffd35c" roughness={0.3} metalness={0.35} side={THREE.DoubleSide} />
            </mesh>
            {[0, 1, 2, 3, 4].map(i => {
              const ang = (i / 5) * Math.PI * 2;
              return (
                <mesh key={i} geometry={CONE} position={[Math.cos(ang) * 0.27, 0.18, Math.sin(ang) * 0.27]} scale={[0.085, 0.2, 0.085]}>
                  <meshStandardMaterial color="#ffd35c" roughness={0.3} metalness={0.35} />
                </mesh>
              );
            })}
            <mesh geometry={SPHERE} position={[0, 0.04, 0.3]} scale={0.04}>
              <meshStandardMaterial color="#ff7aa0" roughness={0.2} />
            </mesh>
          </group>
        );
      case 'glasses':
        return (
          <group>
            {[-1, 1].map(s => (
              <Face key={s} a={a} b={b} c={c} x={s * g.spread} y={ey} lift={0.06}>
                <mesh>
                  <torusGeometry args={[0.145, 0.017, 12, 40]} />
                  <meshStandardMaterial color={INK} roughness={0.35} />
                </mesh>
                <mesh position={[0, 0, -0.005]}>
                  <circleGeometry args={[0.14, 32]} />
                  <meshPhysicalMaterial color="#ffffff" transparent opacity={0.16} roughness={0.05} />
                </mesh>
              </Face>
            ))}
            <Face a={a} b={b} c={c} x={0} y={ey} lift={0.06}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.014, 0.014, g.spread * 2 - 0.29, 10]} />
                <meshStandardMaterial color={INK} roughness={0.35} />
              </mesh>
            </Face>
          </group>
        );
      case 'scarf': {
        const y = -b * 0.52;
        const k = Math.sqrt(1 - (y / b) ** 2);
        const f = surface(a, b, c, a * 0.3, -b * 0.72, 0.03);
        return (
          <group>
            <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[a * k * 1.02, c * k * 1.02, 1]}>
              <torusGeometry args={[1, 0.14, 16, 56]} />
              <Soft color={outfitColor} roughness={0.75} />
            </mesh>
            <group position={f.pos} quaternion={f.quat}>
              <mesh>
                <boxGeometry args={[0.17, 0.42, 0.07]} />
                <Soft color={outfitColor} roughness={0.75} />
              </mesh>
            </group>
          </group>
        );
      }
      default:
        return null;
    }
  })();

  const bl = blush ? 0.28 : 0;

  return (
    <>
    <group
      ref={root}
      onPointerDown={e => {
        e.stopPropagation();
        hop.current = 1;
      }}
    >
      <group ref={bodyRef} position={[0, 0.08, 0]}>
        {/* 팔 · 발 */}
        {([-1, 1] as const).map(s => (
          <group key={s}>
            <group ref={s < 0 ? armL : armR} position={[s * a * 0.95, 0.1, 0.08]}>
              <Part geo={SPHERE} color={body} scale={[0.17, 0.27, 0.17]} position={[s * 0.05, -0.17, 0]} rotation={[0, 0, s * -0.3]} />
            </group>
            <Part geo={SPHERE} color={body} scale={[0.3, 0.19, 0.36]} position={[s * a * 0.38, -b + 0.1, 0.14]} />
          </group>
        ))}

        {/* 귀 */}
        {ear(-1, earL)}
        {ear(1, earR)}

        {/* 몸 */}
        <Part geo={SPHERE} color={body} scale={[a, b, c]} roughness={0.5} />
        {outfit}

        {/* 얼굴 */}
        {blush && (
          <>
            {([-1, 1] as const).map(s => (
              <Face key={s} a={a} b={b} c={c} x={s * (g.spread + 0.2)} y={ey - b * 0.12} lift={0.006}>
                <mesh scale={[1, 0.62, 1]}>
                  <circleGeometry args={[0.105, 32]} />
                  <meshBasicMaterial color={blush} transparent opacity={0.75} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
                </mesh>
              </Face>
            ))}
          </>
        )}
        {mood === 'tired' &&
          ([-1, 1] as const).map(s => (
            <Face key={`dc${s}`} a={a} b={b} c={c} x={s * g.spread} y={ey - 0.1} lift={0.004}>
              <mesh rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.07, 0.008, 8, 20, Math.PI]} />
                <meshBasicMaterial color="#b497b0" transparent opacity={0.7} />
              </mesh>
            </Face>
          ))}
        <group ref={eyesRef}>
          {eyesKind === 'wink' && mood === 'normal' ? (
            <>
              <Face a={a} b={b} c={c} x={-g.spread} y={ey}>
                <group scale={[1, 1.12, 0.5]}>
                  <mesh geometry={SPHERE} scale={0.078}><meshStandardMaterial color={FACE} roughness={0.12} /></mesh>
                  <mesh geometry={SPHERE} position={[-0.026, 0.03, 0.05]} scale={0.024}><meshBasicMaterial color="#fff" /></mesh>
                </group>
              </Face>
              <Face a={a} b={b} c={c} x={g.spread} y={ey}>
                <mesh position={[0, -0.03, 0.004]}>
                  <torusGeometry args={[0.085, 0.02, 12, 28, Math.PI]} />
                  <meshStandardMaterial color={FACE} roughness={0.4} />
                </mesh>
              </Face>
            </>
          ) : (
            <>
              {eye(-1)}
              {eye(1)}
            </>
          )}
        </group>
        {mouth}

        {accessory}
      </group>

      {mood === 'happy' && (
        <group>
          <Star position={[a * 0.95, b * 0.95, 0.3]} size={0.11} speed={1.4} />
          <Star position={[-a * 1.0, b * 0.5, 0.3]} size={0.075} speed={1.9} />
          <Star position={[a * 0.35, b * 1.45, 0.2]} size={0.065} speed={1.6} />
        </group>
      )}
      {mood === 'tired' && (
        <group position={[a * 0.78, b * 0.62, c * 0.5]}>
          <mesh geometry={SPHERE} scale={0.075}>
            <meshPhysicalMaterial color="#8ec8ff" transparent opacity={0.85} roughness={0.1} clearcoat={1} />
          </mesh>
          <mesh geometry={CONE} position={[0, 0.095, 0]} scale={[0.07, 0.14, 0.07]}>
            <meshPhysicalMaterial color="#8ec8ff" transparent opacity={0.85} roughness={0.1} clearcoat={1} />
          </mesh>
        </group>
      )}
    </group>
    {/* 바닥: 그림자와 발판 링 (캐릭터가 뛰어도 제자리) */}
    <mesh position={[0, -b + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[a * 0.95, c * 0.8, 1]}>
      <circleGeometry args={[1, 40]} />
      <meshBasicMaterial color="#3b2f2f" transparent opacity={0.12 + bl * 0} depthWrite={false} />
    </mesh>
    <mesh ref={ring} position={[0, -b + 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, 1]}>
      <ringGeometry args={[a * 1.2, a * 1.3, 64]} />
      <meshBasicMaterial color={dance || v > 0.85 ? '#ffd35c' : v < 0.3 ? '#aab0c4' : '#ffffff'} transparent opacity={dance || v > 0.85 ? 0.95 : 0.7} depthWrite={false} />
    </mesh>
    </>
  );
}

/** 첫 프레임이 실제로 그려지면 알려 줍니다. */
function FirstFrame({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 1) onReady();
  });
  return null;
}

type Props = { avatar: Avatar; mood?: Mood; className?: string; height?: number | 'fill'; dance?: boolean; /** 캐릭터를 위아래로 옮깁니다(음수면 아래로). HUD가 위를 가릴 때 사용 */ lift?: number; /** 카메라 거리. 클수록 캐릭터가 작게 보입니다(기본 7.7) */ distance?: number; /** 0~1. 낮으면 색이 바래고 구부정, 높으면 선명하고 반짝임 */ vitality?: number };

export default function TwinAvatar3D({ avatar, mood = 'normal', className, height = 340, dance = false, vitality = 1, lift = 0, distance = 7.7 }: Props) {
  const [ready, setReady] = useState(false); // 첫 프레임이 그려지기 전에는 배경을 비워 둬서 2D 캐릭터가 보이게 합니다
  const bg = mixHex(BACKGROUNDS.find(x => x.id === avatar.bg)?.value ?? '#e8f3ff', '#c3bdd0', (1 - Math.min(1, Math.max(0, vitality))) * 0.75); // 생기가 낮으면 배경이 황혼빛으로
  return (
    <div
      className={className}
      role="img"
      aria-label={`${avatar.name || '내 쌍둥이'} 3D 캐릭터`}
      style={{ width: '100%', height: height === 'fill' ? '100%' : height, background: ready ? `radial-gradient(circle at 50% 38%, #ffffffcc, ${bg} 70%), ${bg}` : 'transparent', borderRadius: 28, overflow: 'hidden', touchAction: 'pan-y' }}
    >
      <Canvas flat dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [0, 0.3, distance], fov: 30 }}>
        <FirstFrame onReady={() => setReady(true)} />
        <ambientLight intensity={0.95} />
        <hemisphereLight args={['#ffffff', '#ffd3e0', 0.7]} />
        <directionalLight position={[3, 4.5, 5]} intensity={1.6} />
        <directionalLight position={[-4, 1.5, 3]} intensity={0.7} color="#ffe9f1" />
        <directionalLight position={[0, 2, -4]} intensity={0.8} color="#d6ecff" />
        <group position={[0, lift, 0]}>
          <Character avatar={avatar} mood={dance ? 'happy' : mood} dance={dance} vitality={vitality} />
        </group>
      </Canvas>
    </div>
  );
}
