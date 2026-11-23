import { useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

// Revolve the machined profile around the handle axis. Each bevel has its own
// surface normal so the highlights travel across the metal as the camera turns.
const profile = [
  [-1.92, 0.03],
  [-1.92, 0.53],
  [-1.85, 0.63],
  [-1.65, 0.63],
  [-1.6, 0.56],
  [-1.58, 0.77],
  [-1.51, 0.85],
  [-1.24, 0.85],
  [-1.18, 0.76],
  [-1.15, 0.89],
  [-1.08, 0.98],
  [-0.8, 0.98],
  [-0.72, 0.87],
  [-0.72, 0.21],
  [-0.6, 0.14],
  [0.6, 0.14],
  [0.72, 0.21],
  [0.72, 0.87],
  [0.8, 0.98],
  [1.08, 0.98],
  [1.15, 0.89],
  [1.18, 0.76],
  [1.24, 0.85],
  [1.51, 0.85],
  [1.58, 0.77],
  [1.6, 0.56],
  [1.65, 0.63],
  [1.85, 0.63],
  [1.92, 0.53],
  [1.92, 0.03],
];
type Point = [number, number, number];
const sides = 24;
const rings = profile.map(([x, r]) =>
  Array.from({ length: sides }, (_, i): Point => [
    x,
    r * Math.cos((i * 2 * Math.PI) / sides),
    r * Math.sin((i * 2 * Math.PI) / sides),
  ]),
);
function draw(angle: number) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const rings2d = rings.map((ring) =>
    ring.map(([x, y, z]) => {
      const u = x * c + z * s,
        depth = z * c - x * s;
      const scale = 74 / (1 - depth * 0.085);
      return { x: 180 + (u * 0.94 + y * 0.34) * scale, y: 108 + (y * 0.94 - u * 0.34) * scale, depth };
    }),
  );
  const faces = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const dx = profile[i + 1][0] - profile[i][0],
      dr = profile[i + 1][1] - profile[i][1];
    for (let j = 0; j < sides; j++) {
      const k = (j + 1) % sides,
        t = ((j + 0.5) * 2 * Math.PI) / sides;
      const points = [rings2d[i][j], rings2d[i + 1][j], rings2d[i + 1][k], rings2d[i][k]];
      const [a, b, edge] = points;
      if ((b.x - a.x) * (edge.y - a.y) >= (b.y - a.y) * (edge.x - a.x)) continue;
      const normalLength = Math.hypot(dx, dr);
      const light =
        ((-dr * c + dx * Math.sin(t) * s) * -0.32 -
          dx * Math.cos(t) * 0.78 +
          (dr * s + dx * Math.sin(t) * c) * 0.48) /
        normalLength;
      const intensity = Math.max(0, light),
        shine = Math.pow(intensity, 9) * 100;
      const metal = i >= 13 && i <= 15;
      const base = metal ? [74, 82, 96] : [35, 50, 89];
      const fill =
        'rgb(' +
        base
          .map((v, n) => Math.round(Math.min(255, v + intensity * (metal ? 97 : 58 + n * 16) + shine)))
          .join(',') +
        ')';
      faces.push({
        depth: points.reduce((sum, p) => sum + p.depth, 0),
        fill,
        path: 'M' + points.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join('L') + 'Z',
      });
    }
  }
  // Combine adjacent faces of the same shade into fewer native SVG nodes.
  const paths: { fill: string; path: string }[] = [];
  for (const f of faces.sort((a, b) => a.depth - b.depth)) {
    const last = paths[paths.length - 1];
    if (last?.fill === f.fill) last.path += f.path;
    else paths.push({ fill: f.fill, path: f.path });
  }
  return paths;
}

export interface SceneControl {
  scroll: (offset: number) => void;
}
export function DumbbellScene({ control, still }: { control: Ref<SceneControl>; still: boolean }) {
  const [angle, setAngle] = useState(0.56);
  const drag = useRef(0.56),
    start = useRef(0.56),
    scroll = useRef(0);
  useImperativeHandle(
    control,
    () => ({
      scroll(offset) {
        const next = still ? 0 : Math.round(Math.min(380, Math.max(0, offset)) / 10) * 0.018;
        if (next !== scroll.current) {
          scroll.current = next;
          setAngle(drag.current + next);
        }
      },
    }),
    [still],
  );
  const touch = useRef({ x: 0, y: 0 });
  const paths = useMemo(() => draw(angle), [angle]);
  return (
    <View
      onTouchStart={(e) => {
        touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        start.current = drag.current;
      }}
      onMoveShouldSetResponder={(e) => {
        const dx = Math.abs(e.nativeEvent.pageX - touch.current.x);
        return dx > 8 && dx > 1.5 * Math.abs(e.nativeEvent.pageY - touch.current.y);
      }}
      onResponderMove={(e) => {
        drag.current = start.current + (e.nativeEvent.pageX - touch.current.x) * 0.012;
        setAngle(drag.current + scroll.current);
      }}
      accessibilityLabel="Three-dimensional dumbbell"
      accessible
      style={{ width: '100%', height: 228 }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 360 228">
        <Defs>
          <RadialGradient id="light">
            <Stop stopColor="#586B9A" stopOpacity=".32" />
            <Stop offset="1" stopColor="#15171D" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="360" height="228" fill="url(#light)" />
        <Ellipse cx="177" cy="199" rx="100" ry="7" fill="#08090B" opacity=".65" />
        {paths.map((p, i) => (
          <Path key={i} d={p.path} fill={p.fill} stroke={p.fill} strokeWidth=".45" />
        ))}
      </Svg>
    </View>
  );
}
