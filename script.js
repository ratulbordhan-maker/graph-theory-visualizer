/**
 * GraphLab — Graph Theory Visualizer
 * script.js — Complete Application Logic
 *
 * Modules:
 *  1. GraphCore        — Node/Edge data structures
 *  2. CanvasRenderer   — Drawing engine
 *  3. AlgorithmEngine  — BFS, DFS, Dijkstra, Connected Components
 *  4. UIController     — All UI interactions
 *  5. EducationData    — Algorithm descriptions & complexity
 *  6. App              — Bootstrap & coordination
 */

'use strict';

/* ============================================================
   1. GRAPH CORE — Data Structures
   ============================================================ */
class Node {
  constructor(id, x, y) {
    this.id    = id;
    this.x     = x;
    this.y     = y;
    this.label = this._numericToLabel(id);
    this.state = 'default'; // default | visited | current | path | source | destination
    this.component = -1;
  }
  _numericToLabel(n) {
    // 0→A, 1→B, ... 25→Z, 26→AA, ...
    let label = '';
    let num = n;
    do {
      label = String.fromCharCode(65 + (num % 26)) + label;
      num = Math.floor(num / 26) - 1;
    } while (num >= 0);
    return label;
  }
}

class Edge {
  constructor(from, to, weight = 1, directed = false) {
    this.from     = from;
    this.to       = to;
    this.weight   = weight;
    this.directed = directed;
    this.state    = 'default'; // default | path | active
  }
}

class Graph {
  constructor() {
    this.nodes    = new Map();  // id → Node
    this.edges    = [];
    this.directed = false;
    this._nextId  = 0;
  }

  addNode(x, y) {
    const node = new Node(this._nextId++, x, y);
    this.nodes.set(node.id, node);
    return node;
  }

  removeNode(id) {
    this.nodes.delete(id);
    this.edges = this.edges.filter(e => e.from !== id && e.to !== id);
  }

  addEdge(fromId, toId, weight = 1) {
    if (fromId === toId) return null;
    // Prevent duplicate edges
    const exists = this.edges.some(e =>
      (e.from === fromId && e.to === toId) ||
      (!this.directed && e.from === toId && e.to === fromId)
    );
    if (exists) return null;
    const edge = new Edge(fromId, toId, weight, this.directed);
    this.edges.push(edge);
    return edge;
  }

  removeEdge(fromId, toId) {
    this.edges = this.edges.filter(e =>
      !(e.from === fromId && e.to === toId) &&
      !(e.from === toId && e.to === fromId)
    );
  }

  getNeighbors(id) {
    const neighbors = [];
    for (const e of this.edges) {
      if (e.from === id) neighbors.push({ id: e.to, weight: e.weight, edge: e });
      else if (!this.directed && e.to === id) neighbors.push({ id: e.from, weight: e.weight, edge: e });
    }
    return neighbors;
  }

  getDegree(id) {
    if (this.directed) {
      const inDeg  = this.edges.filter(e => e.to   === id).length;
      const outDeg = this.edges.filter(e => e.from === id).length;
      return { total: inDeg + outDeg, in: inDeg, out: outDeg };
    }
    return { total: this.edges.filter(e => e.from === id || e.to === id).length };
  }

  getDensity() {
    const V = this.nodes.size;
    if (V < 2) return 0;
    const maxEdges = this.directed ? V * (V - 1) : (V * (V - 1)) / 2;
    return (this.edges.length / maxEdges).toFixed(3);
  }

  resetStates() {
    this.nodes.forEach(n => { n.state = 'default'; n.component = -1; });
    this.edges.forEach(e => { e.state = 'default'; });
  }

  toJSON() {
    return {
      directed: this.directed,
      nextId:   this._nextId,
      nodes:    Array.from(this.nodes.values()).map(n => ({ id: n.id, x: n.x, y: n.y, label: n.label })),
      edges:    this.edges.map(e => ({ from: e.from, to: e.to, weight: e.weight }))
    };
  }

  fromJSON(data) {
    this.nodes.clear();
    this.edges = [];
    this.directed = data.directed;
    this._nextId  = data.nextId;
    for (const nd of data.nodes) {
      const node = new Node(nd.id, nd.x, nd.y);
      this.nodes.set(node.id, node);
    }
    for (const ed of data.edges) {
      this.edges.push(new Edge(ed.from, ed.to, ed.weight, this.directed));
    }
  }
}

/* ============================================================
   2. CANVAS RENDERER
   ============================================================ */
class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.scale  = 1;
    this.offset = { x: 0, y: 0 };
    this.NODE_RADIUS = 22;
    this.resize();
  }

  resize() {
    const container = this.canvas.parentElement;
    this.canvas.width  = container.clientWidth;
    this.canvas.height = container.clientHeight;
  }

  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.setTransform(this.scale, 0, 0, this.scale, this.offset.x, this.offset.y);
  }

  // Convert canvas pixel coords → graph coords
  toGraphCoords(cx, cy) {
    return {
      x: (cx - this.offset.x) / this.scale,
      y: (cy - this.offset.y) / this.scale
    };
  }

  getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    const isDark = document.body.classList.contains('dark');
    return {
      nodeFill:    isDark ? '#1e2540' : '#dde1f0',
      nodeBorder:  isDark ? '#3a4570' : '#aab0cc',
      nodeVisited: isDark ? '#1a3a2a' : '#d0f0e4',
      nodeVisitedBorder: isDark ? '#00c87a' : '#00a060',
      nodeCurrent: isDark ? '#3a2a00' : '#fff0cc',
      nodeCurrentBorder: isDark ? '#ffc947' : '#cc8800',
      nodePath:    isDark ? '#1a1a3a' : '#e0dcf8',
      nodePathBorder: isDark ? '#7c6eff' : '#6050cc',
      nodeSource:  isDark ? '#2a1a1a' : '#ffe0e0',
      nodeSourceBorder: isDark ? '#ff6b6b' : '#cc3333',
      nodeDest:    isDark ? '#1a2a2a' : '#d0e8f0',
      nodeDestBorder: isDark ? '#00d4ff' : '#0088aa',
      label:       isDark ? '#e4e8f5' : '#1a1e2a',
      edge:        isDark ? '#3a4570' : '#aab0cc',
      edgePath:    '#7c6eff',
      edgeActive:  '#00e5a0',
      weight:      isDark ? '#8890aa' : '#4a5070',
      componentColors: [
        '#00e5a0','#7c6eff','#ff6b6b','#ffc947','#00bfff','#ff9f43',
        '#ee5a24','#0652dd','#9980fa','#fd9644'
      ]
    };
  }

  drawEdge(edge, nodes, colors) {
    const from = nodes.get(edge.from);
    const to   = nodes.get(edge.to);
    if (!from || !to) return;

    const ctx = this.ctx;
    const dx  = to.x - from.x;
    const dy  = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const angle  = Math.atan2(dy, dx);
    const R      = this.NODE_RADIUS;

    // Slightly curve edges between parallel node pairs
    const curveMid = this._getCurveMid(from, to);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(curveMid.x, curveMid.y, to.x, to.y);

    let color = colors.edge;
    let width = 1.5;
    let dash  = [];
    if (edge.state === 'path')   { color = colors.edgePath; width = 3; }
    if (edge.state === 'active') { color = colors.edgeActive; width = 2.5; }

    ctx.strokeStyle = color;
    ctx.lineWidth   = width / this.scale;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow for directed
    if (edge.directed) {
      this._drawArrow(from, to, curveMid, color, R);
    }

    // Weight label
    if (edge.weight !== 1 || edge.state === 'path') {
      const mx = (from.x + curveMid.x * 2 + to.x) / 4;
      const my = (from.y + curveMid.y * 2 + to.y) / 4;
      this._drawWeightLabel(mx, my, edge.weight, colors.weight, edge.state === 'path' ? colors.edgePath : null);
    }
  }

  _getCurveMid(from, to) {
    // Default: straight line midpoint with slight perpendicular offset for clarity
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    return { x: mx, y: my };
  }

  _drawArrow(from, to, mid, color, R) {
    const ctx    = this.ctx;
    const dx     = to.x - mid.x;
    const dy     = to.y - mid.y;
    const len    = Math.sqrt(dx*dx + dy*dy);
    if (len === 0) return;
    const angle  = Math.atan2(dy, dx);
    const tipX   = to.x - (R + 2) / this.scale * (dx / len);
    const tipY   = to.y - (R + 2) / this.scale * (dy / len);
    const hs     = 10 / this.scale;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - hs * Math.cos(angle - Math.PI/6), tipY - hs * Math.sin(angle - Math.PI/6));
    ctx.lineTo(tipX - hs * Math.cos(angle + Math.PI/6), tipY - hs * Math.sin(angle + Math.PI/6));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  _drawWeightLabel(x, y, weight, color, highlight) {
    const ctx = this.ctx;
    const fs  = 11 / this.scale;
    ctx.font  = `700 ${fs}px 'JetBrains Mono', monospace`;
    const txt = String(weight);
    const w   = ctx.measureText(txt).width + 6 / this.scale;
    const h   = fs + 4 / this.scale;
    ctx.fillStyle   = highlight ? 'rgba(124,110,255,0.2)' : 'rgba(13,15,20,0.75)';
    ctx.strokeStyle = highlight || color;
    ctx.lineWidth   = 1 / this.scale;
    ctx.beginPath();
    ctx.roundRect(x - w/2, y - h/2, w, h, 3 / this.scale);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle   = highlight || color;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y);
  }

  drawNode(node, colors) {
    const ctx = this.ctx;
    const R   = this.NODE_RADIUS;

    let fill   = colors.nodeFill;
    let stroke = colors.nodeBorder;
    let lw     = 2;
    let glow   = null;

    switch (node.state) {
      case 'visited':
        fill = colors.nodeVisited; stroke = colors.nodeVisitedBorder; lw = 2.5; glow = colors.nodeVisitedBorder; break;
      case 'current':
        fill = colors.nodeCurrent; stroke = colors.nodeCurrentBorder; lw = 3; glow = colors.nodeCurrentBorder; break;
      case 'path':
        fill = colors.nodePath; stroke = colors.nodePathBorder; lw = 3; glow = colors.nodePathBorder; break;
      case 'source':
        fill = colors.nodeSource; stroke = colors.nodeSourceBorder; lw = 3; glow = colors.nodeSourceBorder; break;
      case 'destination':
        fill = colors.nodeDest; stroke = colors.nodeDestBorder; lw = 3; glow = colors.nodeDestBorder; break;
      case 'component':
        fill = node._compFill; stroke = node._compBorder; lw = 2.5; glow = node._compBorder; break;
    }

    // Glow effect
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur  = 14 / this.scale;
    }

    // Circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, R / this.scale, 0, Math.PI * 2);
    ctx.fillStyle   = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth   = lw / this.scale;
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Label
    const fs = 13 / this.scale;
    ctx.font      = `700 ${fs}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = node.state === 'default' ? colors.label : stroke;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.label, node.x, node.y);
  }

  drawAll(graph, edgeInProgress) {
    this.clear();
    const colors = this.getThemeColors();
    // Edges
    for (const edge of graph.edges) {
      this.drawEdge(edge, graph.nodes, colors);
    }
    // In-progress edge
    if (edgeInProgress) {
      const from = graph.nodes.get(edgeInProgress.fromId);
      if (from) {
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(edgeInProgress.x, edgeInProgress.y);
        this.ctx.strokeStyle = colors.edgeActive;
        this.ctx.lineWidth   = 1.5 / this.scale;
        this.ctx.setLineDash([5 / this.scale, 5 / this.scale]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
    }
    // Nodes
    graph.nodes.forEach(node => this.drawNode(node, colors));
  }

  hitTest(graph, gx, gy) {
    const R = this.NODE_RADIUS;
    for (const [id, node] of graph.nodes) {
      const dx = node.x - gx;
      const dy = node.y - gy;
      if (dx*dx + dy*dy <= (R/this.scale)*(R/this.scale)) return node;
    }
    return null;
  }

  setZoom(scale, cx, cy) {
    const prevScale = this.scale;
    this.scale = Math.max(0.3, Math.min(3, scale));
    this.offset.x += cx * (1 - this.scale / prevScale);
    this.offset.y += cy * (1 - this.scale / prevScale);
  }
}

/* ============================================================
   3. ALGORITHM ENGINE
   ============================================================ */
class AlgorithmEngine {
  constructor(graph) {
    this.graph = graph;
  }

  /** BFS — returns array of steps and continues across disconnected components */
  bfs(startId) {
    const steps = [];
    const visited = new Set();
    let order = 0;

    const traverseFrom = (source) => {
      const queue = [source];
      visited.add(source);
      steps.push({ type: 'visit', id: source, order: order++ });

      while (queue.length > 0) {
        const curr = queue.shift();
        steps.push({ type: 'current', id: curr });
        for (const neighbor of this.graph.getNeighbors(curr)) {
          if (!visited.has(neighbor.id)) {
            visited.add(neighbor.id);
            steps.push({ type: 'visit', id: neighbor.id, from: curr, edge: neighbor.edge, order: order++ });
            queue.push(neighbor.id);
          }
        }
      }
    };

    traverseFrom(startId);
    for (const [id] of this.graph.nodes) {
      if (!visited.has(id)) traverseFrom(id);
    }

    return steps;
  }

  /** DFS — returns array of steps */
  dfs(startId) {
    const steps   = [];
    const visited = new Set();
    let order = 0;

    const dfsRecurse = (id) => {
      visited.add(id);
      steps.push({ type: 'visit', id, order: order++ });
      steps.push({ type: 'current', id });
      for (const neighbor of this.graph.getNeighbors(id)) {
        if (!visited.has(neighbor.id)) {
          steps.push({ type: 'edge', edge: neighbor.edge });
          dfsRecurse(neighbor.id);
        }
      }
    };

    dfsRecurse(startId);
    // Handle disconnected components
    for (const [id] of this.graph.nodes) {
      if (!visited.has(id)) dfsRecurse(id);
    }
    return steps;
  }

  /** Dijkstra — returns path steps and shortest path */
  dijkstra(sourceId, destId) {
    const dist  = {};
    const prev  = {};
    const edgeMap = {};
    const unvisited = new Set();

    for (const [id] of this.graph.nodes) {
      dist[id] = Infinity;
      prev[id] = null;
      unvisited.add(id);
    }
    dist[sourceId] = 0;

    const steps = [];
    steps.push({ type: 'source', id: sourceId });

    while (unvisited.size > 0) {
      // Pick unvisited node with smallest distance
      let u = null;
      for (const id of unvisited) {
        if (u === null || dist[id] < dist[u]) u = id;
      }
      if (dist[u] === Infinity) break;
      unvisited.delete(u);
      steps.push({ type: 'current', id: u });
      if (u === destId) break;

      for (const neighbor of this.graph.getNeighbors(u)) {
        if (!unvisited.has(neighbor.id)) continue;
        const alt = dist[u] + neighbor.weight;
        if (alt < dist[neighbor.id]) {
          dist[neighbor.id] = alt;
          prev[neighbor.id] = u;
          edgeMap[neighbor.id] = neighbor.edge;
          steps.push({ type: 'relax', id: neighbor.id, cost: alt });
        }
      }
    }

    // Reconstruct path
    const path = [];
    const pathEdges = [];
    let cur = destId;
    while (cur !== null) {
      path.unshift(cur);
      if (edgeMap[cur]) pathEdges.unshift(edgeMap[cur]);
      cur = prev[cur];
    }

    const pathValid = path.length > 0 && path[0] === sourceId;
    return { steps, path: pathValid ? path : [], pathEdges, cost: dist[destId] };
  }

  /** Connected Components — returns array of components */
  findComponents() {
    const visited = new Set();
    const components = [];

    const bfsComponent = (startId) => {
      const component = [];
      const queue = [startId];
      visited.add(startId);
      while (queue.length > 0) {
        const curr = queue.shift();
        component.push(curr);
        for (const n of this.graph.getNeighbors(curr)) {
          if (!visited.has(n.id)) {
            visited.add(n.id);
            queue.push(n.id);
          }
        }
      }
      return component;
    };

    for (const [id] of this.graph.nodes) {
      if (!visited.has(id)) {
        components.push(bfsComponent(id));
      }
    }
    return components;
  }
}

/* ============================================================
   4. EDUCATION DATA
   ============================================================ */
const EDU_DATA = {
  bfs: {
    title: 'Breadth-First Search',
    description: 'BFS explores a graph level by level. Starting from a source node, it visits all neighbors at the current depth before moving to the next level.',
    time: 'O(V + E)',
    space: 'O(V)',
    steps: [
      'Enqueue the source node and mark it visited',
      'Dequeue a node and process it',
      'Enqueue all unvisited neighbors',
      'Repeat until queue is empty'
    ],
    applications: ['Shortest path (unweighted)', 'Web crawling', 'Social networks', 'GPS navigation', 'Level-order tree traversal']
  },
  dfs: {
    title: 'Depth-First Search',
    description: 'DFS explores as far as possible along each branch before backtracking. It uses a stack (or recursion) to track the path.',
    time: 'O(V + E)',
    space: 'O(V)',
    steps: [
      'Start at the source node and mark it visited',
      'Recursively visit each unvisited neighbor',
      'Backtrack when no unvisited neighbors remain',
      'Continue until all nodes are visited'
    ],
    applications: ['Topological sorting', 'Cycle detection', 'Maze solving', 'Strongly connected components', 'Puzzle solving']
  },
  dijkstra: {
    title: "Dijkstra's Shortest Path",
    description: "Dijkstra's algorithm finds the shortest path from a source node to all other nodes in a weighted graph. It greedily selects the node with the smallest tentative distance.",
    time: 'O((V + E) log V)',
    space: 'O(V)',
    steps: [
      'Set distance to source = 0, all others = ∞',
      'Pick the unvisited node with smallest distance',
      'Relax all its edges (update distances)',
      'Mark it visited and repeat'
    ],
    applications: ['GPS route finding', 'Network routing protocols', 'Airline scheduling', 'Robot navigation', 'Game AI pathfinding']
  },
  components: {
    title: 'Connected Components',
    description: 'A connected component is a maximal subgraph where every pair of nodes has a path between them. Finding components reveals the structure of disconnected graphs.',
    time: 'O(V + E)',
    space: 'O(V)',
    steps: [
      'For each unvisited node, start a BFS/DFS',
      'Mark all reachable nodes as the same component',
      'Move to next unvisited node',
      'Each BFS/DFS produces one component'
    ],
    applications: ['Network reliability analysis', 'Image segmentation', 'Social community detection', 'Circuit analysis', 'Cluster detection']
  }
};

function renderEduContent(key) {
  const data = EDU_DATA[key];
  if (!data) return '';
  return `
    <h4>${data.title}</h4>
    <p>${data.description}</p>
    <div class="complexity-row">
      <span class="complexity-badge">⏱ Time: ${data.time}</span>
      <span class="complexity-badge space">💾 Space: ${data.space}</span>
    </div>
    <h4>Steps</h4>
    <ul>
      ${data.steps.map(s => `<li>${s}</li>`).join('')}
    </ul>
    <h4>Real-World Applications</h4>
    <div class="app-list">
      ${data.applications.map(a => `<span class="app-tag">${a}</span>`).join('')}
    </div>
  `;
}

/* ============================================================
   5. UI CONTROLLER
   ============================================================ */
class UIController {
  constructor() {
    this.graph      = new Graph();
    this.renderer   = null;
    this.engine     = null;

    this.tool       = 'addNode'; // addNode | addEdge | delete | move
    this.edgeFrom   = null;
    this.dragging   = null;
    this.dragOffset = { x: 0, y: 0 };
    this.isPanning  = false;
    this.panStart   = { x: 0, y: 0 };

    this.edgeInProgress = null;

    this.selectedAlgo   = null;
    this.algoSteps      = [];
    this.stepIndex      = 0;
    this.running        = false;
    this.runInterval    = null;
    this.traversalOrder = [];

    this.dijkstraPhase  = null; // null | 'source' | 'dest'
    this.dijkstraSource = null;
    this.dijkstraResult = null;

    this.eduKey = 'bfs';

    this.init();
  }

  init() {
    const canvas = document.getElementById('graphCanvas');
    this.renderer = new CanvasRenderer(canvas);
    this.engine   = new AlgorithmEngine(this.graph);

    this._bindCanvas(canvas);
    this._bindUI();
    this._bindEduTabs();
    this._updateEduContent();
    this._updateStats();
    this.renderer.drawAll(this.graph, null);

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.renderer.drawAll(this.graph, this.edgeInProgress);
    });

    // Load saved graph if any
    const saved = localStorage.getItem('graphlab_graph');
    if (saved) {
      try {
        this.graph.fromJSON(JSON.parse(saved));
        this.engine = new AlgorithmEngine(this.graph);
        this._updateAll();
        this.showToast('Loaded saved graph', 'info');
      } catch(e) {}
    }
  }

  /* ── Canvas Events ── */
  _bindCanvas(canvas) {
    // Mouse
    canvas.addEventListener('mousedown',  e => this._onDown(e));
    canvas.addEventListener('mousemove',  e => this._onMove(e));
    canvas.addEventListener('mouseup',    e => this._onUp(e));
    canvas.addEventListener('dblclick',   e => this._onDblClick(e));
    canvas.addEventListener('wheel',      e => this._onWheel(e), { passive: false });
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); this._onRightClick(e); });

    // Touch
    canvas.addEventListener('touchstart', e => this._onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove',  e => this._onTouchMove(e),  { passive: false });
    canvas.addEventListener('touchend',   e => this._onTouchEnd(e));
  }

  _getCanvasPos(e) {
    const rect = this.renderer.canvas.getBoundingClientRect();
    const cx = (e.clientX || e.touches[0].clientX) - rect.left;
    const cy = (e.clientY || e.touches[0].clientY) - rect.top;
    return { cx, cy, ...this.renderer.toGraphCoords(cx, cy) };
  }

  _onDown(e) {
    if (e.button === 1) { e.preventDefault(); return; } // middle click
    const pos  = this._getCanvasPos(e);
    const node = this.renderer.hitTest(this.graph, pos.x, pos.y);

    // Dijkstra node selection
    if (this.dijkstraPhase === 'source') {
      if (node) { this._setDijkstraSource(node); return; }
      return;
    }
    if (this.dijkstraPhase === 'dest') {
      if (node) { this._setDijkstraDest(node); return; }
      return;
    }

    if (this.tool === 'addNode' && !node) {
      const newNode = this.graph.addNode(pos.x, pos.y);
      this._updateAll();
      this.setStatus(`Added node ${newNode.label}`);
    } else if (this.tool === 'addEdge') {
      if (node) {
        if (!this.edgeFrom) {
          this.edgeFrom = node.id;
          node.state = 'source';
          this.edgeInProgress = { fromId: node.id, x: pos.x, y: pos.y };
          this.setStatus(`Click another node to connect from ${node.label}`);
        } else if (node.id !== this.edgeFrom) {
          const w = parseInt(document.getElementById('edgeWeight').value) || 1;
          const edge = this.graph.addEdge(this.edgeFrom, node.id, w);
          if (edge) {
            this.setStatus(`Connected: ${this.graph.nodes.get(this.edgeFrom).label} → ${node.label} (w=${w})`);
          } else {
            this.showToast('Edge already exists!', 'error');
          }
          this.graph.nodes.get(this.edgeFrom).state = 'default';
          this.edgeFrom = null;
          this.edgeInProgress = null;
          this._updateAll();
        }
      }
    } else if (this.tool === 'delete') {
      if (node) {
        this.graph.removeNode(node.id);
        this.setStatus(`Deleted node ${node.label}`);
        this._updateAll();
      } else {
        // Try to delete edge near click
        this._tryDeleteEdge(pos.x, pos.y);
      }
    } else if (this.tool === 'move' && node) {
      this.dragging   = node;
      this.dragOffset = { x: pos.x - node.x, y: pos.y - node.y };
    } else if (!node) {
      // Panning
      this.isPanning = true;
      this.panStart  = { x: e.clientX - this.renderer.offset.x, y: e.clientY - this.renderer.offset.y };
    }

    // Node selection for info
    if (node && this.tool !== 'delete') {
      this._showNodeInfo(node);
    } else {
      document.getElementById('nodeInfo').style.display = 'none';
    }

    this.renderer.drawAll(this.graph, this.edgeInProgress);
  }

  _onMove(e) {
    const pos = this._getCanvasPos(e);
    if (this.dragging) {
      this.dragging.x = pos.x - this.dragOffset.x;
      this.dragging.y = pos.y - this.dragOffset.y;
      this.renderer.drawAll(this.graph, this.edgeInProgress);
    } else if (this.edgeInProgress) {
      this.edgeInProgress.x = pos.x;
      this.edgeInProgress.y = pos.y;
      this.renderer.drawAll(this.graph, this.edgeInProgress);
    } else if (this.isPanning) {
      this.renderer.offset.x = e.clientX - this.panStart.x;
      this.renderer.offset.y = e.clientY - this.panStart.y;
      this.renderer.drawAll(this.graph, null);
      document.getElementById('zoomLevel').textContent = Math.round(this.renderer.scale * 100) + '%';
    } else {
      // Cursor changes
      const node = this.renderer.hitTest(this.graph, pos.x, pos.y);
      this.renderer.canvas.style.cursor = node ?
        (this.tool === 'delete' ? 'not-allowed' : 'pointer') :
        (this.tool === 'addNode' ? 'crosshair' : 'default');
    }
  }

  _onUp(e) {
    if (this.dragging) {
      this._updateAll();
    }
    this.dragging  = null;
    this.isPanning = false;
  }

  _onDblClick(e) {
    // Double-click to quickly add node regardless of tool
    if (this.tool === 'addNode') return; // already handled in mousedown
    const pos  = this._getCanvasPos(e);
    const node = this.renderer.hitTest(this.graph, pos.x, pos.y);
    if (!node) {
      this.graph.addNode(pos.x, pos.y);
      this._updateAll();
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const rect  = this.renderer.canvas.getBoundingClientRect();
    const cx    = e.clientX - rect.left;
    const cy    = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.renderer.setZoom(this.renderer.scale * delta, cx, cy);
    document.getElementById('zoomLevel').textContent = Math.round(this.renderer.scale * 100) + '%';
    this.renderer.drawAll(this.graph, this.edgeInProgress);
  }

  _onRightClick(e) {
    // Cancel edge drawing on right-click
    if (this.edgeFrom !== null) {
      const from = this.graph.nodes.get(this.edgeFrom);
      if (from) from.state = 'default';
      this.edgeFrom = null;
      this.edgeInProgress = null;
      this.renderer.drawAll(this.graph, null);
      this.setStatus('Edge cancelled');
    }
  }

  _onTouchStart(e) { e.preventDefault(); this._onDown(e.touches[0]); }
  _onTouchMove(e)  { e.preventDefault(); this._onMove(e.touches[0]); }
  _onTouchEnd(e)   { this._onUp(e); }

  _tryDeleteEdge(gx, gy) {
    let closest = null;
    let minDist = 15 / this.renderer.scale;
    for (const edge of this.graph.edges) {
      const from = this.graph.nodes.get(edge.from);
      const to   = this.graph.nodes.get(edge.to);
      if (!from || !to) continue;
      const dist = this._pointToSegmentDist(gx, gy, from.x, from.y, to.x, to.y);
      if (dist < minDist) { closest = edge; minDist = dist; }
    }
    if (closest) {
      this.graph.edges = this.graph.edges.filter(e => e !== closest);
      this._updateAll();
      this.setStatus('Deleted edge');
    }
  }

  _pointToSegmentDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t  = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / (dx*dx + dy*dy)));
    const qx = ax + t*dx - px;
    const qy = ay + t*dy - py;
    return Math.sqrt(qx*qx + qy*qy);
  }

  /* ── UI Bindings ── */
  _bindUI() {
    // Graph type
    document.getElementById('btnUndirected').addEventListener('click', () => this._setDirected(false));
    document.getElementById('btnDirected').addEventListener('click',   () => this._setDirected(true));

    // Tools
    ['toolAddNode','toolAddEdge','toolDelete','toolMove'].forEach(id => {
      document.getElementById(id).addEventListener('click', () => this._setTool(id));
    });

    // Algorithm selection
    ['algoBFS','algoDFS','algoDijkstra','algoComponents'].forEach(id => {
      document.getElementById(id).addEventListener('click', () => this._selectAlgo(id));
    });

    // Run controls
    document.getElementById('btnRun').addEventListener('click',  () => this._startAlgo(false));
    document.getElementById('btnStep').addEventListener('click', () => this._stepAlgo());
    document.getElementById('btnStop').addEventListener('click', () => this._stopAlgo());

    // Speed slider
    document.getElementById('speedSlider').addEventListener('input', e => {
      const v = parseInt(e.target.value);
      const labels = {100:'Fast',300:'Fast',500:'Normal',700:'Normal',900:'Slow',1100:'Slow',1300:'Slower',1500:'Slowest'};
      document.getElementById('speedLabel').textContent = v <= 300 ? 'Fast' : v <= 700 ? 'Normal' : 'Slow';
    });

    // Actions
    document.getElementById('btnRandom').addEventListener('click', () => this._generateRandom());
    document.getElementById('btnClear').addEventListener('click',  () => this._clearGraph());
    document.getElementById('btnExport').addEventListener('click', () => this._exportJSON());
    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', e => this._importJSON(e));
    document.getElementById('btnSave').addEventListener('click',   () => this._saveLocal());
    document.getElementById('btnLoad').addEventListener('click',   () => this._loadLocal());

    // Zoom
    document.getElementById('zoomIn').addEventListener('click',    () => this._zoom(1.2));
    document.getElementById('zoomOut').addEventListener('click',   () => this._zoom(0.8));
    document.getElementById('zoomReset').addEventListener('click', () => this._zoomReset());

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('change', e => {
      document.body.classList.toggle('dark',  e.target.checked);
      document.body.classList.toggle('light', !e.target.checked);
      this.renderer.drawAll(this.graph, null);
    });

    // Edge weight visibility
    document.getElementById('toolAddEdge').addEventListener('click', () => {
      document.getElementById('edgeWeightWrap').classList.remove('hidden');
    });
    ['toolAddNode','toolDelete','toolMove'].forEach(id => {
      document.getElementById(id).addEventListener('click', () => {
        document.getElementById('edgeWeightWrap').classList.add('hidden');
      });
    });
  }

  _setDirected(directed) {
    this.graph.directed = directed;
    this.graph.edges.forEach(e => e.directed = directed);
    document.getElementById('btnDirected').classList.toggle('active', directed);
    document.getElementById('btnUndirected').classList.toggle('active', !directed);
    this.renderer.drawAll(this.graph, null);
    this.setStatus(directed ? 'Switched to directed graph' : 'Switched to undirected graph');
  }

  _setTool(toolId) {
    const map = { toolAddNode: 'addNode', toolAddEdge: 'addEdge', toolDelete: 'delete', toolMove: 'move' };
    this.tool = map[toolId];
    // Reset edge drawing
    if (this.edgeFrom !== null) {
      const from = this.graph.nodes.get(this.edgeFrom);
      if (from) from.state = 'default';
      this.edgeFrom = null;
      this.edgeInProgress = null;
    }
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(toolId).classList.add('active');
    const hints = {
      addNode: 'Click on canvas to add nodes',
      addEdge: 'Click a node to start an edge, then click another to connect',
      delete:  'Click a node or edge to delete it',
      move:    'Drag nodes to reposition them'
    };
    document.getElementById('canvasHint').textContent = hints[this.tool];
    this.renderer.drawAll(this.graph, null);
  }

  _selectAlgo(algoId) {
    this._stopAlgo();
    this.graph.resetStates();
    document.querySelectorAll('.algo-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById(algoId).classList.add('selected');
    this.selectedAlgo = algoId;
    document.getElementById('btnRun').disabled  = false;
    document.getElementById('btnStep').disabled = false;
    this.algoSteps  = [];
    this.stepIndex  = 0;
    this.traversalOrder = [];

    const eduMap = { algoBFS: 'bfs', algoDFS: 'dfs', algoDijkstra: 'dijkstra', algoComponents: 'components' };
    this.eduKey = eduMap[algoId];
    this._updateEduContent();
    this._activateEduTab(this.eduKey);

    document.getElementById('traversalSection').style.display = 'none';
    document.getElementById('pathResultSection').style.display = 'none';
    document.getElementById('traversalDisplay').innerHTML = '';

    const hints = {
      algoBFS:        'Click RUN — BFS will start from the first node',
      algoDFS:        'Click RUN — DFS will start from the first node',
      algoDijkstra:   'Click RUN — then select SOURCE and DESTINATION nodes',
      algoComponents: 'Click RUN — all components will be colored'
    };
    this.setStatus(hints[algoId]);
    this.renderer.drawAll(this.graph, null);
  }

  /* ── Algorithm Execution ── */
  _prepareSteps() {
    if (this.graph.nodes.size === 0) {
      this.showToast('Add some nodes first!', 'error');
      return false;
    }
    this.engine = new AlgorithmEngine(this.graph);
    const firstId = this.graph.nodes.keys().next().value;

    if (this.selectedAlgo === 'algoBFS') {
      this.algoSteps = this.engine.bfs(firstId);
    } else if (this.selectedAlgo === 'algoDFS') {
      this.algoSteps = this.engine.dfs(firstId);
    } else if (this.selectedAlgo === 'algoDijkstra') {
      // Dijkstra requires user to select source and destination
      this._startDijkstraSelection();
      return false;
    } else if (this.selectedAlgo === 'algoComponents') {
      this._runComponents();
      return false;
    }
    this.stepIndex = 0;
    this.traversalOrder = [];
    this.graph.resetStates();
    document.getElementById('traversalDisplay').innerHTML = '';
    document.getElementById('traversalSection').style.display = 'block';
    return true;
  }

  _startAlgo(stepMode) {
    if (this.algoSteps.length === 0 || this.stepIndex >= this.algoSteps.length) {
      if (!this._prepareSteps()) return;
      if (this.algoSteps.length === 0) return;
    }
    if (stepMode) return;

    this._setRunning(true);
    const speed = parseInt(document.getElementById('speedSlider').value);

    this.runInterval = setInterval(() => {
      if (this.stepIndex >= this.algoSteps.length) {
        this._stopAlgo(true);
        return;
      }
      this._applyStep(this.algoSteps[this.stepIndex++]);
      this.renderer.drawAll(this.graph, null);
    }, 1600 - speed); // invert so higher = faster
  }

  _stepAlgo() {
    if (this.algoSteps.length === 0 || this.stepIndex >= this.algoSteps.length) {
      if (!this._prepareSteps()) return;
      if (this.algoSteps.length === 0) return;
    }
    if (this.stepIndex < this.algoSteps.length) {
      this._applyStep(this.algoSteps[this.stepIndex++]);
      this.renderer.drawAll(this.graph, null);
    }
    if (this.stepIndex >= this.algoSteps.length) {
      this.setStatus('Algorithm complete! ✓');
      this.showToast('Algorithm complete!', 'success');
    }
  }

  _applyStep(step) {
    const node = this.graph.nodes.get(step.id);
    if (!node) return;

    if (step.type === 'visit') {
      node.state = 'visited';
      if (step.edge) step.edge.state = 'active';
      this.traversalOrder.push(node.label);
      this._appendTraversalNode(node.label, step.order);
      this.setStatus(`Visiting node ${node.label} (order: ${step.order + 1})`);
    } else if (step.type === 'current') {
      // Mark previously current as visited
      this.graph.nodes.forEach(n => { if (n.state === 'current') n.state = 'visited'; });
      node.state = 'current';
      this.setStatus(`Processing node ${node.label}`);
    } else if (step.type === 'relax') {
      node.state = 'visited';
      this.setStatus(`Relaxed node ${node.label}: dist = ${step.cost}`);
    } else if (step.type === 'edge') {
      if (step.edge) step.edge.state = 'active';
    }
  }

  _stopAlgo(finished = false) {
    if (this.runInterval) clearInterval(this.runInterval);
    this.runInterval = null;
    this._setRunning(false);
    if (finished) {
      this.setStatus(`Algorithm complete! Visited: ${this.traversalOrder.join(' → ')}`);
      this.showToast('Algorithm complete!', 'success');
    } else {
      this.algoSteps = [];
      this.stepIndex = 0;
    }
    this.renderer.drawAll(this.graph, null);
  }

  _setRunning(v) {
    this.running = v;
    document.getElementById('btnRun').disabled  = v;
    document.getElementById('btnStep').disabled = v;
    document.getElementById('btnStop').disabled = !v;
  }

  _appendTraversalNode(label, order) {
    const display = document.getElementById('traversalDisplay');
    const el = document.createElement('span');
    el.className = 'trav-node';
    el.textContent = label;
    el.title = `Visit order: ${order + 1}`;
    display.appendChild(el);
  }

  /* ── Dijkstra Selection Flow ── */
  _startDijkstraSelection() {
    this.graph.resetStates();
    this.dijkstraPhase = 'source';
    this.dijkstraSource = null;
    document.body.classList.add('selecting-source');
    this.setStatus('Click a node to set as SOURCE');
  }

  _setDijkstraSource(node) {
    this.dijkstraSource = node.id;
    node.state = 'source';
    this.dijkstraPhase = 'dest';
    document.body.classList.remove('selecting-source');
    document.body.classList.add('selecting-dest');
    this.setStatus(`Source: ${node.label}. Click a node to set as DESTINATION`);
    this.renderer.drawAll(this.graph, null);
  }

  _setDijkstraDest(node) {
    if (node.id === this.dijkstraSource) {
      this.showToast('Source and destination must be different!', 'error');
      return;
    }
    document.body.classList.remove('selecting-dest');
    this.dijkstraPhase = null;
    node.state = 'destination';
    this.renderer.drawAll(this.graph, null);

    const result = this.engine.dijkstra(this.dijkstraSource, node.id);
    this.dijkstraResult = result;

    // Animate steps
    this.algoSteps  = result.steps;
    this.stepIndex  = 0;
    this.graph.resetStates();
    this.graph.nodes.get(this.dijkstraSource).state = 'source';
    node.state = 'destination';

    document.getElementById('traversalSection').style.display = 'none';
    this._setRunning(true);
    const speed = parseInt(document.getElementById('speedSlider').value);

    this.runInterval = setInterval(() => {
      if (this.stepIndex >= this.algoSteps.length) {
        clearInterval(this.runInterval);
        this._finishDijkstra(result, node);
        return;
      }
      this._applyStep(this.algoSteps[this.stepIndex++]);
      this.renderer.drawAll(this.graph, null);
    }, 1600 - speed);
  }

  _finishDijkstra(result, destNode) {
    this._setRunning(false);
    this.graph.resetStates();

    if (result.path.length > 0) {
      // Highlight path
      result.path.forEach(id => {
        this.graph.nodes.get(id).state = 'path';
      });
      this.graph.nodes.get(result.path[0]).state = 'source';
      this.graph.nodes.get(result.path[result.path.length - 1]).state = 'destination';
      result.pathEdges.forEach(e => { if (e) e.state = 'path'; });

      const pathLabels = result.path.map(id => this.graph.nodes.get(id).label).join(' → ');
      document.getElementById('pathResult').innerHTML = `
        <div>Path found ✓</div>
        <div class="path-nodes">${pathLabels}</div>
        <div style="margin-top:6px">Total cost: <span class="path-cost">${result.cost}</span></div>
      `;
      this.setStatus(`Shortest path: ${pathLabels} (cost: ${result.cost})`);
      this.showToast(`Shortest path found! Cost: ${result.cost}`, 'success');
    } else {
      document.getElementById('pathResult').innerHTML = `<span class="no-path">No path exists between selected nodes</span>`;
      this.setStatus('No path found between selected nodes');
      this.showToast('No path found!', 'error');
    }

    document.getElementById('pathResultSection').style.display = 'block';
    this.renderer.drawAll(this.graph, null);
  }

  /* ── Connected Components ── */
  _runComponents() {
    this.graph.resetStates();
    const components = this.engine.findComponents();
    const colors = this.renderer.getThemeColors().componentColors;

    components.forEach((comp, ci) => {
      const col = colors[ci % colors.length];
      comp.forEach(id => {
        const node = this.graph.nodes.get(id);
        node.state = 'component';
        node._compFill   = col + '22';
        node._compBorder = col;
      });
    });

    document.getElementById('statComponents').textContent = components.length;
    this.setStatus(`Found ${components.length} connected component${components.length !== 1 ? 's' : ''}`);
    this.showToast(`${components.length} component${components.length !== 1 ? 's' : ''} found`, 'success');
    this.renderer.drawAll(this.graph, null);
  }

  /* ── Graph Actions ── */
  _generateRandom() {
    this._clearGraph(true);
    const nodeCount = Math.floor(Math.random() * 5) + 5; // 5–9 nodes
    const W = this.renderer.canvas.width  / this.renderer.scale;
    const H = this.renderer.canvas.height / this.renderer.scale;
    const pad = 60;
    const minX = -this.renderer.offset.x / this.renderer.scale + pad;
    const minY = -this.renderer.offset.y / this.renderer.scale + pad;

    for (let i = 0; i < nodeCount; i++) {
      const x = minX + Math.random() * (W - pad * 2);
      const y = minY + Math.random() * (H - pad * 2);
      this.graph.addNode(x, y);
    }

    const ids = Array.from(this.graph.nodes.keys());
    const edgeCount = Math.floor(nodeCount * 1.4);
    for (let i = 0; i < edgeCount; i++) {
      const a = ids[Math.floor(Math.random() * ids.length)];
      const b = ids[Math.floor(Math.random() * ids.length)];
      const w = Math.floor(Math.random() * 9) + 1;
      this.graph.addEdge(a, b, w);
    }

    this._updateAll();
    this.showToast(`Generated random graph with ${nodeCount} nodes`, 'success');
  }

  _clearGraph(silent = false) {
    this._stopAlgo();
    this.graph = new Graph();
    this.graph.directed = document.getElementById('btnDirected').classList.contains('active');
    this.engine  = new AlgorithmEngine(this.graph);
    this.edgeFrom = null;
    this.edgeInProgress = null;
    this.algoSteps = [];
    this.stepIndex = 0;
    this.dijkstraPhase = null;
    document.body.classList.remove('selecting-source','selecting-dest');
    document.getElementById('traversalSection').style.display = 'none';
    document.getElementById('pathResultSection').style.display = 'none';
    document.getElementById('traversalDisplay').innerHTML = '';
    this._updateAll();
    if (!silent) { this.showToast('Graph cleared', 'info'); this.setStatus('Graph cleared'); }
  }

  _exportJSON() {
    const data = JSON.stringify(this.graph.toJSON(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'graph.json';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Graph exported as JSON', 'success');
  }

  _importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        this._stopAlgo();
        this.graph.fromJSON(data);
        this.engine = new AlgorithmEngine(this.graph);
        this._updateAll();
        this.showToast('Graph imported!', 'success');
        this.setStatus('Graph imported from JSON');
      } catch(err) {
        this.showToast('Invalid JSON file!', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  _saveLocal() {
    localStorage.setItem('graphlab_graph', JSON.stringify(this.graph.toJSON()));
    this.showToast('Graph saved to browser storage', 'success');
  }

  _loadLocal() {
    const saved = localStorage.getItem('graphlab_graph');
    if (!saved) { this.showToast('No saved graph found', 'error'); return; }
    try {
      this._stopAlgo();
      this.graph.fromJSON(JSON.parse(saved));
      this.engine = new AlgorithmEngine(this.graph);
      this._updateAll();
      this.showToast('Graph loaded from browser storage', 'success');
    } catch(e) {
      this.showToast('Failed to load saved graph', 'error');
    }
  }

  /* ── Zoom ── */
  _zoom(factor) {
    const cx = this.renderer.canvas.width / 2;
    const cy = this.renderer.canvas.height / 2;
    this.renderer.setZoom(this.renderer.scale * factor, cx, cy);
    document.getElementById('zoomLevel').textContent = Math.round(this.renderer.scale * 100) + '%';
    this.renderer.drawAll(this.graph, null);
  }

  _zoomReset() {
    this.renderer.scale    = 1;
    this.renderer.offset   = { x: 0, y: 0 };
    document.getElementById('zoomLevel').textContent = '100%';
    this.renderer.drawAll(this.graph, null);
  }

  /* ── UI Updates ── */
  _showNodeInfo(node) {
    const deg = this.graph.getDegree(node.id);
    document.getElementById('nodeInfo').style.display = 'block';
    document.getElementById('nodeInfoLabel').textContent = node.label;
    document.getElementById('nodeInfoDegree').textContent = deg.total;
    if (this.graph.directed) {
      document.getElementById('nodeInfoInDegreeRow').style.display = 'flex';
      document.getElementById('nodeInfoOutDegreeRow').style.display = 'flex';
      document.getElementById('nodeInfoInDegree').textContent  = deg.in;
      document.getElementById('nodeInfoOutDegree').textContent = deg.out;
    } else {
      document.getElementById('nodeInfoInDegreeRow').style.display = 'none';
      document.getElementById('nodeInfoOutDegreeRow').style.display = 'none';
    }
  }

  _updateStats() {
    const V = this.graph.nodes.size;
    const E = this.graph.edges.length;
    const components = V > 0 ? this.engine.findComponents().length : '—';
    document.getElementById('statVertices').textContent = V;
    document.getElementById('statEdges').textContent    = E;
    document.getElementById('statDensity').textContent  = this.graph.getDensity();
    document.getElementById('statComponents').textContent = components;
  }

  _updateMatrix() {
    const ids = Array.from(this.graph.nodes.keys());
    const wrap = document.getElementById('matrixWrap');
    if (ids.length === 0) {
      wrap.innerHTML = '<p class="empty-msg">Add nodes to see matrix</p>';
      return;
    }
    if (ids.length > 12) {
      wrap.innerHTML = '<p class="empty-msg">Matrix hidden for large graphs (>12 nodes)</p>';
      return;
    }
    const labels = ids.map(id => this.graph.nodes.get(id).label);
    let html = '<table><thead><tr><th></th>';
    labels.forEach(l => { html += `<th>${l}</th>`; });
    html += '</tr></thead><tbody>';
    ids.forEach((rowId, ri) => {
      html += `<tr><th>${labels[ri]}</th>`;
      ids.forEach((colId, ci) => {
        const edge = this.graph.edges.find(e =>
          (e.from === rowId && e.to === colId) ||
          (!this.graph.directed && e.from === colId && e.to === rowId)
        );
        const val    = edge ? edge.weight : 0;
        const cls    = val > 0 ? 'nonzero' : (ri === ci ? 'diagonal' : '');
        html += `<td class="${cls}">${val}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  _updateAll() {
    this._updateStats();
    this._updateMatrix();
    this.renderer.drawAll(this.graph, this.edgeInProgress);
  }

  /* ── Education ── */
  _bindEduTabs() {
    document.querySelectorAll('.edu-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.eduKey = tab.dataset.edu;
        this._activateEduTab(this.eduKey);
        this._updateEduContent();
      });
    });
  }

  _activateEduTab(key) {
    document.querySelectorAll('.edu-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.edu === key);
    });
  }

  _updateEduContent() {
    document.getElementById('eduContent').innerHTML = renderEduContent(this.eduKey);
  }

  /* ── Status & Toast ── */
  setStatus(msg) {
    document.getElementById('statusMsg').textContent = msg;
  }

  showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className   = `toast ${type} show`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 2800);
  }
}

/* ============================================================
   6. APP BOOTSTRAP
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  window.app = new UIController();
});