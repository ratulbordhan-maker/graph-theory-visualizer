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
      ],
      // MST colors
      edgeMst:        '#00e5a0',   // accepted MST edge — vivid green
      edgeMstReject:  '#ff4444',   // rejected edge (Kruskal cycle) — red
      nodeMst:        isDark ? '#1a3a2a' : '#d0f0e4',
      nodeMstBorder:  '#00c87a',
      // Graph coloring palette (10 distinct hues)
      coloringPalette: [
        '#ff6b6b','#ffc947','#00e5a0','#7c6eff','#00bfff',
        '#ff9f43','#ee5a24','#9980fa','#54a0ff','#5f27cd'
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
    if (edge.state === 'path')       { color = colors.edgePath;      width = 3;   }
    if (edge.state === 'active')     { color = colors.edgeActive;    width = 2.5; }
    if (edge.state === 'mst')        { color = colors.edgeMst;       width = 3.5; }
    if (edge.state === 'mst-reject') { color = colors.edgeMstReject; width = 1.5; dash = [4, 4]; }
    if (edge.state === 'mst-consider') { color = colors.edgeActive;  width = 2; dash = [6, 3]; }

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
    if (edge.weight !== 1 || edge.state === 'path' || edge.state === 'mst') {
      const mx = (from.x + curveMid.x * 2 + to.x) / 4;
      const my = (from.y + curveMid.y * 2 + to.y) / 4;
      const hlColor = edge.state === 'mst' ? colors.edgeMst : (edge.state === 'path' ? colors.edgePath : null);
      this._drawWeightLabel(mx, my, edge.weight, colors.weight, hlColor);
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
      case 'mst':
        fill = colors.nodeMst; stroke = colors.nodeMstBorder; lw = 3; glow = colors.nodeMstBorder; break;
      case 'colored':
        fill = node._colorFill; stroke = node._colorBorder; lw = 2.5; glow = node._colorBorder; break;
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

    // Color index badge for graph-coloring state
    if (node.state === 'colored' && node._colorIndex !== undefined) {
      const badgeR = 8 / this.scale;
      const bx = node.x + (R - 4) / this.scale;
      const by = node.y - (R - 4) / this.scale;
      ctx.beginPath();
      ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = node._colorBorder;
      ctx.fill();
      ctx.font = `700 ${9 / this.scale}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#0d0f14';
      ctx.fillText(String(node._colorIndex + 1), bx, by);
    }
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
   2b. UNDO / REDO MANAGER
   ============================================================ */
class UndoRedoManager {
  constructor(maxHistory = 60) {
    this.stack   = [];
    this.redoStack = [];
    this.maxHistory = maxHistory;
  }

  /** Snapshot the current graph state */
  snapshot(graph) {
    const state = JSON.stringify(graph.toJSON());
    if (this.stack.length && this.stack[this.stack.length - 1] === state) return;
    this.stack.push(state);
    if (this.stack.length > this.maxHistory) this.stack.shift();
    this.redoStack = []; // clear redo on new action
  }

  canUndo() { return this.stack.length > 1; }
  canRedo() { return this.redoStack.length > 0; }

  undo(graph) {
    if (!this.canUndo()) return false;
    const current = this.stack.pop();
    this.redoStack.push(current);
    const prev = this.stack[this.stack.length - 1];
    graph.fromJSON(JSON.parse(prev));
    return true;
  }

  redo(graph) {
    if (!this.canRedo()) return false;
    const next = this.redoStack.pop();
    this.stack.push(next);
    graph.fromJSON(JSON.parse(next));
    return true;
  }
}

/* ============================================================
   2c. PRESET GRAPHS
   ============================================================ */
const GRAPH_PRESETS = {
  binaryTree: {
    name: 'Binary Tree',
    directed: false,
    nodes: [
      {id:0,x:400,y:80},{id:1,x:220,y:180},{id:2,x:580,y:180},
      {id:3,x:130,y:280},{id:4,x:310,y:280},{id:5,x:490,y:280},{id:6,x:670,y:280}
    ],
    edges: [{from:0,to:1,w:1},{from:0,to:2,w:1},{from:1,to:3,w:1},{from:1,to:4,w:1},{from:2,to:5,w:1},{from:2,to:6,w:1}]
  },
  completeK5: {
    name: 'Complete Graph K5',
    directed: false,
    nodes: Array.from({length:5},(_,i)=>({id:i,x:400+180*Math.cos(i*2*Math.PI/5 - Math.PI/2),y:200+160*Math.sin(i*2*Math.PI/5 - Math.PI/2)})),
    edges: [{from:0,to:1,w:3},{from:0,to:2,w:5},{from:0,to:3,w:4},{from:0,to:4,w:6},{from:1,to:2,w:2},{from:1,to:3,w:7},{from:1,to:4,w:3},{from:2,to:3,w:2},{from:2,to:4,w:5},{from:3,to:4,w:4}]
  },
  completeK4: {
    name: 'Complete Graph K4',
    directed: false,
    nodes: Array.from({length:4},(_,i)=>({id:i,x:400+150*Math.cos(i*2*Math.PI/4 - Math.PI/4),y:200+150*Math.sin(i*2*Math.PI/4 - Math.PI/4)})),
    edges: [{from:0,to:1,w:2},{from:0,to:2,w:4},{from:0,to:3,w:3},{from:1,to:2,w:1},{from:1,to:3,w:5},{from:2,to:3,w:2}]
  },
  grid: {
    name: 'Grid Graph (3×3)',
    directed: false,
    nodes: [
      {id:0,x:200,y:100},{id:1,x:380,y:100},{id:2,x:560,y:100},
      {id:3,x:200,y:220},{id:4,x:380,y:220},{id:5,x:560,y:220},
      {id:6,x:200,y:340},{id:7,x:380,y:340},{id:8,x:560,y:340}
    ],
    edges: [
      {from:0,to:1,w:1},{from:1,to:2,w:1},{from:3,to:4,w:1},{from:4,to:5,w:1},
      {from:6,to:7,w:1},{from:7,to:8,w:1},{from:0,to:3,w:1},{from:3,to:6,w:1},
      {from:1,to:4,w:1},{from:4,to:7,w:1},{from:2,to:5,w:1},{from:5,to:8,w:1}
    ]
  },
  roadNetwork: {
    name: 'Weighted Road Network',
    directed: false,
    nodes: [
      {id:0,x:150,y:100},{id:1,x:380,y:80},{id:2,x:600,y:120},
      {id:3,x:200,y:250},{id:4,x:420,y:230},{id:5,x:630,y:280},
      {id:6,x:280,y:360},{id:7,x:510,y:380}
    ],
    edges: [
      {from:0,to:1,w:5},{from:1,to:2,w:3},{from:0,to:3,w:7},{from:1,to:4,w:4},
      {from:2,to:5,w:6},{from:3,to:4,w:2},{from:4,to:5,w:8},{from:3,to:6,w:3},
      {from:4,to:7,w:5},{from:5,to:7,w:4},{from:6,to:7,w:6}
    ]
  },
  dag: {
    name: 'DAG Example',
    directed: true,
    nodes: [
      {id:0,x:150,y:200},{id:1,x:320,y:100},{id:2,x:320,y:300},
      {id:3,x:490,y:100},{id:4,x:490,y:300},{id:5,x:660,y:200}
    ],
    edges: [
      {from:0,to:1,w:3},{from:0,to:2,w:2},{from:1,to:3,w:4},{from:1,to:4,w:1},
      {from:2,to:4,w:5},{from:3,to:5,w:2},{from:4,to:5,w:3}
    ]
  },
  petersen: {
    name: 'Petersen Graph',
    directed: false,
    nodes: [
      ...Array.from({length:5},(_,i)=>({id:i,  x:400+170*Math.cos(i*2*Math.PI/5-Math.PI/2), y:210+160*Math.sin(i*2*Math.PI/5-Math.PI/2)})),
      ...Array.from({length:5},(_,i)=>({id:i+5,x:400+ 80*Math.cos(i*2*Math.PI/5-Math.PI/2), y:210+ 75*Math.sin(i*2*Math.PI/5-Math.PI/2)}))
    ],
    edges: [
      {from:0,to:1,w:1},{from:1,to:2,w:1},{from:2,to:3,w:1},{from:3,to:4,w:1},{from:4,to:0,w:1},
      {from:5,to:7,w:1},{from:7,to:9,w:1},{from:9,to:6,w:1},{from:6,to:8,w:1},{from:8,to:5,w:1},
      {from:0,to:5,w:1},{from:1,to:6,w:1},{from:2,to:7,w:1},{from:3,to:8,w:1},{from:4,to:9,w:1}
    ]
  }
};

function loadPreset(key, graph, renderer) {
  const preset = GRAPH_PRESETS[key];
  if (!preset) return;
  const nextId = Math.max(...preset.nodes.map(n=>n.id)) + 1;
  const labels = {};
  // Rebuild as toJSON format
  const jsonData = {
    directed: preset.directed,
    nextId,
    nodes: preset.nodes.map(n => {
      const tmp = new Node(n.id, n.x, n.y);
      labels[n.id] = tmp.label;
      return {id:n.id, x:n.x, y:n.y, label:tmp.label};
    }),
    edges: preset.edges.map(e => ({from:e.from, to:e.to, weight:e.w}))
  };
  graph.fromJSON(jsonData);
  graph.directed = preset.directed;
  graph.edges.forEach(e => e.directed = preset.directed);
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

  /**
   * Prim's MST — Greedy MST from a start node.
   * Works on undirected graphs. Returns step array + total cost.
   * Steps: source | mst-consider | mst-accept | mst-info
   */
  primMST(startId) {
    const steps   = [];
    const inMST   = new Set();
    const dist    = {};   // node → min edge weight to reach it
    const parent  = {};   // node → parent id
    const parentEdge = {}; // node → edge object

    for (const [id] of this.graph.nodes) {
      dist[id] = Infinity;
      parent[id] = null;
    }
    dist[startId] = 0;

    let totalCost = 0;
    const mstEdges = [];

    steps.push({ type: 'source', id: startId });

    while (inMST.size < this.graph.nodes.size) {
      // Pick minimum-dist node not yet in MST
      let u = null;
      for (const [id] of this.graph.nodes) {
        if (!inMST.has(id) && (u === null || dist[id] < dist[u])) u = id;
      }
      if (u === null || dist[u] === Infinity) break;

      inMST.add(u);
      totalCost += dist[u];

      if (parent[u] !== null && parentEdge[u]) {
        mstEdges.push(parentEdge[u]);
        steps.push({
          type:      'mst-accept',
          id:        u,
          fromId:    parent[u],
          edge:      parentEdge[u],
          cost:      dist[u],
          totalCost,
          pqSnapshot: this._primPQSnapshot(dist, inMST)
        });
      } else {
        steps.push({ type: 'current', id: u });
      }

      // Relax neighbors — update priority queue
      for (const nb of this.graph.getNeighbors(u)) {
        if (!inMST.has(nb.id)) {
          steps.push({ type: 'mst-consider', id: nb.id, fromId: u, edge: nb.edge, cost: nb.weight });
          if (nb.weight < dist[nb.id]) {
            dist[nb.id]    = nb.weight;
            parent[nb.id]  = u;
            parentEdge[nb.id] = nb.edge;
          }
        }
      }
    }

    steps.push({ type: 'mst-info', totalCost, mstEdges });
    return { steps, totalCost, mstEdges };
  }

  /** Build a snapshot of the current priority queue (for Learning Mode display) */
  _primPQSnapshot(dist, inMST) {
    const snap = [];
    for (const [id, node] of this.graph.nodes) {
      if (!inMST.has(id) && dist[id] < Infinity) {
        snap.push({ label: node.label, dist: dist[id] });
      }
    }
    return snap.sort((a, b) => a.dist - b.dist);
  }

  /**
   * Kruskal's MST — Sort all edges, union-find to avoid cycles.
   * Returns step array + total cost.
   * Steps: kruskal-sort | mst-consider | mst-accept | mst-reject | mst-info
   */
  kruskalMST() {
    const steps = [];

    // Sort edges by weight (undirected — deduplicate by canonical pair)
    const seen   = new Set();
    const sorted = [];
    for (const e of this.graph.edges) {
      const key = Math.min(e.from, e.to) + '_' + Math.max(e.from, e.to);
      if (!seen.has(key)) { seen.add(key); sorted.push(e); }
    }
    sorted.sort((a, b) => a.weight - b.weight);

    steps.push({ type: 'kruskal-sort', edges: sorted.map(e => ({ from: e.from, to: e.to, weight: e.weight })) });

    // Union-Find
    const parent = {};
    const rank   = {};
    for (const [id] of this.graph.nodes) { parent[id] = id; rank[id] = 0; }

    const find = (x) => {
      if (parent[x] !== x) parent[x] = find(parent[x]);
      return parent[x];
    };
    const union = (x, y) => {
      const rx = find(x), ry = find(y);
      if (rx === ry) return false;
      if (rank[rx] < rank[ry])      parent[rx] = ry;
      else if (rank[rx] > rank[ry]) parent[ry] = rx;
      else { parent[ry] = rx; rank[rx]++; }
      return true;
    };

    let totalCost = 0;
    const mstEdges = [];
    let edgesAdded = 0;
    const nodeCount = this.graph.nodes.size;

    for (const edge of sorted) {
      if (edgesAdded === nodeCount - 1) break;

      const ufSnap = this._kruskalUFSnapshot(parent);
      steps.push({ type: 'mst-consider', id: edge.to, fromId: edge.from, edge, cost: edge.weight, ufSnapshot: ufSnap });

      if (union(edge.from, edge.to)) {
        totalCost += edge.weight;
        mstEdges.push(edge);
        edgesAdded++;
        steps.push({
          type:      'mst-accept',
          id:        edge.to,
          fromId:    edge.from,
          edge,
          cost:      edge.weight,
          totalCost,
          ufSnapshot: this._kruskalUFSnapshot(parent)
        });
      } else {
        steps.push({ type: 'mst-reject', id: edge.to, fromId: edge.from, edge });
      }
    }

    steps.push({ type: 'mst-info', totalCost, mstEdges });
    return { steps, totalCost, mstEdges };
  }

  /** Snapshot of union-find components for display */
  _kruskalUFSnapshot(parent) {
    const groups = {};
    for (const [id, node] of this.graph.nodes) {
      let root = id;
      let p = { ...parent };
      // Path-compress manually without mutating
      const visited = [];
      while (p[root] !== root) { visited.push(root); root = p[root]; }
      const rootLabel = this.graph.nodes.get(root)?.label || String(root);
      if (!groups[rootLabel]) groups[rootLabel] = [];
      groups[rootLabel].push(node.label);
    }
    return groups;
  }

  /**
   * Greedy Graph Coloring.
   * Returns steps array + colorAssignments map.
   * Steps: color-assign
   */
  greedyColor() {
    const steps = [];
    const colorOf = {};   // nodeId → colorIndex

    for (const [id, node] of this.graph.nodes) {
      const neighborColors = new Set(
        this.graph.getNeighbors(id)
          .filter(n => colorOf[n.id] !== undefined)
          .map(n => colorOf[n.id])
      );
      let c = 0;
      while (neighborColors.has(c)) c++;
      colorOf[id] = c;

      const usedCount = new Set(Object.values(colorOf)).size;
      steps.push({
        type:       'color-assign',
        id,
        colorIndex: c,
        colorsUsed: usedCount,
        reason:     `Node ${node.label} gets color ${c + 1} (neighbors use: ${[...neighborColors].map(x=>x+1).join(', ') || 'none'})`
      });
    }

    const chromaticNumber = new Set(Object.values(colorOf)).size;
    return { steps, colorOf, chromaticNumber };
  }

  /**
   * A* Pathfinding — uses Euclidean distance as heuristic h(n).
   * Returns steps + path + cost.
   * Steps: source | astar-open | astar-closed | astar-current | astar-relax | astar-path
   */
  astar(sourceId, destId) {
    const steps = [];
    const destNode = this.graph.nodes.get(destId);
    const sourceNode = this.graph.nodes.get(sourceId);
    if (!destNode || !sourceNode) return { steps, path: [], pathEdges: [], cost: Infinity };

    const heuristic = (id) => {
      const n = this.graph.nodes.get(id);
      if (!n) return 0;
      const dx = n.x - destNode.x;
      const dy = n.y - destNode.y;
      return Math.sqrt(dx*dx + dy*dy) * 0.05; // scale to graph weight range
    };

    const gScore  = {};   // cost from start
    const fScore  = {};   // g + h
    const prev    = {};
    const prevEdge= {};
    const openSet = new Set();
    const closedSet = new Set();

    for (const [id] of this.graph.nodes) {
      gScore[id] = Infinity;
      fScore[id] = Infinity;
      prev[id]   = null;
    }
    gScore[sourceId] = 0;
    fScore[sourceId] = heuristic(sourceId);
    openSet.add(sourceId);

    steps.push({ type: 'source', id: sourceId });

    while (openSet.size > 0) {
      // Pick node in openSet with lowest fScore
      let current = null;
      for (const id of openSet) {
        if (current === null || fScore[id] < fScore[current]) current = id;
      }

      if (current === destId) {
        // Reconstruct path
        const path = [];
        const pathEdges = [];
        let c = destId;
        while (c !== null) {
          path.unshift(c);
          if (prevEdge[c]) pathEdges.unshift(prevEdge[c]);
          c = prev[c];
        }
        steps.push({
          type: 'astar-path',
          path,
          pathEdges,
          cost: gScore[destId]
        });
        return { steps, path, pathEdges, cost: gScore[destId] };
      }

      openSet.delete(current);
      closedSet.add(current);

      const g = gScore[current];
      const h = heuristic(current);
      const f = fScore[current];
      steps.push({
        type:    'astar-current',
        id:      current,
        g:       +g.toFixed(2),
        h:       +h.toFixed(2),
        f:       +f.toFixed(2),
        openSnap:  [...openSet].map(id => ({
          label: this.graph.nodes.get(id)?.label || '?',
          f: +fScore[id].toFixed(2)
        })),
        closedSnap: [...closedSet].map(id => this.graph.nodes.get(id)?.label || '?')
      });

      for (const nb of this.graph.getNeighbors(current)) {
        if (closedSet.has(nb.id)) continue;
        const tentativeG = gScore[current] + nb.weight;
        if (!openSet.has(nb.id)) openSet.add(nb.id);
        else if (tentativeG >= gScore[nb.id]) continue;

        prev[nb.id]     = current;
        prevEdge[nb.id] = nb.edge;
        gScore[nb.id]   = tentativeG;
        fScore[nb.id]   = tentativeG + heuristic(nb.id);

        steps.push({
          type:    'astar-relax',
          id:      nb.id,
          fromId:  current,
          edge:    nb.edge,
          g:       +gScore[nb.id].toFixed(2),
          h:       +heuristic(nb.id).toFixed(2),
          f:       +fScore[nb.id].toFixed(2)
        });
      }
    }

    // No path found
    steps.push({ type: 'astar-no-path' });
    return { steps, path: [], pathEdges: [], cost: Infinity };
  }

  /**
   * Bellman-Ford — supports negative weights, detects negative cycles.
   * Steps: bf-init | bf-relax | bf-cycle | bf-done
   */
  bellmanFord(sourceId, destId) {
    const steps = [];
    const dist  = {};
    const prev  = {};
    const edgeMap = {};

    for (const [id] of this.graph.nodes) {
      dist[id] = Infinity;
      prev[id] = null;
    }
    dist[sourceId] = 0;
    steps.push({ type: 'source', id: sourceId });

    const V = this.graph.nodes.size;
    // Deduplicate edges for undirected
    const allEdges = this.graph.directed
      ? this.graph.edges
      : (() => {
          const seen = new Set();
          const out = [];
          for (const e of this.graph.edges) {
            const k = Math.min(e.from,e.to)+'_'+Math.max(e.from,e.to);
            if (!seen.has(k)) { seen.add(k); out.push(e); out.push({from:e.to,to:e.from,weight:e.weight,_orig:e}); }
          }
          return out;
        })();

    for (let i = 0; i < V - 1; i++) {
      for (const edge of allEdges) {
        if (dist[edge.from] === Infinity) continue;
        const alt = dist[edge.from] + edge.weight;
        if (alt < dist[edge.to]) {
          dist[edge.to] = alt;
          prev[edge.to] = edge.from;
          edgeMap[edge.to] = edge._orig || edge;
          steps.push({ type: 'bf-relax', id: edge.to, fromId: edge.from, edge: edge._orig||edge, newDist: alt, iteration: i+1 });
        }
      }
    }

    // Check for negative cycles
    let hasNegCycle = false;
    for (const edge of allEdges) {
      if (dist[edge.from] !== Infinity && dist[edge.from] + edge.weight < dist[edge.to]) {
        hasNegCycle = true;
        steps.push({ type: 'bf-cycle', edge: edge._orig||edge });
        break;
      }
    }

    if (!hasNegCycle) {
      // Reconstruct path
      const path = [];
      const pathEdges = [];
      let cur = destId;
      while (cur !== null && cur !== undefined) {
        path.unshift(cur);
        if (edgeMap[cur]) pathEdges.unshift(edgeMap[cur]);
        if (cur === sourceId) break;
        cur = prev[cur];
      }
      const pathValid = path.length > 0 && path[0] === sourceId;
      steps.push({ type: 'bf-done', path: pathValid ? path : [], pathEdges, cost: dist[destId] });
      return { steps, path: pathValid ? path : [], pathEdges, cost: dist[destId], hasNegCycle: false };
    }
    steps.push({ type: 'bf-done', path: [], pathEdges: [], cost: Infinity, hasNegCycle: true });
    return { steps, path: [], pathEdges: [], cost: Infinity, hasNegCycle: true };
  }

  /**
   * Topological Sort — DFS-based.
   * Steps: topo-visit | topo-push | topo-done
   */
  topoSortDFS() {
    const steps = [];
    const visited = new Set();
    const onStack = new Set();
    const order = [];
    let hasCycle = false;

    const dfs = (id) => {
      if (hasCycle) return;
      visited.add(id);
      onStack.add(id);
      steps.push({ type: 'topo-visit', id });
      for (const nb of this.graph.getNeighbors(id)) {
        if (!visited.has(nb.id)) {
          dfs(nb.id);
        } else if (onStack.has(nb.id)) {
          hasCycle = true;
          steps.push({ type: 'topo-cycle' });
          return;
        }
      }
      onStack.delete(id);
      order.unshift(id);
      steps.push({ type: 'topo-push', id, order: [...order] });
    };

    for (const [id] of this.graph.nodes) {
      if (!visited.has(id) && !hasCycle) dfs(id);
    }

    steps.push({ type: 'topo-done', order, hasCycle });
    return { steps, order, hasCycle };
  }

  /**
   * Topological Sort — Kahn's Algorithm (BFS-based).
   * Steps: kahn-queue | kahn-process | kahn-done
   */
  topoSortKahn() {
    const steps = [];
    const inDegree = {};
    for (const [id] of this.graph.nodes) inDegree[id] = 0;
    for (const e of this.graph.edges) {
      inDegree[e.to] = (inDegree[e.to] || 0) + 1;
    }

    const queue = [];
    for (const [id] of this.graph.nodes) {
      if (inDegree[id] === 0) queue.push(id);
    }
    steps.push({ type: 'kahn-queue', queue: [...queue] });

    const order = [];
    while (queue.length > 0) {
      const u = queue.shift();
      order.push(u);
      steps.push({ type: 'kahn-process', id: u, order: [...order] });
      for (const nb of this.graph.getNeighbors(u)) {
        inDegree[nb.id]--;
        if (inDegree[nb.id] === 0) {
          queue.push(nb.id);
          steps.push({ type: 'kahn-queue', queue: [...queue] });
        }
      }
    }

    const hasCycle = order.length !== this.graph.nodes.size;
    steps.push({ type: 'topo-done', order, hasCycle });
    return { steps, order, hasCycle };
  }

} // end AlgorithmEngine

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
  },
  prim: {
    title: "Prim's Minimum Spanning Tree",
    description: "Prim's algorithm builds a Minimum Spanning Tree (MST) by greedily adding the cheapest edge that connects the growing MST to an unvisited node. It uses a priority queue to always pick the minimum-weight crossing edge.",
    time: 'O(E log V)',
    space: 'O(V)',
    steps: [
      'Start from any node, add it to the MST',
      'From all edges crossing the cut, pick the minimum weight',
      'Add the chosen edge and its new node to the MST',
      'Repeat until all nodes are included'
    ],
    applications: ['Network cable layout', 'Road/utility infrastructure', 'Cluster analysis', 'Circuit board routing', 'Image segmentation']
  },
  kruskal: {
    title: "Kruskal's Minimum Spanning Tree",
    description: "Kruskal's algorithm builds an MST by sorting all edges by weight and adding them one by one, skipping edges that would create a cycle. It uses a Union-Find (Disjoint Set Union) data structure to detect cycles efficiently.",
    time: 'O(E log E)',
    space: 'O(V)',
    steps: [
      'Sort all edges by weight (ascending)',
      'Pick the smallest edge not yet processed',
      'If it connects two different components, add it to MST',
      'Otherwise reject it (would form a cycle)',
      'Repeat until MST has V-1 edges'
    ],
    applications: ['Network design', 'Power grid construction', 'Approximation algorithms', 'Data clustering', 'Maze generation']
  },
  coloring: {
    title: 'Greedy Graph Coloring',
    description: 'Graph coloring assigns colors to vertices such that no two adjacent vertices share the same color. The greedy algorithm assigns the smallest valid color to each vertex in order. The minimum number of colors needed is the chromatic number χ(G).',
    time: 'O(V + E)',
    space: 'O(V)',
    steps: [
      'Process each node in order',
      'Find which colors are used by its already-colored neighbors',
      'Assign the smallest color not used by any neighbor',
      'Track the total number of distinct colors used',
      'The result is the chromatic number'
    ],
    applications: ['Exam / class scheduling', 'Map coloring (4-color theorem)', 'CPU register allocation', 'Frequency assignment in radio', 'Sudoku solving']
  },
  astar: {
    title: 'A* Pathfinding',
    description: "A* is an informed search algorithm that finds the shortest path using a heuristic h(n) to guide exploration. It evaluates nodes by f(n) = g(n) + h(n), where g(n) is the exact cost from start and h(n) is the estimated cost to goal. With an admissible heuristic (never overestimates), A* is both optimal and complete.",
    time: 'O(E log V)',
    space: 'O(V)',
    steps: [
      'Add source to open set with f = h(source)',
      'Pick node with lowest f(n) from open set',
      'If it is the destination, reconstruct and return path',
      'Move it to closed set; relax all neighbors',
      'Update g, h, f for each neighbor if a shorter path found',
      'Repeat until destination reached or open set is empty'
    ],
    applications: ['Game AI pathfinding', 'GPS navigation', 'Robot motion planning', 'Network routing', 'Puzzle solving (15-puzzle, etc.)'],
    interview: ['What makes A* optimal?', 'What is an admissible heuristic?', 'How does A* differ from Dijkstra?', 'When would you use A* over BFS?']
  },
  bellmanford: {
    title: 'Bellman-Ford Algorithm',
    description: "Bellman-Ford finds shortest paths from a source to all vertices in a weighted graph. Unlike Dijkstra, it handles negative edge weights and can detect negative-weight cycles. It works by relaxing all edges V-1 times, where V is the number of vertices.",
    time: 'O(V × E)',
    space: 'O(V)',
    steps: [
      'Initialize dist[source] = 0, all others = ∞',
      'Repeat V-1 times: relax every edge (u,v,w)',
      'If dist[u] + w < dist[v], update dist[v] = dist[u] + w',
      'After V-1 iterations, check all edges again',
      'If any edge can still be relaxed → negative cycle detected'
    ],
    applications: ['Network routing (RIP protocol)', 'Currency arbitrage detection', 'Shortest paths with debt/credits', 'Financial modeling', 'Traffic network analysis with tolls/credits'],
    interview: ['Why relax edges V-1 times?', 'How does Bellman-Ford detect negative cycles?', 'Can Dijkstra handle negative weights? Why not?', 'What is the time complexity vs Dijkstra?', 'When would you choose Bellman-Ford over Dijkstra?']
  },
  toposort: {
    title: 'Topological Sort',
    description: "Topological sorting linearly orders the vertices of a directed acyclic graph (DAG) such that for every directed edge (u→v), vertex u comes before v. It has two main implementations: DFS-based (post-order push) and Kahn's algorithm (BFS with in-degree counting). Only valid for DAGs — any cycle makes topological ordering impossible.",
    time: 'O(V + E)',
    space: 'O(V)',
    steps: [
      'DFS approach: run DFS and push nodes to stack in finishing order',
      'Return reverse of DFS finishing order',
      "Kahn's: compute in-degree for all nodes",
      "Enqueue all zero-in-degree nodes",
      "Dequeue, append to result, decrement neighbors' in-degrees",
      "If any node has in-degree 0 after decrement, enqueue it",
      'If result length < V, a cycle exists'
    ],
    applications: ['Build system task scheduling', 'Course prerequisite ordering', 'Compilation dependency resolution', 'Spreadsheet formula evaluation', 'Package manager dependency order'],
    interview: ['What is a DAG?', 'Why can you not topologically sort a graph with cycles?', "What is the difference between DFS-based and Kahn's algorithm?", "How do you detect a cycle using Kahn's algorithm?", 'Is topological sort unique? When is it?']
  }
};

function renderEduContent(key) {
  const data = EDU_DATA[key];
  if (!data) return '';
  const interviewSection = data.interview ? `
    <h4>Common Interview Questions</h4>
    <ul class="interview-list">
      ${data.interview.map(q => `<li>${q}</li>`).join('')}
    </ul>` : '';
  return `
    <h4>${data.title}</h4>
    <p>${data.description}</p>
    <div class="complexity-row">
      <span class="complexity-badge">⏱ Time: ${data.time}</span>
      <span class="complexity-badge space">💾 Space: ${data.space}</span>
    </div>
    <h4>Algorithm Steps</h4>
    <ul>
      ${data.steps.map(s => `<li>${s}</li>`).join('')}
    </ul>
    <h4>Real-World Applications</h4>
    <div class="app-list">
      ${data.applications.map(a => `<span class="app-tag">${a}</span>`).join('')}
    </div>
    ${interviewSection}
  `;
}

/* ── Pseudocode Definitions ── */
// Each entry: { lines: string[], syntax: 'keyword'|'loop'|'condition'|'function'|'variable'|'comment'|'default' per line }
const PSEUDOCODE = {
  bfs: {
    lines: [
      'function BFS(graph G, source s):',
      '  queue Q ← empty queue',
      '  visited ← empty set',
      '  Q.enqueue(s)',
      '  visited.add(s)',
      '  while Q is not empty do',
      '    u ← Q.dequeue()',
      '    for each neighbor v of u do',
      '      if v ∉ visited then',
      '        visited.add(v)',
      '        Q.enqueue(v)',
      '  return visited'
    ],
    types: ['function','variable','variable','variable','variable','loop','variable','loop','condition','variable','variable','keyword']
  },
  dfs: {
    lines: [
      'function DFS(graph G, node u, visited):',
      '  visited.add(u)',
      '  for each neighbor v of u do',
      '    if v ∉ visited then',
      '      DFS(G, v, visited)',
      '  return visited'
    ],
    types: ['function','variable','loop','condition','function','keyword']
  },
  dijkstra: {
    lines: [
      'function Dijkstra(graph G, source s):',
      '  for each node v in G do',
      '    dist[v] ← ∞',
      '  dist[s] ← 0',
      '  Q ← priority queue of all nodes',
      '  while Q is not empty do',
      '    u ← Q.extractMin()',
      '    for each neighbor v of u do',
      '      alt ← dist[u] + weight(u, v)',
      '      if alt < dist[v] then',
      '        dist[v] ← alt',
      '        prev[v] ← u',
      '        Q.decreaseKey(v, alt)',
      '  return dist, prev'
    ],
    types: ['function','loop','variable','variable','variable','loop','variable','loop','variable','condition','variable','variable','variable','keyword']
  },
  components: {
    lines: [
      'function ConnectedComponents(graph G):',
      '  visited ← empty set',
      '  components ← empty list',
      '  for each node u in G do',
      '    if u ∉ visited then',
      '      comp ← BFS(G, u)',
      '      components.append(comp)',
      '      visited.union(comp)',
      '  return components'
    ],
    types: ['function','variable','variable','loop','condition','variable','variable','variable','keyword']
  },
  prim: {
    lines: [
      'function Prim(graph G, start s):',
      '  inMST ← empty set',
      '  for each node v in G do',
      '    dist[v] ← ∞',
      '  dist[s] ← 0',
      '  while |inMST| < |V| do',
      '    u ← node not in MST with min dist[u]',
      '    inMST.add(u)',
      '    for each neighbor v of u do',
      '      if v ∉ inMST and weight(u,v) < dist[v] then',
      '        dist[v] ← weight(u, v)',
      '        parent[v] ← u',
      '  return MST edges'
    ],
    types: ['function','variable','loop','variable','variable','loop','variable','variable','loop','condition','variable','variable','keyword']
  },
  kruskal: {
    lines: [
      'function Kruskal(graph G):',
      '  sort all edges by weight ascending',
      '  DSU ← makeSet(each node)',
      '  MST ← empty list',
      '  for each edge (u, v, w) in sorted order do',
      '    if DSU.find(u) ≠ DSU.find(v) then',
      '      MST.add(u, v, w)',
      '      DSU.union(u, v)',
      '    else',
      '      // reject: would form a cycle',
      '  return MST'
    ],
    types: ['function','variable','variable','variable','loop','condition','variable','variable','keyword','comment','keyword']
  },
  coloring: {
    lines: [
      'function GreedyColor(graph G):',
      '  color ← empty map',
      '  for each node u in G do',
      '    neighborColors ← {color[v] : v ∈ neighbors(u)}',
      '    c ← smallest integer ∉ neighborColors',
      '    color[u] ← c',
      '  χ(G) ← |distinct values in color|',
      '  return color, χ(G)'
    ],
    types: ['function','variable','loop','variable','variable','variable','variable','keyword']
  },
  astar: {
    lines: [
      'function AStar(graph G, source s, dest d):',
      '  openSet ← {s}',
      '  g[s] ← 0',
      '  f[s] ← h(s)',
      '  while openSet is not empty do',
      '    u ← node in openSet with min f[u]',
      '    if u = d then',
      '      return reconstructPath(prev, d)',
      '    openSet.remove(u)',
      '    closedSet.add(u)',
      '    for each neighbor v of u do',
      '      if v ∈ closedSet then continue',
      '      tentG ← g[u] + weight(u, v)',
      '      if tentG < g[v] then',
      '        g[v] ← tentG',
      '        f[v] ← g[v] + h(v)',
      '        prev[v] ← u',
      '  return "no path found"'
    ],
    types: ['function','variable','variable','variable','loop','variable','condition','keyword','variable','variable','loop','condition','variable','condition','variable','variable','variable','keyword']
  },
  bellmanford: {
    lines: [
      'function BellmanFord(graph G, source s):',
      '  for each node v in G do',
      '    dist[v] ← ∞',
      '  dist[s] ← 0',
      '  for i from 1 to |V| - 1 do',
      '    for each edge (u, v, w) in G do',
      '      if dist[u] + w < dist[v] then',
      '        dist[v] ← dist[u] + w',
      '        prev[v] ← u',
      '  // Check for negative-weight cycles',
      '  for each edge (u, v, w) in G do',
      '    if dist[u] + w < dist[v] then',
      '      return "negative cycle detected"',
      '  return dist, prev'
    ],
    types: ['function','loop','variable','variable','loop','loop','condition','variable','variable','comment','loop','condition','keyword','keyword']
  },
  toposort_dfs: {
    lines: [
      'function TopoSort_DFS(graph G):',
      '  visited ← empty set',
      '  stack ← empty stack',
      '  function dfs(node u):',
      '    visited.add(u)',
      '    for each neighbor v of u do',
      '      if v ∉ visited then',
      '        dfs(v)',
      '    stack.push(u)',
      '  for each node u in G do',
      '    if u ∉ visited then',
      '      dfs(u)',
      '  return stack.reversed()'
    ],
    types: ['function','variable','variable','function','variable','loop','condition','function','variable','loop','condition','function','keyword']
  },
  toposort_kahn: {
    lines: [
      'function KahnTopoSort(graph G):',
      '  inDegree[v] ← 0 for all v',
      '  for each edge (u, v) in G do',
      '    inDegree[v] ← inDegree[v] + 1',
      '  queue Q ← {v : inDegree[v] = 0}',
      '  result ← empty list',
      '  while Q is not empty do',
      '    u ← Q.dequeue()',
      '    result.append(u)',
      '    for each neighbor v of u do',
      '      inDegree[v] ← inDegree[v] - 1',
      '      if inDegree[v] = 0 then',
      '        Q.enqueue(v)',
      '  if |result| ≠ |V| then',
      '    return "cycle detected — no topo order"',
      '  return result'
    ],
    types: ['function','variable','loop','variable','variable','variable','loop','variable','variable','loop','variable','condition','variable','condition','keyword','keyword']
  }
};

/** Syntax-color a single pseudocode token */
function _pcColorize(text, lineType) {
  // escape HTML
  let s = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  if (lineType === 'comment') {
    return `<span class="pc-comment">${s}</span>`;
  }
  if (lineType === 'function') {
    // color the function keyword and function name differently
    s = s.replace(/^(function)\s+(\w+)/, '<span class="pc-kw">$1</span> <span class="pc-fn">$2</span>');
  }

  // Keywords
  s = s.replace(/\b(return|if|then|else|do|not)\b/g, '<span class="pc-kw">$1</span>');
  // Loop keywords
  s = s.replace(/\b(while|for|each|from|to)\b/g, '<span class="pc-loop">$1</span>');
  // Condition keywords
  s = s.replace(/\b(and|or|in|of)\b/g, '<span class="pc-cond">$1</span>');
  // Assignment arrow
  s = s.replace(/(←)/g, '<span class="pc-op">$1</span>');
  // Numbers and infinity
  s = s.replace(/\b(\d+|∞|Infinity)\b/g, '<span class="pc-num">$1</span>');
  // String literals
  s = s.replace(/"([^"]+)"/g, '<span class="pc-str">"$1"</span>');
  // Set/map ops: .add .remove .enqueue .dequeue etc
  s = s.replace(/\.([a-zA-Z]+)\(/g, '<span class="pc-method">.$1</span>(');

  return s;
}

/** Build the pseudocode HTML block */
function buildPseudocodeHTML(key, activeLine = -1) {
  const entry = PSEUDOCODE[key];
  if (!entry) return '<p class="empty-msg">Select an algorithm to view pseudocode</p>';
  const lines = entry.lines;
  const types = entry.types || [];
  const rows = lines.map((text, i) => {
    const active = i === activeLine ? ' pc-active' : '';
    const indentMatch = text.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    const padLeft = 6 + indent * 10;
    const lineType = types[i] || 'default';
    const colored = _pcColorize(text.trimStart(), lineType);
    return `<div class="pc-line${active}" style="padding-left:${padLeft}px" data-line="${i}">
      <span class="pc-line-num">${i + 1}</span>
      <span class="pc-line-text">${colored}</span>
    </div>`;
  }).join('');
  return `<div class="pc-block">${rows}</div>`;
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

    // A* state
    this.astarPhase  = null;
    this.astarSource = null;
    this.astarResult = null;

    // MST state
    this.mstResult      = null;   // { totalCost, mstEdges }

    // Coloring state
    this.coloringResult = null;   // { colorOf, chromaticNumber }

    // Comparison mode state
    this.compareMode    = false;

    // Undo/Redo
    this.undoRedo = new UndoRedoManager();

    // Topo sort mode
    this.topoMode = 'dfs'; // 'dfs' | 'kahn'

    // Bellman-Ford state
    this.bfPhase  = null;
    this.bfSource = null;

    this.eduKey = 'bfs';

    this._historyLog = [];
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

    // Snapshot initial state for undo
    this.undoRedo.snapshot(this.graph);
    this._updateUndoRedoBtns();

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); this._undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); this._redo();
      }
    });
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

    // A* node selection
    if (this.astarPhase === 'source') {
      if (node) { this._setAstarSource(node); return; }
      return;
    }
    if (this.astarPhase === 'dest') {
      if (node) { this._setAstarDest(node); return; }
      return;
    }

    // Bellman-Ford node selection
    if (this.bfPhase === 'source') {
      if (node) { this._setBFSource(node); return; }
      return;
    }
    if (this.bfPhase === 'dest') {
      if (node) { this._setBFDest(node); return; }
      return;
    }

    if (this.tool === 'addNode' && !node) {
      const newNode = this.graph.addNode(pos.x, pos.y);
      this._updateAll();
      this.undoRedo.snapshot(this.graph);
      this._updateUndoRedoBtns();
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
            this.undoRedo.snapshot(this.graph);
            this._updateUndoRedoBtns();
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
        const lbl = node.label;
        this.graph.removeNode(node.id);
        this.undoRedo.snapshot(this.graph);
        this._updateUndoRedoBtns();
        this.setStatus(`Deleted node ${lbl}`);
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
      this.undoRedo.snapshot(this.graph);
      this._updateUndoRedoBtns();
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
      this.undoRedo.snapshot(this.graph);
      this._updateUndoRedoBtns();
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
    ['algoBFS','algoDFS','algoDijkstra','algoComponents','algoPrim','algoKruskal','algoColoring','algoAstar','algoBellmanFord','algoTopoSort'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => this._selectAlgo(id));
    });

    // Undo / Redo buttons
    document.getElementById('btnUndo').addEventListener('click', () => this._undo());
    document.getElementById('btnRedo').addEventListener('click', () => this._redo());

    // PNG Export
    document.getElementById('btnExportPNG').addEventListener('click', () => this._exportPNG());

    // Preset graph dropdown
    document.getElementById('presetSelect').addEventListener('change', e => this._loadPreset(e.target.value));

    // Comparison buttons
    document.getElementById('cmpBFSDFS').addEventListener('click',      () => this._runComparison('bfs-vs-dfs'));
    document.getElementById('cmpDijkstraAstar').addEventListener('click',() => this._runComparison('dijkstra-vs-astar'));
    document.getElementById('cmpPrimKruskal').addEventListener('click',  () => this._runComparison('prim-vs-kruskal'));

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

    // ── Right Panel Tabs ──
    document.querySelectorAll('.rp-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const key = tab.dataset.rptab;
        document.querySelectorAll('.rp-tab').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.rp-tab-content').forEach(c => {
          c.classList.toggle('active', c.id === `rptab-${key}`);
        });
      });
    });

    // ── Collapsible Section Toggles ──
    this._bindCollapsible('algoExplainToggleBtn', 'algoExplainBody', 'algoExplainCollapseIcon');
    this._bindCollapsible('historyToggleBtn',     'historyLogBody',  'historyCollapseIcon');
    this._bindCollapsible('pseudocodeToggleBtn',  'pseudocodeBody',  'pseudocodeCollapseIcon');
    this._bindCollapsible('learningToggleBtn',    'learningModeBody','learningCollapseIcon');

    // ── History Log Buttons ──
    const hClear = document.getElementById('historyClearBtn');
    const hExport = document.getElementById('historyExportBtn');
    if (hClear)  hClear.addEventListener('click',  () => this._clearHistoryLog());
    if (hExport) hExport.addEventListener('click', () => this._exportHistoryLog());

    // ── Challenge Mode ──
    this._challengeScore   = 0;
    this._challengeStreak  = 0;
    this._challengeDiff    = 'easy';
    this._challengeActive  = null;
    this._historyLog       = [];

    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('active', b === btn));
        this._challengeDiff = btn.dataset.diff;
      });
    });

    const newBtn = document.getElementById('challengeNewBtn');
    const revBtn = document.getElementById('challengeRevealBtn');
    if (newBtn) newBtn.addEventListener('click', () => this._newChallenge());
    if (revBtn) revBtn.addEventListener('click', () => this._revealChallenge());

    // ── Sidebar Toggle ──
    this._leftCollapsed  = false;
    this._rightCollapsed = false;
    this._injectSidebarToggles();

    // ── Render interview panel ──
    this._renderInterviewPanel();

    // ── Focus Drawer ──
    this._initFocusDrawer();
  }

  /* ── Undo / Redo ── */
  _undo() {
    if (!this.undoRedo.canUndo()) { this.showToast('Nothing to undo', 'info'); return; }
    this.undoRedo.undo(this.graph);
    this.engine = new AlgorithmEngine(this.graph);
    this._updateAll();
    this._updateUndoRedoBtns();
    this.showToast('Undo', 'info');
    this.setStatus('Undo applied');
  }

  _redo() {
    if (!this.undoRedo.canRedo()) { this.showToast('Nothing to redo', 'info'); return; }
    this.undoRedo.redo(this.graph);
    this.engine = new AlgorithmEngine(this.graph);
    this._updateAll();
    this._updateUndoRedoBtns();
    this.showToast('Redo', 'info');
    this.setStatus('Redo applied');
  }

  _updateUndoRedoBtns() {
    const undoBtn = document.getElementById('btnUndo');
    const redoBtn = document.getElementById('btnRedo');
    if (undoBtn) undoBtn.disabled = !this.undoRedo.canUndo();
    if (redoBtn) redoBtn.disabled = !this.undoRedo.canRedo();
  }

  /* ── PNG Export ── */
  _exportPNG() {
    // Create offscreen canvas at 2x resolution
    const src = this.renderer.canvas;
    const offscreen = document.createElement('canvas');
    const scale2x = 2;
    offscreen.width  = src.width  * scale2x;
    offscreen.height = src.height * scale2x;
    const ctx2 = offscreen.getContext('2d');
    // White/dark background
    const isDark = document.body.classList.contains('dark');
    ctx2.fillStyle = isDark ? '#0d0f14' : '#f0f2f8';
    ctx2.fillRect(0, 0, offscreen.width, offscreen.height);
    // Scale and draw the graph
    ctx2.scale(scale2x, scale2x);
    ctx2.drawImage(src, 0, 0);

    offscreen.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'graphlab-export.png';
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Graph exported as PNG', 'success');
    }, 'image/png');
  }

  /* ── Load Preset ── */
  _loadPreset(key) {
    if (!key) return;
    this._stopAlgo();
    loadPreset(key, this.graph, this.renderer);
    this.graph.directed = this.graph.directed; // already set by loadPreset
    document.getElementById('btnDirected').classList.toggle('active', this.graph.directed);
    document.getElementById('btnUndirected').classList.toggle('active', !this.graph.directed);
    this.engine = new AlgorithmEngine(this.graph);
    this.undoRedo.snapshot(this.graph);
    this._updateUndoRedoBtns();
    this._updateAll();
    const name = GRAPH_PRESETS[key]?.name || key;
    this.showToast(`Loaded: ${name}`, 'success');
    this.setStatus(`Preset graph loaded: ${name}`);
    // Reset dropdown
    document.getElementById('presetSelect').value = '';
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

    const eduMap = {
      algoBFS:         'bfs',
      algoDFS:         'dfs',
      algoDijkstra:    'dijkstra',
      algoComponents:  'components',
      algoPrim:        'prim',
      algoKruskal:     'kruskal',
      algoColoring:    'coloring',
      algoAstar:       'astar',
      algoBellmanFord: 'bellmanford',
      algoTopoSort:    'toposort'
    };
    this.eduKey = eduMap[algoId] || 'bfs';
    this._updateEduContent();
    this._activateEduTab(this.eduKey);
    this._updatePseudocode(this.eduKey, -1);
    this._renderAlgoExplain(this.eduKey);
    // Open focus drawer and sync content
    if (!this._fdOpen) this._openFocusDrawer();
    else { this._syncFocusDrawer(); this._syncFdExplain(); }

    document.getElementById('traversalSection').style.display = 'none';
    document.getElementById('pathResultSection').style.display = 'none';
    document.getElementById('traversalDisplay').innerHTML = '';
    document.getElementById('mstResultSection').style.display   = 'none';
    document.getElementById('coloringResultSection').style.display = 'none';
    document.getElementById('astarResultSection').style.display    = 'none';
    // compareResult lives inside the tab panel — just clear it
    const cmpWrap = document.getElementById('compareResult');
    if (cmpWrap) cmpWrap.innerHTML = '';

    const hints = {
      algoBFS:         'Click RUN — BFS will start from the first node',
      algoDFS:         'Click RUN — DFS will start from the first node',
      algoDijkstra:    'Click RUN — then select SOURCE and DESTINATION nodes',
      algoComponents:  'Click RUN — all components will be colored',
      algoPrim:        "Click RUN — Prim's MST from first node (undirected, weighted)",
      algoKruskal:     "Click RUN — Kruskal's MST on all edges (undirected, weighted)",
      algoColoring:    'Click RUN — greedy graph coloring will be applied',
      algoAstar:       'Click RUN — then select SOURCE and DESTINATION nodes',
      algoBellmanFord: 'Click RUN — select SOURCE and DESTINATION (supports negative weights)',
      algoTopoSort:    'Click RUN — topological sort (requires directed acyclic graph)'
    };
    this.setStatus(hints[algoId] || 'Click RUN to execute');
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
      this._startDijkstraSelection();
      return false;
    } else if (this.selectedAlgo === 'algoComponents') {
      this._runComponents();
      return false;
    } else if (this.selectedAlgo === 'algoPrim') {
      if (this.graph.directed) {
        this.showToast("Prim's works on undirected graphs — switch to Undirected mode", 'error');
        return false;
      }
      const result = this.engine.primMST(firstId);
      this.mstResult  = result;
      this.algoSteps  = result.steps;
    } else if (this.selectedAlgo === 'algoKruskal') {
      if (this.graph.directed) {
        this.showToast("Kruskal's works on undirected graphs — switch to Undirected mode", 'error');
        return false;
      }
      const result = this.engine.kruskalMST();
      this.mstResult  = result;
      this.algoSteps  = result.steps;
    } else if (this.selectedAlgo === 'algoColoring') {
      this._runColoring();
      return false;
    } else if (this.selectedAlgo === 'algoAstar') {
      this._startAstarSelection();
      return false;
    } else if (this.selectedAlgo === 'algoBellmanFord') {
      this._startBellmanFordSelection();
      return false;
    } else if (this.selectedAlgo === 'algoTopoSort') {
      this._runTopoSort();
      return false;
    }
    this.stepIndex = 0;
    this.traversalOrder = [];
    this.graph.resetStates();
    document.getElementById('traversalDisplay').innerHTML = '';
    document.getElementById('traversalSection').style.display =
      (this.selectedAlgo === 'algoBFS' || this.selectedAlgo === 'algoDFS') ? 'block' : 'none';
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
    // Guard: some step types don't have a node id (kruskal-sort, mst-info)
    const node = step.id !== undefined ? this.graph.nodes.get(step.id) : null;
    // Track in history log
    if (this._historyLog !== undefined) this._addHistoryEntry(step);

    if (step.type === 'visit') {
      if (!node) return;
      node.state = 'visited';
      if (step.edge) step.edge.state = 'active';
      this.traversalOrder.push(node.label);
      this._appendTraversalNode(node.label, step.order);
      this.setStatus(`Visiting node ${node.label} (order: ${step.order + 1})`);
      if (this.selectedAlgo === 'algoBFS') this._updatePseudocode('bfs', 7);
      if (this.selectedAlgo === 'algoDFS') this._updatePseudocode('dfs', 1);
      this._updateLearningMode(step);

    } else if (step.type === 'current') {
      if (!node) return;
      this.graph.nodes.forEach(n => { if (n.state === 'current') n.state = 'visited'; });
      node.state = 'current';
      this.setStatus(`Processing node ${node.label}`);
      if (this.selectedAlgo === 'algoBFS') this._updatePseudocode('bfs', 4);
      if (this.selectedAlgo === 'algoDFS') this._updatePseudocode('dfs', 2);
      if (this.selectedAlgo === 'algoDijkstra') this._updatePseudocode('dijkstra', 5);
      this._updateLearningMode(step);

    } else if (step.type === 'relax') {
      if (!node) return;
      node.state = 'visited';
      this.setStatus(`Relaxed node ${node.label}: dist = ${step.cost}`);
      this._updatePseudocode('dijkstra', 9);
      this._updateLearningMode(step);

    } else if (step.type === 'edge') {
      if (step.edge) step.edge.state = 'active';

    } else if (step.type === 'source') {
      if (!node) return;
      node.state = 'source';
      this.setStatus(`Start node: ${node.label}`);
      if (this.selectedAlgo === 'algoPrim')    this._updatePseudocode('prim', 0);
      if (this.selectedAlgo === 'algoKruskal') this._updatePseudocode('kruskal', 0);
      if (this.selectedAlgo === 'algoAstar')   this._updatePseudocode('astar', 0);

    } else if (step.type === 'mst-consider') {
      if (step.edge) step.edge.state = 'mst-consider';
      const fromNode = step.fromId !== undefined ? this.graph.nodes.get(step.fromId) : null;
      const toNode   = node;
      const fl = fromNode ? fromNode.label : '?';
      const tl = toNode   ? toNode.label   : '?';
      this.setStatus(`Considering edge ${fl}–${tl} (weight: ${step.cost})`);
      if (this.selectedAlgo === 'algoPrim')    this._updatePseudocode('prim', 4);
      if (this.selectedAlgo === 'algoKruskal') this._updatePseudocode('kruskal', 4);
      this._updateLearningMode(step);

    } else if (step.type === 'mst-accept') {
      if (step.edge) step.edge.state = 'mst';
      if (node) node.state = 'mst';
      const fromNode = step.fromId !== undefined ? this.graph.nodes.get(step.fromId) : null;
      if (fromNode && fromNode.state !== 'source') fromNode.state = 'mst';
      this._updateMSTInfo(step.totalCost, step.pqSnapshot, step.ufSnapshot);
      this.setStatus(`✓ MST edge accepted: cost ${step.cost} | Total so far: ${step.totalCost}`);
      if (this.selectedAlgo === 'algoPrim')    this._updatePseudocode('prim', 6);
      if (this.selectedAlgo === 'algoKruskal') this._updatePseudocode('kruskal', 5);
      this._updateLearningMode(step);

    } else if (step.type === 'mst-reject') {
      if (step.edge) step.edge.state = 'mst-reject';
      const fromNode = step.fromId !== undefined ? this.graph.nodes.get(step.fromId) : null;
      const tl = node ? node.label : '?';
      const fl = fromNode ? fromNode.label : '?';
      this.setStatus(`✗ Edge ${fl}–${tl} rejected (would form cycle)`);
      this._updatePseudocode('kruskal', 8);
      this._updateLearningMode(step);

    } else if (step.type === 'kruskal-sort') {
      this.setStatus(`Edges sorted by weight: ${step.edges.map(e => {
        const fl = this.graph.nodes.get(e.from)?.label || '?';
        const tl = this.graph.nodes.get(e.to)?.label   || '?';
        return `${fl}-${tl}(${e.weight})`;
      }).join(', ')}`);
      this._updatePseudocode('kruskal', 1);

    } else if (step.type === 'mst-info') {
      this._finishMST(step.totalCost, step.mstEdges);

    } else if (step.type === 'color-assign') {
      if (!node) return;
      const colors = this.renderer.getThemeColors().coloringPalette;
      node.state       = 'colored';
      node._colorIndex = step.colorIndex;
      node._colorFill  = colors[step.colorIndex % colors.length] + '28';
      node._colorBorder= colors[step.colorIndex % colors.length];
      this._updateColoringInfo(step.colorsUsed, step.reason);
      this.setStatus(`Node ${node.label} → Color ${step.colorIndex + 1} | Colors used: ${step.colorsUsed}`);
      this._updatePseudocode('coloring', step.colorIndex === 0 ? 2 : 4);
      this._updateLearningMode(step);

    } else if (step.type === 'astar-current') {
      this.graph.nodes.forEach(n => { if (n.state === 'current') n.state = 'visited'; });
      if (node) { node.state = 'current'; }
      this.setStatus(`A* processing: ${node?.label} | g=${step.g} h=${step.h} f=${step.f}`);
      this._updatePseudocode('astar', 4);
      this._updateLearningMode(step);

    } else if (step.type === 'astar-relax') {
      if (node) node.state = 'visited';
      if (step.edge) step.edge.state = 'active';
      const fromNode = step.fromId !== undefined ? this.graph.nodes.get(step.fromId) : null;
      this.setStatus(`A* update ${node?.label}: g=${step.g} h=${step.h} f=${step.f}`);
      this._updatePseudocode('astar', 10);
      this._updateLearningMode(step);

    } else if (step.type === 'astar-path') {
      this._finishAstar(step);

    } else if (step.type === 'astar-no-path') {
      this._setRunning(false);
      document.getElementById('astarResultSection').style.display = 'block';
      document.getElementById('astarResult').innerHTML = '<span class="no-path">No path exists between selected nodes</span>';
      this.setStatus('A*: No path found');
      this.showToast('No path found!', 'error');

    /* ── Bellman-Ford steps ── */
    } else if (step.type === 'bf-relax') {
      if (!node) return;
      node.state = 'visited';
      if (step.edge) step.edge.state = 'active';
      const fromNode = step.fromId !== undefined ? this.graph.nodes.get(step.fromId) : null;
      this.setStatus(`BF Iter ${step.iteration}: Relax ${fromNode?.label||'?'}→${node.label}, dist=${step.newDist}`);
      this._updatePseudocode('bellmanford', 7);
      this._updateLearningMode(step);

    } else if (step.type === 'bf-cycle') {
      this.setStatus('⚠ Negative-weight cycle detected!');
      this.showToast('Negative cycle detected!', 'error');
      this._updatePseudocode('bellmanford', 12);

    } else if (step.type === 'bf-done') {
      this._finishBellmanFord(step);

    /* ── Topological Sort steps ── */
    } else if (step.type === 'topo-visit') {
      if (!node) return;
      node.state = 'current';
      this.setStatus(`TopoSort: visiting ${node.label}`);
      this._updatePseudocode(this.topoMode === 'kahn' ? 'toposort_kahn' : 'toposort_dfs', 3);
      this._updateLearningMode(step);

    } else if (step.type === 'topo-push') {
      if (!node) return;
      node.state = 'path';
      const orderLabels = step.order.map(id => this.graph.nodes.get(id)?.label || '?');
      this.setStatus(`TopoSort: pushed ${node.label} → order: [${orderLabels.join(', ')}]`);
      this._updatePseudocode(this.topoMode === 'kahn' ? 'toposort_kahn' : 'toposort_dfs', 8);
      this._updateLearningMode(step);

    } else if (step.type === 'kahn-queue') {
      const labels = (step.queue || []).map(id => this.graph.nodes.get(id)?.label || '?');
      this.setStatus(`Kahn's: queue = [${labels.join(', ')}]`);
      this._updatePseudocode('toposort_kahn', 4);

    } else if (step.type === 'kahn-process') {
      if (!node) return;
      node.state = 'path';
      const orderLabels = (step.order || []).map(id => this.graph.nodes.get(id)?.label || '?');
      this.setStatus(`Kahn's: process ${node.label} → result: [${orderLabels.join(', ')}]`);
      this._updatePseudocode('toposort_kahn', 7);
      this._updateLearningMode(step);

    } else if (step.type === 'topo-cycle') {
      this.setStatus('⚠ Cycle detected — topological sort not possible!');
      this.showToast('Cycle detected! Cannot topo-sort.', 'error');

    } else if (step.type === 'topo-done') {
      this._finishTopoSort(step);
    }
  }

  /* ── Pseudocode Panel ── */
  _updatePseudocode(key, activeLine) {
    const wrap = document.getElementById('pseudocodeWrap');
    if (!wrap) return;
    const block = wrap.querySelector('.pc-block');
    if (block) {
      // Update only the active class without full re-render when same key
      if (wrap.dataset.pcKey === key) {
        block.querySelectorAll('.pc-line').forEach(el => {
          const lineIdx = parseInt(el.dataset.line);
          el.classList.toggle('pc-active', lineIdx === activeLine);
        });
        const active = block.querySelector('.pc-active');
        if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        // Sync drawer
        this._syncDrawerPseudocode(key, activeLine);
        return;
      }
    }
    wrap.dataset.pcKey = key;
    wrap.innerHTML = buildPseudocodeHTML(key, activeLine);
    const active = wrap.querySelector('.pc-active');
    if (active) {
      setTimeout(() => active.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
    }
    // Sync drawer
    this._syncDrawerPseudocode(key, activeLine);
  }

  /* ── Learning Mode Panel ── */
  _updateLearningMode(step) {
    const sec  = document.getElementById('learningModeSection');
    const grid = document.getElementById('learningGrid');
    if (!sec || !grid) return;
    sec.style.display = 'block';

    if (step.type === 'visit' || step.type === 'current') {
      const isQueue = this.selectedAlgo === 'algoBFS';
      grid.innerHTML = `
        <div class="lm-row">
          <span class="lm-label">Step</span>
          <span class="lm-val step-badge">${this.stepIndex}</span>
        </div>
        <div class="lm-row">
          <span class="lm-label">Current</span>
          <span class="lm-val node-badge">${this.graph.nodes.get(step.id)?.label || '?'}</span>
        </div>
        <div class="lm-row col">
          <span class="lm-label">Visited Order</span>
          <div class="lm-chips">
            ${this.traversalOrder.map((l,i) => `<span class="lm-chip ${isQueue?'bfs':'dfs'}">${l}</span>`).join('')}
          </div>
        </div>`;

    } else if (step.type === 'relax') {
      grid.innerHTML = `
        <div class="lm-row">
          <span class="lm-label">Relaxing</span>
          <span class="lm-val node-badge">${this.graph.nodes.get(step.id)?.label || '?'}</span>
        </div>
        <div class="lm-row">
          <span class="lm-label">New Dist</span>
          <span class="lm-val step-badge">${step.cost}</span>
        </div>`;

    } else if (step.type === 'mst-consider' || step.type === 'mst-accept' || step.type === 'mst-reject') {
      const fromLabel = step.fromId !== undefined ? (this.graph.nodes.get(step.fromId)?.label || '?') : '?';
      const toLabel   = step.id     !== undefined ? (this.graph.nodes.get(step.id)?.label || '?')     : '?';
      const statusIcon = step.type === 'mst-accept' ? '✓' : step.type === 'mst-reject' ? '✗' : '?';
      const badgeCls   = step.type === 'mst-accept' ? 'node-badge' : step.type === 'mst-reject' ? '' : 'step-badge';
      let extra = '';
      if (step.pqSnapshot && step.pqSnapshot.length > 0) {
        extra += `<div class="lm-row col"><span class="lm-label">Priority Queue</span>
          <div class="lm-chips">${step.pqSnapshot.map(e => `<span class="lm-chip bfs">${e.label}:${e.dist}</span>`).join('')}</div></div>`;
      }
      if (step.ufSnapshot) {
        const groups = Object.entries(step.ufSnapshot);
        if (groups.length > 0) {
          extra += `<div class="lm-row col"><span class="lm-label">Union-Find Sets</span>
            <div class="lm-chips">${groups.map(([r,m]) => `<span class="lm-chip dfs">{${m.join(',')}}</span>`).join('')}</div></div>`;
        }
      }
      grid.innerHTML = `
        <div class="lm-row">
          <span class="lm-label">Edge</span>
          <span class="lm-val step-badge">${fromLabel}–${toLabel}</span>
        </div>
        <div class="lm-row">
          <span class="lm-label">Weight</span>
          <span class="lm-val node-badge">${step.cost ?? '?'}</span>
        </div>
        <div class="lm-row">
          <span class="lm-label">Decision</span>
          <span class="lm-val ${badgeCls}" style="color:${step.type==='mst-accept'?'#00e5a0':step.type==='mst-reject'?'#ff6b6b':'inherit'}">${statusIcon} ${step.type.replace('mst-','')}</span>
        </div>
        ${extra}`;

    } else if (step.type === 'color-assign') {
      const colors = this.renderer.getThemeColors().coloringPalette;
      const hex = colors[step.colorIndex % colors.length];
      grid.innerHTML = `
        <div class="lm-row">
          <span class="lm-label">Node</span>
          <span class="lm-val node-badge">${this.graph.nodes.get(step.id)?.label || '?'}</span>
        </div>
        <div class="lm-row">
          <span class="lm-label">Color</span>
          <span class="lm-val" style="color:${hex};font-family:'JetBrains Mono',monospace;font-weight:700">■ Color ${step.colorIndex + 1}</span>
        </div>
        <div class="lm-row">
          <span class="lm-label">χ(G) so far</span>
          <span class="lm-val comp-badge">${step.colorsUsed}</span>
        </div>
        <div class="lm-row col">
          <span class="lm-label">Reason</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:11px;opacity:0.7">${step.reason}</span>
        </div>`;

    } else if (step.type === 'astar-current') {
      const openList  = (step.openSnap   || []).map(e => `<span class="lm-chip bfs">${e.label}(f=${e.f})</span>`).join('');
      const closedList= (step.closedSnap || []).map(l => `<span class="lm-chip dfs">${l}</span>`).join('');
      grid.innerHTML = `
        <div class="lm-row">
          <span class="lm-label">Current</span>
          <span class="lm-val node-badge">${this.graph.nodes.get(step.id)?.label || '?'}</span>
        </div>
        <div class="lm-row">
          <span class="lm-label">g(n)</span><span class="lm-val step-badge">${step.g}</span>
        </div>
        <div class="lm-row">
          <span class="lm-label">h(n)</span><span class="lm-val comp-badge">${step.h}</span>
        </div>
        <div class="lm-row">
          <span class="lm-label">f(n)</span><span class="lm-val node-badge">${step.f}</span>
        </div>
        <div class="lm-row col">
          <span class="lm-label">Open Set</span>
          <div class="lm-chips">${openList || '<span class="lm-empty">empty</span>'}</div>
        </div>
        <div class="lm-row col">
          <span class="lm-label">Closed Set</span>
          <div class="lm-chips">${closedList || '<span class="lm-empty">empty</span>'}</div>
        </div>`;

    } else if (step.type === 'astar-relax') {
      const nl = this.graph.nodes.get(step.id)?.label || '?';
      grid.innerHTML = `
        <div class="lm-row">
          <span class="lm-label">Update</span>
          <span class="lm-val node-badge">${nl}</span>
        </div>
        <div class="lm-row">
          <span class="lm-label">g(n)</span><span class="lm-val step-badge">${step.g}</span>
        </div>
        <div class="lm-row">
          <span class="lm-label">h(n)</span><span class="lm-val comp-badge">${step.h}</span>
        </div>
        <div class="lm-row">
          <span class="lm-label">f(n)</span><span class="lm-val node-badge">${step.f}</span>
        </div>`;

    } else if (step.type === 'bf-relax') {
      const nl = this.graph.nodes.get(step.id)?.label || '?';
      const fl = step.fromId !== undefined ? (this.graph.nodes.get(step.fromId)?.label || '?') : '?';
      grid.innerHTML = `
        <div class="lm-row">
          <span class="lm-label">Iteration</span>
          <span class="lm-val step-badge">${step.iteration}</span>
        </div>
        <div class="lm-row">
          <span class="lm-label">Relaxing</span>
          <span class="lm-val node-badge">${fl} → ${nl}</span>
        </div>
        <div class="lm-row">
          <span class="lm-label">New dist[${nl}]</span>
          <span class="lm-val comp-badge">${step.newDist}</span>
        </div>`;

    } else if (step.type === 'topo-visit' || step.type === 'topo-push' || step.type === 'kahn-process') {
      const nl = step.id !== undefined ? (this.graph.nodes.get(step.id)?.label || '?') : '?';
      const orderLabels = (step.order || []).map(id => this.graph.nodes.get(id)?.label || '?');
      grid.innerHTML = `
        <div class="lm-row">
          <span class="lm-label">Processing</span>
          <span class="lm-val node-badge">${nl}</span>
        </div>
        <div class="lm-row col">
          <span class="lm-label">Topo Order So Far</span>
          <div class="lm-chips">${orderLabels.map(l => `<span class="lm-chip dfs top">${l}</span>`).join('') || '<span class="lm-empty">—</span>'}</div>
        </div>`;
    }
    // Sync to focus drawer
    this._syncFdLearning();
  }

  /* ── A* Selection Flow ── */
  _startAstarSelection() {
    this.graph.resetStates();
    this.astarPhase  = 'source';
    this.astarSource = null;
    document.body.classList.add('selecting-source');
    this.setStatus('A*: Click a node to set as SOURCE');
  }

  _setAstarSource(node) {
    this.astarSource = node.id;
    node.state = 'source';
    this.astarPhase = 'dest';
    document.body.classList.remove('selecting-source');
    document.body.classList.add('selecting-dest');
    this.setStatus(`A* Source: ${node.label}. Click a node to set as DESTINATION`);
    this.renderer.drawAll(this.graph, null);
  }

  _setAstarDest(node) {
    if (node.id === this.astarSource) {
      this.showToast('Source and destination must be different!', 'error');
      return;
    }
    document.body.classList.remove('selecting-dest');
    this.astarPhase = null;
    node.state = 'destination';
    this.renderer.drawAll(this.graph, null);

    const result = this.engine.astar(this.astarSource, node.id);
    this.astarResult = result;

    this.algoSteps  = result.steps;
    this.stepIndex  = 0;
    this.graph.resetStates();
    this.graph.nodes.get(this.astarSource).state = 'source';
    node.state = 'destination';

    document.getElementById('traversalSection').style.display = 'none';
    this._setRunning(true);
    this._updatePseudocode('astar', 0);
    const speed = parseInt(document.getElementById('speedSlider').value);

    this.runInterval = setInterval(() => {
      if (this.stepIndex >= this.algoSteps.length) {
        clearInterval(this.runInterval);
        this._setRunning(false);
        return;
      }
      this._applyStep(this.algoSteps[this.stepIndex++]);
      this.renderer.drawAll(this.graph, null);
    }, 1600 - speed);
  }

  _finishAstar(step) {
    this._setRunning(false);
    this.graph.resetStates();

    if (step.path && step.path.length > 0) {
      step.path.forEach(id => { this.graph.nodes.get(id).state = 'path'; });
      this.graph.nodes.get(step.path[0]).state = 'source';
      this.graph.nodes.get(step.path[step.path.length - 1]).state = 'destination';
      step.pathEdges.forEach(e => { if (e) e.state = 'path'; });

      const pathLabels = step.path.map(id => this.graph.nodes.get(id)?.label).join(' → ');
      document.getElementById('astarResultSection').style.display = 'block';
      document.getElementById('astarResult').innerHTML = `
        <div>A* Path Found ✓</div>
        <div class="path-nodes">${pathLabels}</div>
        <div style="margin-top:6px">Total cost: <span class="path-cost">${+step.cost.toFixed(2)}</span></div>
        <div style="margin-top:4px;font-size:0.68rem;opacity:0.6">Heuristic: Euclidean distance</div>
      `;
      this.setStatus(`A* path: ${pathLabels} (cost: ${+step.cost.toFixed(2)})`);
      this.showToast(`A* path found! Cost: ${+step.cost.toFixed(2)}`, 'success');
    } else {
      document.getElementById('astarResultSection').style.display = 'block';
      document.getElementById('astarResult').innerHTML = '<span class="no-path">No path exists</span>';
    }
    this.renderer.drawAll(this.graph, null);
  }

  /* ── Bellman-Ford Selection Flow ── */
  _startBellmanFordSelection() {
    this.graph.resetStates();
    this.bfPhase = 'source';
    this.bfSource = null;
    document.body.classList.add('selecting-source');
    this.setStatus('Bellman-Ford: Click a node to set as SOURCE');
    this.renderer.drawAll(this.graph, null);
  }

  _setBFSource(node) {
    this.bfSource = node.id;
    node.state = 'source';
    this.bfPhase = 'dest';
    document.body.classList.remove('selecting-source');
    document.body.classList.add('selecting-dest');
    this.setStatus(`BF Source: ${node.label}. Click a node to set as DESTINATION`);
    this.renderer.drawAll(this.graph, null);
  }

  _setBFDest(node) {
    if (node.id === this.bfSource) { this.showToast('Source and dest must differ!', 'error'); return; }
    document.body.classList.remove('selecting-dest');
    this.bfPhase = null;
    node.state = 'destination';
    this.renderer.drawAll(this.graph, null);
    this._updatePseudocode('bellmanford', 0);

    const result = this.engine.bellmanFord(this.bfSource, node.id);
    this.algoSteps = result.steps;
    this.stepIndex = 0;
    this.graph.resetStates();
    this.graph.nodes.get(this.bfSource).state = 'source';
    node.state = 'destination';

    document.getElementById('traversalSection').style.display = 'none';
    this._setRunning(true);
    const speed = parseInt(document.getElementById('speedSlider').value);
    this.runInterval = setInterval(() => {
      if (this.stepIndex >= this.algoSteps.length) {
        clearInterval(this.runInterval);
        this._setRunning(false);
        return;
      }
      this._applyStep(this.algoSteps[this.stepIndex++]);
      this.renderer.drawAll(this.graph, null);
    }, 1600 - speed);
  }

  _finishBellmanFord(step) {
    this._setRunning(false);
    this.graph.resetStates();
    const sec = document.getElementById('pathResultSection');
    sec.style.display = 'block';

    if (step.hasNegCycle) {
      document.getElementById('pathResult').innerHTML = '<span class="no-path">⚠ Negative-weight cycle detected — distances undefined</span>';
      this.setStatus('Bellman-Ford: Negative cycle detected!');
      this.showToast('Negative cycle!', 'error');
    } else if (step.path && step.path.length > 0) {
      step.path.forEach(id => { this.graph.nodes.get(id).state = 'path'; });
      this.graph.nodes.get(step.path[0]).state = 'source';
      this.graph.nodes.get(step.path[step.path.length-1]).state = 'destination';
      step.pathEdges.forEach(e => { if (e) e.state = 'path'; });
      const pathLabels = step.path.map(id => this.graph.nodes.get(id)?.label).join(' → ');
      document.getElementById('pathResult').innerHTML = `
        <div>Bellman-Ford Path ✓</div>
        <div class="path-nodes">${pathLabels}</div>
        <div style="margin-top:6px">Total cost: <span class="path-cost">${step.cost === Infinity ? '∞' : step.cost}</span></div>
        <div style="margin-top:4px;font-size:0.68rem;opacity:0.6">Supports negative weights</div>
      `;
      this.setStatus(`BF path: ${pathLabels} (cost: ${step.cost})`);
      this.showToast(`Path found! Cost: ${step.cost}`, 'success');
    } else {
      document.getElementById('pathResult').innerHTML = '<span class="no-path">No path exists</span>';
      this.setStatus('Bellman-Ford: No path found');
      this.showToast('No path found!', 'error');
    }
    this.renderer.drawAll(this.graph, null);
  }

  /* ── Topological Sort ── */
  _runTopoSort() {
    if (this.graph.nodes.size === 0) { this.showToast('Add some nodes first!', 'error'); return; }
    if (!this.graph.directed) {
      this.showToast('Topological sort requires a directed graph', 'error');
      return;
    }
    this.graph.resetStates();

    // Choose algorithm based on topoMode (default DFS)
    const result = this.topoMode === 'kahn'
      ? this.engine.topoSortKahn()
      : this.engine.topoSortDFS();

    this.algoSteps = result.steps;
    this.stepIndex = 0;
    this.graph.resetStates();

    document.getElementById('traversalSection').style.display = 'none';
    this._setRunning(true);
    this._updatePseudocode(this.topoMode === 'kahn' ? 'toposort_kahn' : 'toposort_dfs', 0);
    const speed = parseInt(document.getElementById('speedSlider').value);
    this.runInterval = setInterval(() => {
      if (this.stepIndex >= this.algoSteps.length) {
        clearInterval(this.runInterval);
        this._setRunning(false);
        return;
      }
      this._applyStep(this.algoSteps[this.stepIndex++]);
      this.renderer.drawAll(this.graph, null);
    }, 1600 - speed);
  }

  _finishTopoSort(step) {
    this._setRunning(false);
    const sec = document.getElementById('traversalSection');
    sec.style.display = 'block';
    const display = document.getElementById('traversalDisplay');

    if (step.hasCycle) {
      display.innerHTML = '<span style="color:var(--accent3);font-family:JetBrains Mono,monospace;font-size:0.72rem">⚠ Cycle detected — no topological order exists</span>';
      this.setStatus('Topological Sort: Cycle detected — not a DAG!');
      this.showToast('Cycle detected!', 'error');
    } else {
      const labels = step.order.map(id => this.graph.nodes.get(id)?.label || '?');
      display.innerHTML = labels.map(l => `<span class="trav-node">${l}</span>`).join('');
      const algoName = this.topoMode === 'kahn' ? "Kahn's" : 'DFS';
      this.setStatus(`Topological Order (${algoName}): ${labels.join(' → ')}`);
      this.showToast(`Topo sort complete! ${labels.length} nodes ordered.`, 'success');
    }
    this.renderer.drawAll(this.graph, null);
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

  /* ── MST Helpers ── */
  _updateMSTInfo(totalCost, pqSnapshot, ufSnapshot) {
    const sec = document.getElementById('mstResultSection');
    sec.style.display = 'block';
    let html = `<div class="mst-cost-row">MST Cost so far: <span class="path-cost">${totalCost}</span></div>`;

    if (pqSnapshot && pqSnapshot.length > 0) {
      html += `<div class="mst-pq-label">Priority Queue:</div>`;
      html += `<div class="mst-pq-chips">` +
        pqSnapshot.map(e => `<span class="mst-pq-chip">${e.label}<em>${e.dist}</em></span>`).join('') +
        `</div>`;
    }

    if (ufSnapshot) {
      const groups = Object.entries(ufSnapshot);
      if (groups.length > 0) {
        html += `<div class="mst-pq-label">Union-Find Sets:</div>`;
        html += `<div class="mst-pq-chips">` +
          groups.map(([root, members]) =>
            `<span class="mst-uf-chip">{${members.join(',')}}</span>`
          ).join('') + `</div>`;
      }
    }

    document.getElementById('mstResult').innerHTML = html;
  }

  _finishMST(totalCost, mstEdges) {
    this._setRunning(false);
    const sec = document.getElementById('mstResultSection');
    sec.style.display = 'block';

    const edgeList = mstEdges.map(e => {
      const fl = this.graph.nodes.get(e.from)?.label || '?';
      const tl = this.graph.nodes.get(e.to)?.label   || '?';
      return `${fl}–${tl}(${e.weight})`;
    });

    const algoName = this.selectedAlgo === 'algoPrim' ? "Prim's" : "Kruskal's";
    document.getElementById('mstResult').innerHTML = `
      <div class="mst-complete">✓ ${algoName} MST Complete</div>
      <div class="mst-cost-row">Total MST Cost: <span class="path-cost">${totalCost}</span></div>
      <div class="mst-cost-row">Edges: <span class="mst-edge-count">${mstEdges.length}</span></div>
      <div class="mst-edge-list">${edgeList.map(e => `<span class="mst-edge-chip">${e}</span>`).join('')}</div>
    `;

    this.setStatus(`${algoName} MST complete! Total cost: ${totalCost}`);
    this.showToast(`MST cost: ${totalCost}`, 'success');
    this.renderer.drawAll(this.graph, null);
  }

  /* ── Graph Coloring ── */
  _runColoring() {
    if (this.graph.nodes.size === 0) { this.showToast('Add some nodes first!', 'error'); return; }
    this.graph.resetStates();
    const engine = new AlgorithmEngine(this.graph);
    const result = engine.greedyColor();
    this.coloringResult = result;

    const colors = this.renderer.getThemeColors().coloringPalette;
    this.algoSteps = result.steps;
    this.stepIndex = 0;
    this.graph.resetStates();

    document.getElementById('traversalSection').style.display = 'none';
    this._setRunning(true);
    const speed = parseInt(document.getElementById('speedSlider').value);

    this.runInterval = setInterval(() => {
      if (this.stepIndex >= this.algoSteps.length) {
        clearInterval(this.runInterval);
        this._finishColoring(result);
        return;
      }
      this._applyStep(this.algoSteps[this.stepIndex++]);
      this.renderer.drawAll(this.graph, null);
    }, 1600 - speed);
  }

  _updateColoringInfo(colorsUsed, reason) {
    const sec = document.getElementById('coloringResultSection');
    sec.style.display = 'block';
    const cur = document.getElementById('coloringResult');
    cur.innerHTML = `
      <div class="coloring-info-row">Colors used so far: <span class="path-cost">${colorsUsed}</span></div>
      <div class="coloring-reason">${reason}</div>
    `;
  }

  _finishColoring(result) {
    this._setRunning(false);
    const sec = document.getElementById('coloringResultSection');
    sec.style.display = 'block';
    const colors = this.renderer.getThemeColors().coloringPalette;

    // Build color groups
    const groups = {};
    for (const [id, ci] of Object.entries(result.colorOf)) {
      const lbl = this.graph.nodes.get(Number(id))?.label || '?';
      if (!groups[ci]) groups[ci] = [];
      groups[ci].push(lbl);
    }

    const groupHTML = Object.entries(groups).map(([ci, nodes]) => {
      const hex = colors[parseInt(ci) % colors.length];
      return `<div class="color-group">
        <span class="color-swatch" style="background:${hex}"></span>
        <span class="color-group-label">Color ${parseInt(ci)+1}:</span>
        <span class="color-group-nodes">${nodes.join(', ')}</span>
      </div>`;
    }).join('');

    document.getElementById('coloringResult').innerHTML = `
      <div class="coloring-done">✓ Coloring Complete</div>
      <div class="coloring-info-row">Chromatic Number χ(G): <span class="path-cost">${result.chromaticNumber}</span></div>
      ${groupHTML}
    `;
    this.setStatus(`Graph colored! Chromatic number χ(G) = ${result.chromaticNumber}`);
    this.showToast(`χ(G) = ${result.chromaticNumber} colors needed`, 'success');
    this.renderer.drawAll(this.graph, null);
  }

  /* ── Algorithm Comparison Mode ── */
  _runComparison(mode) {
    if (this.graph.nodes.size === 0) { this.showToast('Add nodes first!', 'error'); return; }
    this.engine = new AlgorithmEngine(this.graph);
    const firstId = this.graph.nodes.keys().next().value;
    const resultEl = document.getElementById('compareResult');
    // compareResult lives inside the Compare tab panel — just make it visible
    if (!resultEl) return;

    let html = '';

    if (mode === 'bfs-vs-dfs') {
      const t0 = performance.now();
      const bfsSteps = this.engine.bfs(firstId);
      const t1 = performance.now();
      const dfsSteps = this.engine.dfs(firstId);
      const t2 = performance.now();

      const bfsOrder = bfsSteps.filter(s => s.type === 'visit').map(s => this.graph.nodes.get(s.id)?.label);
      const dfsOrder = dfsSteps.filter(s => s.type === 'visit').map(s => this.graph.nodes.get(s.id)?.label);

      html = `
        <div class="cmp-header">BFS vs DFS Comparison</div>
        <div class="cmp-grid">
          <div class="cmp-col bfs-col">
            <div class="cmp-algo-name bfs-name">BFS</div>
            <div class="cmp-stat-row"><span>Visited Nodes</span><strong>${bfsOrder.length}</strong></div>
            <div class="cmp-stat-row"><span>Time Complexity</span><strong>O(V+E)</strong></div>
            <div class="cmp-stat-row"><span>Space</span><strong>O(V)</strong></div>
            <div class="cmp-stat-row"><span>Exec Time</span><strong>${(t1-t0).toFixed(3)}ms</strong></div>
            <div class="cmp-order-label">Traversal Order:</div>
            <div class="cmp-order">${bfsOrder.map(l=>`<span class="trav-node">${l}</span>`).join('')}</div>
          </div>
          <div class="cmp-divider"></div>
          <div class="cmp-col dfs-col">
            <div class="cmp-algo-name dfs-name">DFS</div>
            <div class="cmp-stat-row"><span>Visited Nodes</span><strong>${dfsOrder.length}</strong></div>
            <div class="cmp-stat-row"><span>Time Complexity</span><strong>O(V+E)</strong></div>
            <div class="cmp-stat-row"><span>Space</span><strong>O(V)</strong></div>
            <div class="cmp-stat-row"><span>Exec Time</span><strong>${(t2-t1).toFixed(3)}ms</strong></div>
            <div class="cmp-order-label">Traversal Order:</div>
            <div class="cmp-order">${dfsOrder.map(l=>`<span class="trav-node">${l}</span>`).join('')}</div>
          </div>
        </div>
        <div class="cmp-note">BFS explores level-by-level; DFS explores branch-by-branch before backtracking.</div>
      `;
      this.showToast('BFS vs DFS comparison complete', 'success');

    } else if (mode === 'prim-vs-kruskal') {
      if (this.graph.directed) {
        this.showToast('MST algorithms require undirected graph', 'error');
        return;
      }
      const t0 = performance.now();
      const primResult = this.engine.primMST(firstId);
      const t1 = performance.now();
      const kruskalResult = this.engine.kruskalMST();
      const t2 = performance.now();

      const primEdges    = primResult.mstEdges.length;
      const kruskalEdges = kruskalResult.mstEdges.length;

      html = `
        <div class="cmp-header">Prim's vs Kruskal's MST</div>
        <div class="cmp-grid">
          <div class="cmp-col prim-col">
            <div class="cmp-algo-name prim-name">Prim's</div>
            <div class="cmp-stat-row"><span>MST Cost</span><strong class="cmp-cost">${primResult.totalCost}</strong></div>
            <div class="cmp-stat-row"><span>MST Edges</span><strong>${primEdges}</strong></div>
            <div class="cmp-stat-row"><span>Time Complexity</span><strong>O(E log V)</strong></div>
            <div class="cmp-stat-row"><span>Exec Time</span><strong>${(t1-t0).toFixed(3)}ms</strong></div>
            <div class="cmp-order-label">MST Edges:</div>
            <div class="cmp-order">${primResult.mstEdges.map(e=>{
              const fl=this.graph.nodes.get(e.from)?.label||'?';
              const tl=this.graph.nodes.get(e.to)?.label||'?';
              return `<span class="mst-edge-chip">${fl}-${tl}(${e.weight})</span>`;
            }).join('')}</div>
          </div>
          <div class="cmp-divider"></div>
          <div class="cmp-col kruskal-col">
            <div class="cmp-algo-name kruskal-name">Kruskal's</div>
            <div class="cmp-stat-row"><span>MST Cost</span><strong class="cmp-cost">${kruskalResult.totalCost}</strong></div>
            <div class="cmp-stat-row"><span>MST Edges</span><strong>${kruskalEdges}</strong></div>
            <div class="cmp-stat-row"><span>Time Complexity</span><strong>O(E log E)</strong></div>
            <div class="cmp-stat-row"><span>Exec Time</span><strong>${(t2-t1).toFixed(3)}ms</strong></div>
            <div class="cmp-order-label">MST Edges:</div>
            <div class="cmp-order">${kruskalResult.mstEdges.map(e=>{
              const fl=this.graph.nodes.get(e.from)?.label||'?';
              const tl=this.graph.nodes.get(e.to)?.label||'?';
              return `<span class="mst-edge-chip">${fl}-${tl}(${e.weight})</span>`;
            }).join('')}</div>
          </div>
        </div>
        <div class="cmp-note">Both produce valid MSTs with the same minimum cost. Prim's grows from a node; Kruskal's sorts all edges globally.</div>
      `;
      this.showToast('Prim vs Kruskal comparison complete', 'success');

    } else if (mode === 'dijkstra-vs-astar') {
      // Need source + dest — use first and last nodes
      const ids = Array.from(this.graph.nodes.keys());
      if (ids.length < 2) {
        this.showToast('Need at least 2 nodes for pathfinding comparison', 'error');
        return;
      }
      const srcId  = ids[0];
      const dstId  = ids[ids.length - 1];
      const srcLbl = this.graph.nodes.get(srcId)?.label || '?';
      const dstLbl = this.graph.nodes.get(dstId)?.label || '?';

      const t0 = performance.now();
      const dijkResult = this.engine.dijkstra(srcId, dstId);
      const t1 = performance.now();
      const astarResult = this.engine.astar(srcId, dstId);
      const t2 = performance.now();

      const dijkPath  = dijkResult.path.map(id => this.graph.nodes.get(id)?.label).join(' → ') || 'None';
      const astarPath = astarResult.path.map(id => this.graph.nodes.get(id)?.label).join(' → ') || 'None';

      html = `
        <div class="cmp-header">Dijkstra vs A* (${srcLbl} → ${dstLbl})</div>
        <div class="cmp-grid">
          <div class="cmp-col prim-col">
            <div class="cmp-algo-name prim-name">Dijkstra</div>
            <div class="cmp-stat-row"><span>Path Cost</span><strong class="cmp-cost">${dijkResult.cost === Infinity ? '∞' : dijkResult.cost}</strong></div>
            <div class="cmp-stat-row"><span>Nodes Visited</span><strong>${dijkResult.steps.filter(s=>s.type==='current').length}</strong></div>
            <div class="cmp-stat-row"><span>Time Complexity</span><strong>O((V+E)logV)</strong></div>
            <div class="cmp-stat-row"><span>Exec Time</span><strong>${(t1-t0).toFixed(3)}ms</strong></div>
            <div class="cmp-order-label">Path:</div>
            <div class="cmp-order"><span class="trav-node" style="max-width:100%;overflow:hidden;text-overflow:ellipsis">${dijkPath}</span></div>
          </div>
          <div class="cmp-divider"></div>
          <div class="cmp-col kruskal-col">
            <div class="cmp-algo-name kruskal-name">A*</div>
            <div class="cmp-stat-row"><span>Path Cost</span><strong class="cmp-cost">${astarResult.cost === Infinity ? '∞' : +astarResult.cost.toFixed(2)}</strong></div>
            <div class="cmp-stat-row"><span>Nodes Visited</span><strong>${astarResult.steps.filter(s=>s.type==='astar-current').length}</strong></div>
            <div class="cmp-stat-row"><span>Time Complexity</span><strong>O(E log V)</strong></div>
            <div class="cmp-stat-row"><span>Exec Time</span><strong>${(t2-t1).toFixed(3)}ms</strong></div>
            <div class="cmp-order-label">Path:</div>
            <div class="cmp-order"><span class="trav-node" style="max-width:100%;overflow:hidden;text-overflow:ellipsis">${astarPath}</span></div>
          </div>
        </div>
        <div class="cmp-note">A* uses Euclidean heuristic to guide search. Dijkstra explores blindly; A* typically visits fewer nodes on spatial graphs.</div>
      `;
      this.showToast('Dijkstra vs A* comparison complete', 'success');
    }

    resultEl.innerHTML = html;
    this.graph.resetStates();
    this.renderer.drawAll(this.graph, null);
  }

  /* ── Algorithm Explain Panel ── */
  _renderAlgoExplain(key) {
    const sec   = document.getElementById('algoExplainSection');
    const body  = document.getElementById('algoExplainBody2');
    const badge = document.getElementById('explainBadge');
    const nameEl= document.getElementById('explainAlgoName');
    if (!sec || !body) return;
    const data  = EDU_DATA[key];
    if (!data) return;
    sec.style.display = 'block';
    if (badge)  badge.textContent = key.toUpperCase().slice(0,4);
    if (nameEl) nameEl.textContent = data.title;
    body.innerHTML = `
      <div class="explain-description">${data.description}</div>
      <div class="explain-complexity-grid">
        <div class="explain-complexity-card">
          <span class="ec-label">Time</span>
          <span class="ec-value">${data.time}</span>
        </div>
        <div class="explain-complexity-card space-card">
          <span class="ec-label">Space</span>
          <span class="ec-value">${data.space}</span>
        </div>
      </div>
      <div>
        <span class="explain-section-label">Applications</span>
        <div class="explain-apps-grid">${data.applications.map(a => `<span class="explain-app-tag">${a}</span>`).join('')}</div>
      </div>`;
  }

  /* ── Collapsible Helper ── */
  _bindCollapsible(btnId, bodyId, iconId) {
    const btn  = document.getElementById(btnId);
    const body = document.getElementById(bodyId);
    const icon = document.getElementById(iconId);
    if (!btn || !body) return;
    const toggle = () => {
      const collapsed = body.classList.toggle('collapsed');
      if (icon) icon.style.transform = collapsed ? 'rotate(-90deg)' : '';
      btn.setAttribute('aria-expanded', String(!collapsed));
    };
    btn.addEventListener('click', toggle);
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }});
  }

  /* ── History Log ── */
  _addHistoryEntry(step) {
    const node  = step.id !== undefined ? this.graph.nodes.get(step.id) : null;
    const label = node?.label || '?';
    const fromNode = step.fromId !== undefined ? this.graph.nodes.get(step.fromId) : null;
    const fromLabel = fromNode?.label || '?';

    let icon = '▶';
    let text = '';
    switch (step.type) {
      case 'visit':      icon = '👁'; text = `Visit <span class="he-node">${label}</span> <span class="he-action">(order: ${step.order + 1})</span>`; break;
      case 'current':    icon = '▶'; text = `Process <span class="he-node">${label}</span>`; break;
      case 'relax':      icon = '⬇'; text = `Relax <span class="he-node">${label}</span> → dist <span class="he-cost">${step.cost}</span>`; break;
      case 'source':     icon = '🟢'; text = `Source: <span class="he-node">${label}</span>`; break;
      case 'mst-consider': icon='🔍'; text = `Consider edge <span class="he-edge">${fromLabel}–${label}</span> (w:<span class="he-cost">${step.cost}</span>)`; break;
      case 'mst-accept': icon='✅'; text = `Accept edge <span class="he-edge">${fromLabel}–${label}</span> | Total: <span class="he-cost">${step.totalCost}</span>`; break;
      case 'mst-reject': icon='❌'; text = `Reject edge <span class="he-edge">${fromLabel}–${label}</span> (cycle)`; break;
      case 'mst-info':   icon='🏆'; text = `MST complete! Cost: <span class="he-cost">${step.totalCost}</span>`; break;
      case 'color-assign': icon='🎨'; text = `Color <span class="he-node">${label}</span> → <span class="he-cost">Color ${step.colorIndex+1}</span>`; break;
      case 'astar-current': icon='🎯'; text = `A* expand <span class="he-node">${label}</span> f=<span class="he-cost">${step.f}</span>`; break;
      case 'astar-relax': icon='↩'; text = `A* update <span class="he-node">${label}</span> g=<span class="he-cost">${step.g}</span>`; break;
      case 'bf-relax':   icon='🔁'; text = `BF iter${step.iteration}: <span class="he-edge">${fromLabel}→${label}</span> dist=<span class="he-cost">${step.newDist}</span>`; break;
      case 'bf-cycle':   icon='⚠️'; text = `Negative cycle detected!`; break;
      case 'topo-visit': icon='📌'; text = `Topo visit <span class="he-node">${label}</span>`; break;
      case 'topo-push':  icon='📤'; text = `Push <span class="he-node">${label}</span> to result`; break;
      case 'kahn-process':icon='📤'; text = `Kahn process <span class="he-node">${label}</span>`; break;
      default: return; // skip types without meaningful log entries
    }
    this._historyLog.push({ icon, text, step: this.stepIndex });
    this._renderHistoryLog();
  }

  _renderHistoryLog() {
    const sec  = document.getElementById('historyLogSection');
    const wrap = document.getElementById('historyLogWrap');
    const badge= document.getElementById('historyCountBadge');
    if (!sec || !wrap) return;
    sec.style.display = 'block';
    badge.textContent = this._historyLog.length;

    const entries = this._historyLog.slice(-80); // keep last 80
    wrap.innerHTML = entries.map((e, i) => `
      <div class="history-entry${i === entries.length - 1 ? ' he-latest' : ''}">
        <span class="history-step-num">${e.step}</span>
        <span class="history-entry-icon">${e.icon}</span>
        <span class="history-entry-text">${e.text}</span>
      </div>`).join('');
    // Auto-scroll to bottom
    wrap.scrollTop = wrap.scrollHeight;
    // Sync to focus drawer
    this._syncFdHistory();
  }

  _clearHistoryLog() {
    this._historyLog = [];
    const wrap  = document.getElementById('historyLogWrap');
    const badge = document.getElementById('historyCountBadge');
    if (wrap)  wrap.innerHTML = '<p class="empty-msg">Run an algorithm to see step-by-step log</p>';
    if (badge) badge.textContent = '0';
    this.showToast('History log cleared', 'info');
  }

  _exportHistoryLog() {
    if (!this._historyLog || this._historyLog.length === 0) {
      this.showToast('No log entries to export', 'info'); return;
    }
    const text = this._historyLog.map((e, i) =>
      `[${e.step}] ${e.icon} ${e.text.replace(/<[^>]+>/g, '')}`
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'graphlab-log.txt'; a.click();
    URL.revokeObjectURL(url);
    this.showToast('Log exported!', 'success');
  }

  /* ── Interview Panel ── */
  _renderInterviewPanel() {
    const panel = document.getElementById('interviewPanel');
    if (!panel) return;

    const INTERVIEW_DB = {
      'BFS & DFS': [
        { q: 'What is the time complexity of BFS and DFS?', level: 'medium', a: 'Both are <strong>O(V + E)</strong> where V = vertices and E = edges. BFS uses a queue; DFS uses a stack (or recursion). Space: O(V) for visited set + queue/stack.' },
        { q: 'When would you use BFS over DFS?', level: 'medium', a: 'Use <strong>BFS</strong> when you need the shortest path in an unweighted graph, or exploring level-by-level (e.g. finding nearest neighbor). Use <strong>DFS</strong> for cycle detection, topological sort, or maze solving.' },
        { q: 'How does BFS guarantee shortest path in unweighted graphs?', level: 'medium', a: 'BFS explores nodes level by level — the first time it reaches a node, it\'s via the shortest path because all edges are weight 1. It expands the "frontier" uniformly.' },
        { q: 'Can DFS find the shortest path?', level: 'advanced', a: '<strong>No</strong> (in general). DFS can find a path, but not necessarily the shortest one. It may take a long detour before reaching the target. Only BFS guarantees shortest path in unweighted graphs.' },
      ],
      'Dijkstra & Shortest Paths': [
        { q: "Why doesn't Dijkstra work with negative edge weights?", level: 'medium', a: 'Dijkstra uses a greedy approach — once a node is finalized, it\'s never revisited. With negative weights, a later edge could provide a shorter path to an already-finalized node, violating the invariant. Use <strong>Bellman-Ford</strong> instead.' },
        { q: 'What is the time complexity of Dijkstra with a min-heap?', level: 'medium', a: '<strong>O((V + E) log V)</strong> using a binary heap / priority queue. Each vertex is extracted once (O(V log V)) and each edge relaxation does a heap update (O(E log V)).' },
        { q: 'How does A* differ from Dijkstra?', level: 'advanced', a: 'A* adds a heuristic <code>h(n)</code> to guide search: <strong>f(n) = g(n) + h(n)</strong>. Dijkstra is A* with h(n) = 0. With an admissible heuristic (never overestimates), A* is optimal and typically visits fewer nodes.' },
        { q: 'What is an admissible heuristic?', level: 'advanced', a: 'A heuristic is <strong>admissible</strong> if it never overestimates the true cost to reach the goal. Example: Euclidean distance for a spatial graph. With an admissible heuristic, A* is guaranteed to find the optimal path.' },
      ],
      'MST Algorithms': [
        { q: "What is the difference between Prim's and Kruskal's?", level: 'medium', a: "<strong>Prim's</strong> grows the MST from a starting node, always adding the cheapest edge connecting the tree to an unvisited node. <strong>Kruskal's</strong> sorts all edges globally and adds them if they don't form a cycle (using Union-Find). Both yield the same MST cost." },
        { q: 'What data structure does Kruskal\'s use for cycle detection?', level: 'medium', a: '<strong>Union-Find (Disjoint Set Union)</strong> with path compression and union by rank. It detects if two nodes share a root (same component) in nearly O(1) amortized time.' },
        { q: 'When is Prim\'s better than Kruskal\'s?', level: 'advanced', a: "<strong>Prim's</strong> is better on <em>dense</em> graphs (many edges) since it doesn't need to sort all edges. <strong>Kruskal's</strong> is better on <em>sparse</em> graphs because sorting fewer edges is cheaper." },
      ],
      'Graph Theory': [
        { q: 'What is a DAG and why does it matter?', level: 'medium', a: 'A <strong>Directed Acyclic Graph (DAG)</strong> is a directed graph with no cycles. DAGs enable topological sorting, which is fundamental for task scheduling, dependency resolution, and build systems.' },
        { q: 'How do you detect a cycle in a directed graph?', level: 'medium', a: 'Use <strong>DFS with coloring</strong>: White (unvisited), Gray (in current path), Black (done). If you encounter a Gray node while DFS-ing, there\'s a back edge → cycle. Alternatively, use Kahn\'s algorithm: if result has fewer than V nodes → cycle exists.' },
        { q: 'What is graph density and how is it calculated?', level: 'medium', a: 'Density = <strong>E / (V*(V-1)/2)</strong> for undirected (or <strong>E / (V*(V-1))</strong> for directed). Dense graphs approach 1; sparse graphs approach 0. Dense graphs favor adjacency matrices; sparse graphs favor adjacency lists.' },
        { q: 'What is the chromatic number χ(G)?', level: 'advanced', a: 'The <strong>chromatic number χ(G)</strong> is the minimum number of colors needed to color a graph such that no two adjacent vertices share a color. Finding χ(G) exactly is NP-hard; greedy coloring gives an approximation.' },
      ],
    };

    panel.innerHTML = Object.entries(INTERVIEW_DB).map(([group, cards]) => `
      <div class="interview-algo-group">
        <div class="interview-group-header"><span class="igh-algo">${group}</span></div>
        ${cards.map((c, i) => `
          <div class="interview-card" id="icard-${group}-${i}">
            <div class="interview-card-header" onclick="this.closest('.interview-card').classList.toggle('open')">
              <span class="interview-card-q">${c.q}</span>
              <span class="interview-card-level ${c.level}">${c.level}</span>
              <span class="interview-card-toggle">▾</span>
            </div>
            <div class="interview-card-answer">${c.a}</div>
          </div>`).join('')}
      </div>`).join('');
  }

  /* ── Challenge Mode ── */
  _getChallengeQuestions() {
    const QUESTIONS = {
      easy: [
        { algo: 'BFS', q: 'What data structure does BFS use?', options: ['Stack','Queue','Priority Queue','Heap'], correct: 1, explanation: 'BFS uses a Queue (FIFO). This ensures nodes are visited level-by-level.' },
        { algo: 'DFS', q: 'What data structure does DFS use?', options: ['Queue','Heap','Stack','Array'], correct: 2, explanation: 'DFS uses a Stack (LIFO) or recursion call stack to explore depth-first.' },
        { algo: 'Graph', q: 'In BFS, which node is visited first?', options: ['Deepest node','Source node','Last added node','Random node'], correct: 1, explanation: 'BFS starts from the source (start) node and explores outward.' },
        { algo: 'BFS', q: 'What is the time complexity of BFS?', options: ['O(V²)','O(E log V)','O(V + E)','O(V log V)'], correct: 2, explanation: 'BFS visits every vertex and edge once: O(V + E).' },
        { algo: 'DFS', q: 'What is the time complexity of DFS?', options: ['O(V + E)','O(V²)','O(E log E)','O(log V)'], correct: 0, explanation: 'DFS visits every vertex and edge once: O(V + E).' },
        { algo: 'Graph', q: 'What is a connected component?', options: ['A path','A cycle','A maximal connected subgraph','A tree'], correct: 2, explanation: 'A connected component is a maximal set of vertices where every pair has a path between them.' },
        { algo: 'MST', q: "Which algorithm sorts all edges first?", options: ["Prim's","Dijkstra","BFS","Kruskal's"], correct: 3, explanation: "Kruskal's sorts all edges by weight and adds them greedily using Union-Find." },
      ],
      medium: [
        { algo: 'Dijkstra', q: "Can Dijkstra handle negative edge weights?", options: ['Yes, always','No, never','Only if no cycle','Only with a heap'], correct: 1, explanation: "Dijkstra's greedy approach fails with negative weights — use Bellman-Ford instead." },
        { algo: 'A*', q: "What does A* use that Dijkstra doesn't?", options: ['A stack','A heuristic function','Negative weights','Union-Find'], correct: 1, explanation: 'A* uses f(n) = g(n) + h(n), where h(n) is a heuristic estimate to the goal.' },
        { algo: 'MST', q: "Prim's algorithm is best suited for:", options: ['Sparse graphs','Dense graphs','Directed graphs','Negative weights'], correct: 1, explanation: "Prim's works well on dense graphs where sorting all edges (Kruskal's) is costly." },
        { algo: 'Topo', q: 'Topological sort is possible only on:', options: ['Any graph','Undirected graphs','Directed Acyclic Graphs (DAGs)','Complete graphs'], correct: 2, explanation: 'Topological sort requires a DAG — any cycle makes linear ordering impossible.' },
        { algo: 'Bellman-Ford', q: 'Bellman-Ford relaxes each edge how many times?', options: ['1','E-1','V-1','V²'], correct: 2, explanation: 'BF performs V-1 relaxation passes to guarantee shortest paths (shortest path has at most V-1 edges).' },
        { algo: 'Coloring', q: 'The greedy coloring algorithm guarantees:', options: ['Optimal chromatic number','At most Δ+1 colors','Exactly 2 colors','At most log(V) colors'], correct: 1, explanation: 'Greedy coloring uses at most Δ+1 colors where Δ is the maximum degree. This is not always optimal.' },
      ],
      hard: [
        { algo: 'A*', q: 'For A* to be optimal, the heuristic must be:', options: ['Monotonic only','Admissible (never overestimate)','Always zero','Euclidean distance'], correct: 1, explanation: 'An admissible heuristic never overestimates the true cost, guaranteeing A* finds the optimal path.' },
        { algo: 'Dijkstra', q: 'With a Fibonacci heap, Dijkstra runs in:', options: ['O(V²)','O(E + V log V)','O(E log V)','O(V log E)'], correct: 1, explanation: 'Fibonacci heap gives O(E + V log V), better than binary heap O((E+V) log V) for dense graphs.' },
        { algo: 'Graph', q: 'The chromatic number χ(G) for a bipartite graph is:', options: ['1','2','3','At most V/2'], correct: 1, explanation: 'Any bipartite graph is 2-colorable by definition. χ(G) = 2 for connected bipartite graphs.' },
        { algo: 'MST', q: "Kruskal's algorithm complexity with union-find is:", options: ['O(V²)','O(E log V)','O(E log E)','O(V + E)'], correct: 2, explanation: 'Sorting edges takes O(E log E). Since E ≤ V², O(E log E) = O(E log V).' },
        { algo: 'Topo', q: "Kahn's topological sort detects cycles by:", options: ['DFS back edges','Checking if result length < V','Using Union-Find','Counting components'], correct: 1, explanation: "If Kahn's result contains fewer than V nodes, some nodes couldn't be processed → cycle exists." },
      ]
    };
    return QUESTIONS[this._challengeDiff] || QUESTIONS.easy;
  }

  _newChallenge() {
    const questions = this._getChallengeQuestions();
    const q = questions[Math.floor(Math.random() * questions.length)];
    this._challengeActive = q;

    document.getElementById('challengeAlgoLabel').textContent = `${q.algo} · ${this._challengeDiff}`;
    document.getElementById('challengeQuestion').textContent  = q.q;
    document.getElementById('challengeFeedback').style.display = 'none';
    document.getElementById('challengeRevealBtn').style.display = 'inline-flex';

    const optEl = document.getElementById('challengeOptions');
    const letters = ['A','B','C','D'];
    optEl.innerHTML = q.options.map((opt, i) => `
      <button type="button" class="challenge-option" data-idx="${i}">
        <span class="challenge-option-letter">${letters[i]}</span>
        ${opt}
      </button>`).join('');

    optEl.querySelectorAll('.challenge-option').forEach(btn => {
      btn.addEventListener('click', () => this._answerChallenge(parseInt(btn.dataset.idx)));
    });
  }

  _answerChallenge(idx) {
    const q = this._challengeActive;
    if (!q) return;
    const opts = document.querySelectorAll('.challenge-option');
    opts.forEach(b => b.classList.add('disabled'));

    const correct = idx === q.correct;
    opts[idx].classList.add(correct ? 'correct' : 'incorrect');
    opts[q.correct].classList.add('correct');

    if (correct) {
      this._challengeScore  += this._challengeDiff === 'hard' ? 3 : this._challengeDiff === 'medium' ? 2 : 1;
      this._challengeStreak += 1;
      this.showToast('Correct! 🎉', 'success');
    } else {
      this._challengeStreak = 0;
      this.showToast('Wrong — check the explanation', 'error');
    }

    document.getElementById('challengeScore').textContent  = this._challengeScore;
    document.getElementById('challengeStreak').textContent = this._challengeStreak;

    const fb = document.getElementById('challengeFeedback');
    fb.className = `challenge-feedback ${correct ? 'correct-fb' : 'incorrect-fb'}`;
    fb.innerHTML = `${correct ? '✅ Correct!' : '❌ Incorrect.'} <strong>Explanation:</strong> ${q.explanation}`;
    fb.style.display = 'block';
    document.getElementById('challengeRevealBtn').style.display = 'none';
    this._challengeActive = null;
  }

  _revealChallenge() {
    const q = this._challengeActive;
    if (!q) return;
    const opts = document.querySelectorAll('.challenge-option');
    opts.forEach(b => b.classList.add('disabled'));
    opts[q.correct].classList.add('correct');
    this._challengeStreak = 0;
    document.getElementById('challengeStreak').textContent = 0;
    const fb = document.getElementById('challengeFeedback');
    fb.className = 'challenge-feedback incorrect-fb';
    fb.innerHTML = `💡 Answer revealed. <strong>Explanation:</strong> ${q.explanation}`;
    fb.style.display = 'block';
    document.getElementById('challengeRevealBtn').style.display = 'none';
    this._challengeActive = null;
  }

  /* ── Sidebar Toggle (focus mode) ── */
  _injectSidebarToggles() {
    const layout = document.querySelector('.layout');
    if (!layout) return;

    // Left panel collapse button
    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.right-panel');

    const leftBtn = document.createElement('button');
    leftBtn.className = 'sidebar-toggle sidebar-toggle-left';
    leftBtn.title = 'Collapse left panel';
    leftBtn.innerHTML = '‹';
    leftBtn.setAttribute('aria-label', 'Toggle left panel');
    leftPanel.appendChild(leftBtn);

    const rightBtn = document.createElement('button');
    rightBtn.className = 'sidebar-toggle sidebar-toggle-right';
    rightBtn.title = 'Collapse right panel';
    rightBtn.innerHTML = '›';
    rightBtn.setAttribute('aria-label', 'Toggle right panel');
    rightPanel.appendChild(rightBtn);

    leftBtn.addEventListener('click', () => {
      this._leftCollapsed = !this._leftCollapsed;
      leftPanel.classList.toggle('panel-collapsed', this._leftCollapsed);
      leftBtn.innerHTML = this._leftCollapsed ? '›' : '‹';
      leftBtn.title = this._leftCollapsed ? 'Expand left panel' : 'Collapse left panel';
      layout.classList.toggle('left-collapsed', this._leftCollapsed);
      setTimeout(() => { this.renderer.resize(); this.renderer.drawAll(this.graph, this.edgeInProgress); }, 310);
    });

    rightBtn.addEventListener('click', () => {
      this._rightCollapsed = !this._rightCollapsed;
      rightPanel.classList.toggle('panel-collapsed', this._rightCollapsed);
      rightBtn.innerHTML = this._rightCollapsed ? '‹' : '›';
      rightBtn.title = this._rightCollapsed ? 'Expand right panel' : 'Collapse right panel';
      layout.classList.toggle('right-collapsed', this._rightCollapsed);
      setTimeout(() => { this.renderer.resize(); this.renderer.drawAll(this.graph, this.edgeInProgress); }, 310);
    });
  }

  /* ══════════════════════════════════════════════════
     FOCUS DRAWER — large readable pseudocode/explain
     ══════════════════════════════════════════════════ */
  _initFocusDrawer() {
    this._fdOpen   = false;
    this._fdTab    = 'pseudocode';
    this._fdHeight = null; // remembered height

    const drawer   = document.getElementById('focusDrawer');
    const openBtn  = document.getElementById('focusDrawerBtn');
    const closeBtn = document.getElementById('focusDrawerClose');
    const resize   = document.getElementById('focusDrawerResize');
    if (!drawer) return;

    // Open / close
    openBtn?.addEventListener('click', () => this._toggleFocusDrawer());
    closeBtn?.addEventListener('click', () => this._closeFocusDrawer());

    // Tab switching
    drawer.querySelectorAll('.fd-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._fdTab = tab.dataset.fdtab;
        drawer.querySelectorAll('.fd-tab').forEach(t => t.classList.toggle('active', t === tab));
        drawer.querySelectorAll('.fd-tab-content').forEach(c => {
          c.classList.toggle('active', c.id === `fd-${this._fdTab}`);
        });
      });
    });

    // Resize handle — drag to resize
    let resizing = false, startY = 0, startH = 0;
    resize?.addEventListener('mousedown', e => {
      resizing = true;
      startY = e.clientY;
      startH = drawer.offsetHeight;
      resize.classList.add('dragging');
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', e => {
      if (!resizing) return;
      const dy   = startY - e.clientY; // drag up = increase height
      const wrap = drawer.closest('.canvas-wrap');
      const maxH = wrap ? wrap.offsetHeight * 0.82 : 600;
      const newH = Math.max(180, Math.min(maxH, startH + dy));
      drawer.style.height = newH + 'px';
      this._fdHeight = newH;
    });
    document.addEventListener('mouseup', () => {
      if (resizing) { resizing = false; resize?.classList.remove('dragging'); document.body.style.userSelect = ''; }
    });

    // Drawer-specific log buttons
    document.getElementById('fdHistoryClear')?.addEventListener('click',  () => this._clearHistoryLog());
    document.getElementById('fdHistoryExport')?.addEventListener('click', () => this._exportHistoryLog());
  }

  _toggleFocusDrawer() {
    if (this._fdOpen) this._closeFocusDrawer();
    else              this._openFocusDrawer();
  }

  _openFocusDrawer() {
    const drawer  = document.getElementById('focusDrawer');
    const openBtn = document.getElementById('focusDrawerBtn');
    if (!drawer) return;
    this._fdOpen = true;
    drawer.classList.add('open');
    openBtn?.classList.add('drawer-open');
    if (openBtn) openBtn.innerHTML = '▼ Focus View';
    if (this._fdHeight) drawer.style.height = this._fdHeight + 'px';
    drawer.setAttribute('aria-hidden', 'false');
    // Sync content
    this._syncFocusDrawer();
    setTimeout(() => { this.renderer.resize(); this.renderer.drawAll(this.graph, this.edgeInProgress); }, 340);
  }

  _closeFocusDrawer() {
    const drawer  = document.getElementById('focusDrawer');
    const openBtn = document.getElementById('focusDrawerBtn');
    if (!drawer) return;
    this._fdOpen = false;
    this._fdHeight = drawer.offsetHeight;
    drawer.classList.remove('open');
    drawer.style.height = '';
    openBtn?.classList.remove('drawer-open');
    if (openBtn) openBtn.innerHTML = '▲ Focus View';
    drawer.setAttribute('aria-hidden', 'true');
    setTimeout(() => { this.renderer.resize(); this.renderer.drawAll(this.graph, this.edgeInProgress); }, 340);
  }

  /** Push current pseudocode + explain into drawer panels */
  _syncFocusDrawer() {
    if (!this._fdOpen) return;

    // Algo badge
    const badge = document.getElementById('fdAlgoBadge');
    if (badge && this.eduKey) {
      const data = typeof EDU_DATA !== 'undefined' ? EDU_DATA[this.eduKey] : null;
      badge.textContent = data ? data.title : this.eduKey.toUpperCase();
    }

    // Pseudocode — copy from side panel wrap (already built)
    const sidePcWrap = document.getElementById('pseudocodeWrap');
    const fdPcWrap   = document.getElementById('fdPseudocodeWrap');
    if (sidePcWrap && fdPcWrap) {
      const block = sidePcWrap.querySelector('.pc-block');
      if (block) {
        fdPcWrap.innerHTML = '';
        fdPcWrap.appendChild(block.cloneNode(true));
      } else {
        fdPcWrap.innerHTML = sidePcWrap.innerHTML;
      }
    }

    // Explanation
    this._syncFdExplain();

    // Learning mode — copy from side panel
    this._syncFdLearning();

    // History log — copy from side panel
    this._syncFdHistory();
  }

  _syncFdExplain() {
    const wrap = document.getElementById('fdExplainWrap');
    if (!wrap || !this.eduKey) return;
    const data = typeof EDU_DATA !== 'undefined' ? EDU_DATA[this.eduKey] : null;
    if (!data) return;
    wrap.innerHTML = `
      <div class="fd-explain-title">${data.title}</div>
      <div class="fd-explain-desc">${data.description}</div>
      <div class="fd-complexity-row">
        <div class="fd-complexity-card">
          <span class="fcc-label">⏱ Time Complexity</span>
          <span class="fcc-val">${data.time}</span>
        </div>
        <div class="fd-complexity-card space">
          <span class="fcc-label">💾 Space Complexity</span>
          <span class="fcc-val">${data.space}</span>
        </div>
      </div>
      <div>
        <span class="fd-explain-section-label">Algorithm Steps</span>
        <div class="fd-steps-list">
          ${data.steps.map((s, i) => `<div class="fd-step-item"><span class="fd-step-num">${i + 1}</span><span>${s}</span></div>`).join('')}
        </div>
      </div>
      <div>
        <span class="fd-explain-section-label">Real-World Applications</span>
        <div class="fd-apps-grid">${data.applications.map(a => `<span class="fd-app-tag">${a}</span>`).join('')}</div>
      </div>
      ${data.interview ? `<div>
        <span class="fd-explain-section-label">Common Interview Questions</span>
        <div class="fd-steps-list">
          ${data.interview.map(q => `<div class="fd-step-item"><span class="fd-step-num">?</span><span>${q}</span></div>`).join('')}
        </div>
      </div>` : ''}`;
  }

  _syncFdLearning() {
    const fdWrap   = document.getElementById('fdLearningWrap');
    const sideGrid = document.getElementById('learningGrid');
    if (!fdWrap || !sideGrid) return;
    if (sideGrid.innerHTML.trim()) {
      fdWrap.innerHTML = `<div class="learning-grid" style="padding:16px 24px;gap:12px">${sideGrid.innerHTML}</div>`;
    }
  }

  _syncFdHistory() {
    const fdWrap   = document.getElementById('fdHistoryWrap');
    const sideWrap = document.getElementById('historyLogWrap');
    if (!fdWrap || !sideWrap) return;
    fdWrap.innerHTML = sideWrap.innerHTML;
    fdWrap.scrollTop = fdWrap.scrollHeight;
  }

  /** Called from _updatePseudocode to also sync drawer */
  _syncDrawerPseudocode(key, activeLine) {
    if (!this._fdOpen) return;
    const fdPcWrap = document.getElementById('fdPseudocodeWrap');
    if (!fdPcWrap) return;
    const block = fdPcWrap.querySelector('.pc-block');
    if (block && fdPcWrap.dataset.pcKey === key) {
      block.querySelectorAll('.pc-line').forEach(el => {
        el.classList.toggle('pc-active', parseInt(el.dataset.line) === activeLine);
      });
      const active = block.querySelector('.pc-active');
      if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      fdPcWrap.dataset.pcKey = key;
      fdPcWrap.innerHTML = buildPseudocodeHTML(key, activeLine);
      const active = fdPcWrap.querySelector('.pc-active');
      if (active) setTimeout(() => active.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
    }
    // Also update algo badge
    const badge = document.getElementById('fdAlgoBadge');
    const data  = typeof EDU_DATA !== 'undefined' ? EDU_DATA[key] : null;
    if (badge && data) badge.textContent = data.title;
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
    this.dijkstraPhase = null;
    this.astarPhase    = null;
    this.bfPhase       = null;
    document.getElementById('traversalSection').style.display = 'none';
    document.getElementById('pathResultSection').style.display = 'none';
    document.getElementById('mstResultSection').style.display  = 'none';
    document.getElementById('coloringResultSection').style.display = 'none';
    document.getElementById('astarResultSection').style.display    = 'none';
    const cmpEl = document.getElementById('compareResult');
    if (cmpEl) cmpEl.innerHTML = '';
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