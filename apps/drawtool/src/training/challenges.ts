import type {
  FillStyle,
  FontFamily,
  Settings,
  ShapeKind,
} from "../hooks/useSettings";

export type StrokeSnapshot = {
  shape?: ShapeKind;
  style: "solid" | "dashed";
  color: string;
  fill?: FillStyle | boolean;
  text?: string;
  fontFamily?: FontFamily;
  sharp?: boolean;
  highlight?: boolean;
  spray?: boolean;
  points?: number;
  dynamic?: boolean;
};

export type ValidationKind =
  | { type: "manual" }
  | { type: "settings-changed"; key: keyof Settings }
  | { type: "canvas-changed"; toIndex: number }
  | { type: "stroke"; predicate: (s: StrokeSnapshot) => boolean }
  | { type: "erase" }
  | { type: "clear" }
  | { type: "event"; name: string };

export type Challenge = {
  id: string;
  title: string;
  description: string;
  hint: { desktop: string; mobile: string };
  validation: ValidationKind;
};

const PROGRESS_KEY = "drawtool-training-progress";

export function loadProgress(): Set<string> {
  try {
    return new Set(
      JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "[]") as string[],
    );
  } catch {
    return new Set();
  }
}

export function saveProgress(completed: Set<string>): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...completed]));
  } catch {
    // ignore
  }
}

export const CHALLENGES: Challenge[] = [
  // ── Freehand drawing ──────────────────────────────────────────────────────
  {
    id: "free-draw",
    title: "Free draw",
    description: "Make any freehand stroke on the canvas.",
    hint: {
      desktop:
        "Or {mod} or click and drag anywhere on the canvas. Drawing is the default.",
      mobile:
        "Just drag your finger anywhere on the canvas. Drawing is the default mode.",
    },
    validation: {
      type: "stroke",
      predicate: (s) => !s.shape && !s.text && s.style === "solid",
    },
  },
  {
    id: "free-draw-dashed",
    title: "Dashed freehand",
    description: "Draw a dashed freehand stroke.",
    hint: {
      desktop: "Hold {shift} while dragging to draw a dashed stroke.",
      mobile: "Tap the dashed-line icon in the toolbar first, then draw.",
    },
    validation: {
      type: "stroke",
      predicate: (s) => !s.shape && s.style === "dashed",
    },
  },
  {
    id: "highlight",
    title: "Highlight",
    description: "Draw a highlight stroke.",
    hint: {
      desktop:
        "Hold W or H while dragging to draw a semi-transparent highlight.",
      mobile: "Tap the highlight icon in the toolbar, then drag.",
    },
    validation: { type: "stroke", predicate: (s) => s.highlight === true },
  },
  {
    id: "spray",
    title: "Spray paint",
    description: "Make a spray paint stroke on the canvas.",
    hint: {
      desktop: "Hold B while dragging to spray. Release B to stop.",
      mobile: "Tap the spray icon in the toolbar, then draw.",
    },
    validation: { type: "stroke", predicate: (s) => s.spray === true },
  },
  {
    id: "dynamic-freehand",
    title: "Dynamic freehand",
    description: "Draw a freehand stroke with dynamic stroke mode on.",
    hint: {
      desktop:
        "Press P to toggle dynamic stroke on, then draw. The line varies in width as you draw.",
      mobile: "Open the menu (☰) and enable Dynamic Stroke, then draw.",
    },
    validation: {
      type: "stroke",
      predicate: (s) => !s.shape && !s.text && s.dynamic === true,
    },
  },
  {
    id: "laser",
    title: "Laser pointer",
    description: "Draw with the laser pointer — it fades away.",
    hint: {
      desktop:
        "Hold Q or L while dragging. The trail appears briefly then disappears.",
      mobile:
        "Tap the laser icon in the toolbar, then drag. The trail fades on its own.",
    },
    validation: { type: "event", name: "drawtool:laser-used" },
  },
  // ── Tool settings ─────────────────────────────────────────────────────────
  {
    id: "change-thickness",
    title: "Change line thickness",
    description: "Change the stroke thickness setting.",
    hint: {
      desktop: "Press [ to decrease or ] to increase the thickness.",
      mobile:
        "Tap the Draw tool button in the toolbar to open the thickness picker.",
    },
    validation: { type: "settings-changed", key: "lineWidth" },
  },
  {
    id: "change-dash-gap",
    title: "Change dash gap",
    description: "Change the gap between dashes.",
    hint: {
      desktop: "Open the sidebar menu (M) and find the Dash Gap slider.",
      mobile:
        "Long-press the dashed-line icon in the toolbar to open the gap slider.",
    },
    validation: { type: "settings-changed", key: "dashGap" },
  },
  // ── Canvas navigation ─────────────────────────────────────────────────────
  {
    id: "pan",
    title: "Pan the canvas",
    description: "Scroll or drag to move around the infinite canvas.",
    hint: {
      desktop:
        "Hold Space and drag to pan. You can also use the arrow keys, or scroll with two fingers.",
      mobile: "Drag with two fingers to pan the canvas.",
    },
    validation: { type: "event", name: "drawtool:panned" },
  },
  {
    id: "zoom",
    title: "Zoom in or out",
    description: "Change the zoom level of the canvas.",
    hint: {
      desktop:
        "Pinch on a trackpad, or hold {mod} and scroll. You can also press + and − keys.",
      mobile: "Pinch with two fingers to zoom in or out.",
    },
    validation: { type: "event", name: "drawtool:zoom" },
  },
  {
    id: "canvas-2",
    title: "Open canvas 2",
    description: "Switch to canvas slot 2.",
    hint: {
      desktop: "Press the 2 key on your keyboard.",
      mobile:
        "Open the sidebar menu (☰) and tap the canvas switcher, then select slot 2.",
    },
    validation: { type: "canvas-changed", toIndex: 2 },
  },
  // ── Editing ───────────────────────────────────────────────────────────────
  {
    id: "erase",
    title: "Erase a stroke",
    description: "Erase something you've drawn.",
    hint: {
      desktop: "Hold {alt} and drag over a stroke to erase it.",
      mobile:
        "Tap the eraser icon in the toolbar, then drag over strokes to erase them.",
    },
    validation: { type: "erase" },
  },
  {
    id: "undo",
    title: "Undo a stroke",
    description: "Undo your last action.",
    hint: {
      desktop: "Press {mod}+Z. Draw something first if the canvas is empty.",
      mobile:
        "Two-finger tap to undo. Draw something first if the canvas is empty.",
    },
    validation: { type: "event", name: "drawtool:did-undo" },
  },
  // ── Appearance ────────────────────────────────────────────────────────────
  {
    id: "change-theme",
    title: "Change the theme",
    description: "Switch to a different color theme.",
    hint: {
      desktop: "Double-tap D to cycle through themes.",
      mobile: "Open the sidebar menu (☰) and find the Theme section.",
    },
    validation: { type: "settings-changed", key: "theme" },
  },
  {
    id: "add-grid",
    title: "Add a grid",
    description: "Turn on a dot or square grid.",
    hint: {
      desktop: "Press G to cycle through: off → dots → squares.",
      mobile: "Open the menu (☰) and find the Grid setting.",
    },
    validation: { type: "settings-changed", key: "gridType" },
  },
  // ── Basic shapes ──────────────────────────────────────────────────────────
  {
    id: "rectangle",
    title: "Draw a rectangle",
    description: "Place a rectangle shape on the canvas.",
    hint: {
      desktop: "Hold R while dragging to draw a rectangle.",
      mobile:
        "Tap the shape tool icon in the toolbar and select rectangle, then drag.",
    },
    validation: { type: "stroke", predicate: (s) => s.shape === "rectangle" },
  },
  {
    id: "arrow",
    title: "Draw an arrow",
    description: "Place a solid arrow on the canvas.",
    hint: {
      desktop: "Hold A while dragging to draw an arrow.",
      mobile: "Tap the shape tool icon and select arrow, then drag.",
    },
    validation: {
      type: "stroke",
      predicate: (s) => s.shape === "arrow" && s.style === "solid",
    },
  },
  {
    id: "cloud",
    title: "Draw a cloud",
    description: "Place a cloud shape on the canvas.",
    hint: {
      desktop: "Press S till you select cloud, then hold {ctrl} and drag.",
      mobile: "Tap the shape tool icon and select cloud, then drag.",
    },
    validation: { type: "stroke", predicate: (s) => s.shape === "cloud" },
  },
  // ── Shape variations ──────────────────────────────────────────────────────
  {
    id: "dashed-arrow",
    title: "Dashed arrow",
    description: "Draw an arrow with a dashed stroke.",
    hint: {
      desktop: "Hold A and {shift} together while dragging.",
      mobile:
        "Select arrow in the shape tool, enable dashed in the shape options, then drag.",
    },
    validation: {
      type: "stroke",
      predicate: (s) => s.shape === "arrow" && s.style === "dashed",
    },
  },
  {
    id: "sharp-cloud",
    title: "Sharp-edge cloud",
    description: "Draw a cloud with sharp corners instead of round.",
    hint: {
      desktop:
        "Press E to toggle sharp corners on, then draw a cloud shape (S → cycle to cloud).",
      mobile:
        "Tap the shape tool, select cloud, then enable sharp corners in the shape options.",
    },
    validation: {
      type: "stroke",
      predicate: (s) => s.shape === "cloud" && s.sharp === true,
    },
  },
  // ── Lines & bends ─────────────────────────────────────────────────────────
  {
    id: "dynamic-line",
    title: "Straight line",
    description: "Draw a perfectly straight freehand line.",
    hint: {
      desktop: "Hold {mod}+{shift} while dragging to snap to a straight line.",
      mobile:
        "Not available on touchscreen — this is a keyboard shortcut for desktop only.",
    },
    validation: { type: "stroke", predicate: (s) => s.shape === "line" },
  },
  {
    id: "multi-bend-line",
    title: "Multi-bend line",
    description: "Draw a straight line with at least two bends.",
    hint: {
      desktop:
        "Hold {mod}+{shift} and drag to start a line. Tap to lock in a bend and keep drawing. Release to finish.",
      mobile:
        "Not available on touchscreen — this is a keyboard shortcut for desktop only.",
    },
    validation: {
      type: "stroke",
      predicate: (s) => s.shape === "line" && (s.points ?? 0) >= 4,
    },
  },
  {
    id: "multi-bend-arrow",
    title: "Curved multi-bend arrow",
    description: "Draw an arrow with at least two smooth, curved bends.",
    hint: {
      desktop:
        "Hold A while dragging. Make sure sharp corners are off (E to toggle). Tap mid-drag to add bends — add at least two before releasing.",
      mobile:
        "Tap the arrow shape tool. Ensure sharp corners are off in shape options. Tap mid-drag to add bends.",
    },
    validation: {
      type: "stroke",
      predicate: (s) => s.shape === "arrow" && (s.points ?? 0) >= 4 && !s.sharp,
    },
  },
  // ── Fills & color ─────────────────────────────────────────────────────────
  {
    id: "filled-red-circle",
    title: "Filled red circle",
    description: "Draw a filled circle in red (#ef4444).",
    hint: {
      desktop:
        "Set color to red (#ef4444) in the color picker or using [ or ]. Then hold C + F while dragging.",
      mobile:
        "Set color to red in the color picker. Select circle in the shape tool, enable fill in shape options, then drag.",
    },
    validation: {
      type: "stroke",
      predicate: (s) =>
        s.shape === "circle" && !!s.fill && s.color === "#ef4444",
    },
  },
  {
    id: "green-triangle",
    title: "Green triangle",
    description: "Draw a triangle in green (#22c55e).",
    hint: {
      desktop:
        "Set line color to green (#22c55e) in the color picker or using [ or ], then use S to find triangle, and hold {ctrl} and drag.",
      mobile:
        "Set color to green in the color picker, select triangle in the shape tool, then drag.",
    },
    validation: {
      type: "stroke",
      predicate: (s) => s.shape === "triangle" && s.color === "#22c55e",
    },
  },
  {
    id: "filled-star",
    title: "Fully filled star",
    description: "Draw a star with solid fill.",
    hint: {
      desktop:
        "Use S to find the star. Open the menu (M) and set fill to 'solid' and drag fill to 100%. Then hold {ctrl} drag.",
      mobile:
        "Select star in the shape tool. Open fill options and set to 'solid'. Then drag.",
    },
    validation: {
      type: "stroke",
      predicate: (s) => s.shape === "star" && s.fill === "solid",
    },
  },
  {
    id: "crosshatch-diamond",
    title: "Crosshatch diamond",
    description: "Draw a diamond with crosshatch fill.",
    hint: {
      desktop:
        "Use S to find the diamond. Press {alt} + F to cycle fill style to 'crosshatch', then hold {ctrl} and drag.",
      mobile:
        "Select diamond in the shape tool. Open fill options and choose 'crosshatch'. Then drag.",
    },
    validation: {
      type: "stroke",
      predicate: (s) => s.shape === "diamond" && s.fill === "crosshatch",
    },
  },
  {
    id: "filled-dashed-circle",
    title: "Dashed filled circle",
    description: "Draw a circle that is both filled and dashed.",
    hint: {
      desktop: "Hold C, F and {shift}.",
      mobile:
        "Select circle in the shape tool. Enable fill and dashed in shape options. Then drag.",
    },
    validation: {
      type: "stroke",
      predicate: (s) =>
        s.shape === "circle" && s.style === "dashed" && !!s.fill,
    },
  },
  // ── Text ──────────────────────────────────────────────────────────────────
  {
    id: "text",
    title: "Add text",
    description: "Place a text label on the canvas.",
    hint: {
      desktop:
        "Press T to enter text mode. Click where you want the text. Type your message. Press Escape to finish.",
      mobile:
        "Tap the text icon in the toolbar. Tap where you want the text. Type your message. Tap outside to finish.",
    },
    validation: { type: "stroke", predicate: (s) => !!s.text },
  },
  {
    id: "cartoon-text",
    title: "Cartoon text",
    description: "Add text using the cartoon font.",
    hint: {
      desktop:
        "Press {shift}+Y to cycle fonts until 'cartoon' appears. Then press T, click on the canvas, and type.",
      mobile:
        "Open the font picker in the toolbar and select 'cartoon'. Then tap the text icon and type.",
    },
    validation: {
      type: "stroke",
      predicate: (s) => !!s.text && s.fontFamily === "cartoon",
    },
  },
  {
    id: "bold-text",
    title: "Bold text",
    description: "Add a bold text label.",
    hint: {
      desktop:
        "Press {shift}+B to toggle bold on, then press T and type. Or enable bold in the text options menu.",
      mobile: "Tap the text tool options and enable bold, then add text.",
    },
    validation: { type: "settings-changed", key: "textBold" },
  },
  // ── Advanced ──────────────────────────────────────────────────────────────
  {
    id: "selection",
    title: "Select and move",
    description: "Select strokes and drag them to a new position.",
    hint: {
      desktop:
        "Hold V to enter select mode. Drag a box around some strokes. Then drag the selection to move it.",
      mobile:
        "Tap the select icon in the toolbar. Drag a box around some strokes. Then drag the selection to move it.",
    },
    validation: { type: "event", name: "drawtool:selection-moved" },
  },
  {
    id: "clear",
    title: "Clear the screen",
    description: "Clear everything from the canvas.",
    hint: {
      desktop: "Press {mod}+X.",
      mobile: "Open the menu and tap the Clear button.",
    },
    validation: { type: "clear" },
  },
];
