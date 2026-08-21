// pathfind.js -- A* 8-directional grid pathfinder, ported from pathfind.py.
// geometry[y][x] === 1 means blocked. Returns [[x,y], ...] from just after
// the start to the goal, or [] if none.

export function pathfind(startX, startY, goalX, goalY, geometry) {
  const height = geometry.length;
  const width = height ? geometry[0].length : 0;
  if (!(goalX >= 0 && goalX < width && goalY >= 0 && goalY < height)) return [];
  if (geometry[goalY][goalX]) return [];
  if (startX === goalX && startY === goalY) return [];

  const isOpen = (x, y) =>
    x >= 0 && x < width && y >= 0 && y < height && !geometry[y][x];
  const h = (x, y) => Math.hypot(goalX - x, goalY - y);
  const key = (x, y) => y * width + x;

  const NEIGHBORS = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, 1.41421], [1, -1, 1.41421], [-1, 1, 1.41421], [-1, -1, 1.41421],
  ];

  // simple binary-heap-free priority via array + sort-on-pop is fine for
  // this small grid; use a lightweight heap for cleanliness.
  const heap = [[h(startX, startY), startX, startY]];
  const gScore = new Map([[key(startX, startY), 0]]);
  const cameFrom = new Map();
  const visited = new Set();

  const push = (f, x, y) => {
    heap.push([f, x, y]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let s = i;
        if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
        if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
        if (s === i) break;
        [heap[s], heap[i]] = [heap[i], heap[s]];
        i = s;
      }
    }
    return top;
  };

  const goalK = key(goalX, goalY);
  while (heap.length) {
    const [, cx, cy] = pop();
    const ck = key(cx, cy);
    if (visited.has(ck)) continue;
    visited.add(ck);
    if (cx === goalX && cy === goalY) break;
    for (const [dx, dy, step] of NEIGHBORS) {
      const nx = cx + dx, ny = cy + dy;
      if (!isOpen(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!isOpen(cx + dx, cy) || !isOpen(cx, cy + dy))) continue;
      const nk = key(nx, ny);
      const tentative = gScore.get(ck) + step;
      if (tentative < (gScore.has(nk) ? gScore.get(nk) : Infinity)) {
        gScore.set(nk, tentative);
        cameFrom.set(nk, [cx, cy]);
        push(tentative + h(nx, ny), nx, ny);
      }
    }
  }

  if (!cameFrom.has(goalK)) return [];
  const path = [];
  let node = [goalX, goalY];
  while (!(node[0] === startX && node[1] === startY)) {
    path.push(node);
    const prev = cameFrom.get(key(node[0], node[1]));
    if (!prev) return [];
    node = prev;
  }
  path.reverse();
  return path;
}
