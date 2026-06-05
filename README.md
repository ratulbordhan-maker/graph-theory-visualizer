# GraphLab — Graph Theory Visualizer

GraphLab is a polished browser-based graph theory tutor built for computer science students and educators. It combines interactive graph editing, algorithm animation, and educational guidance in a responsive dark-mode dashboard.

## Project Overview

GraphLab enables users to build and explore graphs visually while learning key algorithms. The app supports node and edge creation, weighted shortest-path analysis, and dynamic algorithm visualization for BFS, DFS, Dijkstra, and connected components.

## Features

- Interactive graph canvas for node placement, edge creation, and edge deletion
- Directed and undirected graph modes
- Editable edge weights for weighted graph analysis
- Animated Breadth-First Search (BFS) and Depth-First Search (DFS)
- Step-by-step Dijkstra shortest path visualization with source/destination selection
- Connected components detection with component grouping and color highlighting
- Random graph generator and clear graph reset
- Export graph structure to JSON and import graph JSON files
- Save and load graph state in browser storage
- Educational algorithm panel with descriptions, complexity, and applications
- Responsive layout, keyboard focus styles, and accessible HTML structure

## Algorithms Included

- **Breadth-First Search (BFS)** — level-order exploration and shortest path discovery on unweighted graphs
- **Depth-First Search (DFS)** — recursive traversal for deep graph exploration and connectivity analysis
- **Dijkstra's Shortest Path** — weighted pathfinding using relaxation of tentative distances
- **Connected Components** — identification of isolated subgraphs and component count

## Technologies Used

- HTML5
- CSS3
- Vanilla JavaScript
- GitHub Pages compatible static deployment

## Screenshots

GraphLab is designed for a clean, professional learning experience. Key interface views include:

- Dark-mode graph editing canvas with tool controls
- Algorithm panel showing selected algorithm, complexity, and traversal state
- Statistics panel with vertex, edge, density, and component metrics
- Import/export workflow for JSON-based graph exchange

## Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd project-directory
   ```
2. Open `index.html` directly in a modern browser, or launch from a local development server such as Live Server.
3. Build graphs, connect nodes, and run algorithm visualizations from the left-side control panel.

## Learning Outcomes

- Developed a graph data model and rendering engine in vanilla JavaScript
- Implemented BFS, DFS, Dijkstra, and connected component algorithms
- Built interactive visualization with canvas rendering and animated state updates
- Applied responsive UI design and accessibility best practices
- Prepared a static front-end project for GitHub Pages deployment

## Future Improvements

- Add undo/redo controls and edit history
- Enable edge weight editing after creation
- Add node search/filter and graph layout presets
- Support algorithm playback pause, resume, and rewind
- Add screenshot gallery and guided tutorial mode

## Deployment

This project is configured to deploy as a static site on GitHub Pages. The repository includes workflow metadata for automated deployment from the `main` branch.

