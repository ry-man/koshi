const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');

function node() {
  return {
    children: [], dataset: {}, style: { setProperty(name, value) { this[name] = value; } },
    attributes: {}, listeners: {}, classList: { add() {} },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { this.listeners[name] = callback; },
  };
}

function fixture(events, duration = 20) {
  const nodes = {
    '#event-list': node(), '#event-timeline-axis': node(), '#event-timeline-viewport': node(),
    '#event-timeline-plot': node(), '#event-timeline-cursor': node(),
    '#event-count': node(), '#event-timeline-view': { value: 'relative' }, '#timeline': { value: '3' },
    '#timeline-discretization': { value: '0' },
    '#relative-event-details': node(), '#relative-event-details-list': node(),
  };
  const selections = [];
  const context = vm.createContext({
    level: { events, duration }, selectedEvents: new Set([1]),
    timelineDetailIndex: null, timelineGesture: null, readOnly: () => false,
    $: selector => nodes[selector],
    document: { createElement: node },
    FOODS: { S: { icon: 'food' } },
    description: event => event.type,
    picture: value => Object.assign(node(), { value }),
    plural: count => `${count} events`,
    isAdditive: click => Boolean(click.shiftKey),
    choose: (...args) => { selections.push(args); context.renderList(); },
    eventTimelineButton: (event, index, click) => Object.assign(node(), { compactIndex: index, click }),
  });
  vm.runInContext(source.slice(source.indexOf('function relativeTimelineLayout('), source.indexOf('function eventTimelineButton(')), context);
  vm.runInContext(source.slice(source.indexOf('function renderList('), source.indexOf('function overlappingMarkers(')), context);
  return { context, nodes, selections };
}

test('relative timeline uses exact timed endpoints, compact untimed boxes and optimal rows', () => {
  const events = [
    { kind: 'food', type: 'S', time: 0, lifetime: .1 },
    { kind: 'enemy', type: 'mouse', time: 0 },
    { kind: 'food', type: 'S', time: .05, lifetime: .4 },
    { kind: 'item', type: 'battery', time: 1, lifetime: 3 },
    { kind: 'object', type: 'bumper', time: 1 },
    { kind: 'food', type: 'S', time: 4, lifetime: 30 },
  ];
  const f = fixture(events, 20), before = JSON.stringify(events);
  const layout = f.context.relativeTimelineLayout(events, 20);
  assert.ok(layout.scale > 20, 'short lifetimes expand the scale instead of stretching their window');
  for (const entry of layout.entries) {
    assert.equal(entry.left, entry.event.time * layout.scale);
    assert.equal(entry.width, entry.lifetime === null ? entry.minimumWidth : entry.lifetime * layout.scale);
    assert.ok(entry.width >= entry.minimumWidth);
    for (const other of layout.entries) {
      if (entry !== other && entry.row === other.row && entry.left <= other.left) {
        assert.ok(entry.left + entry.width + 12 <= other.left);
      }
    }
  }
  const maximumOverlap = Math.max(...layout.entries.map(entry => layout.entries.filter(other =>
    other.left <= entry.left && other.left + other.width + 12 > entry.left).length));
  assert.equal(layout.rows, maximumOverlap, 'row count equals maximum simultaneous occupied intervals');
  assert.equal(layout.width, 34 * layout.scale, 'events extending beyond the level end remain visible');
  assert.equal(JSON.stringify(events), before);
});

test('relative view renders accessible compact boxes and switches back without changing events', () => {
  const events = [
    { kind: 'food', type: 'S', time: 0, lifetime: 2 },
    { kind: 'enemy', type: 'mouse', time: 3 },
    { kind: 'item', type: 'battery', time: 4, lifetime: 1 },
  ];
  const f = fixture(events), before = JSON.stringify(events);
  f.context.renderList();
  const list = f.nodes['#event-list'], axis = f.nodes['#event-timeline-axis'];
  assert.equal(list.dataset.view, 'relative');
  assert.equal(f.nodes['#event-timeline-viewport'].dataset.view, 'relative');
  assert.equal(axis.hidden, false);
  assert.equal(f.nodes['#event-timeline-cursor'].hidden, false);
  assert.equal(f.nodes['#event-timeline-cursor'].style.left, `${3 * Number(f.nodes['#event-timeline-viewport'].dataset.scale)}px`);
  assert.ok(axis.children.length > 1);
  assert.equal(axis.children[0].textContent, '0s');
  assert.deepEqual(list.children.map(li => li.dataset.previewReached), ['true', 'true', 'false']);
  const buttons = list.children.map(li => li.children[0]);
  assert.deepEqual(buttons.map(button => button.children.slice(0, 3).map(child => child.textContent)), [
    ['1', 'food', '2'], ['2', undefined, '∞'], ['3', undefined, '1'],
  ]);
  assert.equal(buttons[1].attributes['aria-pressed'], 'true');
  assert.match(buttons[1].attributes['aria-label'], /Event 2: enemy, mouse, at 3 seconds, no scheduled removal/);
  assert.equal(buttons[1].children[1].value, 'enemy:mouse');
  buttons[1].listeners.click({ shiftKey: true });
  assert.deepEqual(f.selections[0], ['event', 1, true]);
  assert.equal(f.nodes['#relative-event-details'].hidden, false);
  assert.equal(f.nodes['#relative-event-details-list'].children[0].children[0].compactIndex, 1);
  f.nodes['#event-timeline-view'].value = 'compact';
  f.context.renderList();
  assert.equal(list.dataset.view, 'compact');
  assert.equal(axis.hidden, true);
  assert.equal(f.nodes['#event-timeline-cursor'].hidden, true);
  assert.equal(f.nodes['#relative-event-details'].hidden, true);
  assert.equal(list.style.width, '');
  assert.equal(list.style.height, '');
  assert.deepEqual(list.children.map(li => li.children[0].compactIndex), [0, 1, 2]);
  assert.equal(JSON.stringify(events), before);
});

test('relative details reflect selection made outside the timeline', () => {
  const f = fixture([{ kind: 'food', type: 'S', time: 0, lifetime: 2 }, { kind: 'enemy', type: 'mouse', time: 1 }]);
  f.context.renderList();
  assert.equal(f.nodes['#relative-event-details'].hidden, false);
  assert.equal(f.nodes['#relative-event-details-list'].children[0].children[0].compactIndex, 1);
  f.context.selectedEvents = new Set([0]);
  f.context.renderList();
  assert.equal(f.nodes['#relative-event-details-list'].children[0].children[0].compactIndex, 0);
  f.context.selectedEvents.clear();
  f.context.renderList();
  assert.equal(f.nodes['#relative-event-details'].hidden, true);
});

test('multi-event timing drags preserve ends or lifetimes and obey shared bounds', () => {
  const events = [
    { time: 2, lifetime: 5 }, { time: 4, lifetime: 2 }, { time: 6 },
  ];
  const f = fixture(events, 10), origins = new Map(events.map((event, index) => [index, { ...event }]));
  const drag = (mode, amount) => {
    const delta = f.context.timelineDragDelta(origins, mode, amount, 10);
    return JSON.parse(JSON.stringify(f.context.timelineDragEvents(events, origins, mode, delta)));
  };
  assert.deepEqual(drag('move', -5), [{ time: 0, lifetime: 5 }, { time: 2, lifetime: 2 }, { time: 4 }]);
  assert.deepEqual(drag('move', 8), [{ time: 6, lifetime: 5 }, { time: 8, lifetime: 2 }, { time: 10 }]);
  assert.deepEqual(drag('start', -1), [{ time: 1, lifetime: 6 }, { time: 3, lifetime: 3 }, { time: 5 }]);
  assert.deepEqual(drag('start', 5), [{ time: 3.9, lifetime: 3.1 }, { time: 5.9, lifetime: .1 }, { time: 7.9 }]);
  assert.deepEqual(drag('end', -5), [{ time: 2, lifetime: 3.1 }, { time: 4, lifetime: .1 }, { time: 6 }]);
  assert.deepEqual(drag('end', 2), [{ time: 2, lifetime: 7 }, { time: 4, lifetime: 4 }, { time: 6 }]);
  assert.deepEqual(events, [{ time: 2, lifetime: 5 }, { time: 4, lifetime: 2 }, { time: 6 }]);
  const maxOrigins = new Map([[0, { time: 0, lifetime: 3599.5 }]]);
  assert.equal(f.context.timelineDragDelta(maxOrigins, 'end', 3, 10), .5);
  assert.equal(f.context.timelineDragDelta(maxOrigins, 'start', -3, 10), 0);
});

test('dragged start or end snaps to permitted intervals while group offsets remain unchanged', () => {
  const events = [{ time: 2.3, lifetime: 3.4 }, { time: 4.1, lifetime: 2 }, { time: 6.2 }];
  const f = fixture(events, 20), origins = new Map(events.map((event, index) => [index, event]));
  const drag = (mode, distance, step) => {
    const delta = f.context.timelineDragDelta(origins, mode, distance, 20, 0, step);
    return JSON.parse(JSON.stringify(f.context.timelineDragEvents(events, origins, mode, delta)));
  };
  assert.deepEqual(drag('move', 1.1, 1), [{ time: 3, lifetime: 3.4 }, { time: 4.8, lifetime: 2 }, { time: 6.9 }]);
  assert.deepEqual(drag('start', -1.1, .5), [{ time: 1, lifetime: 4.7 }, { time: 2.8, lifetime: 3.3 }, { time: 4.9 }]);
  assert.deepEqual(drag('end', 1.1, 1), [{ time: 2.3, lifetime: 4.7 }, { time: 4.1, lifetime: 3.3 }, { time: 6.2 }]);
  assert.deepEqual(drag('move', 1.123, 0), [{ time: 3.423, lifetime: 3.4 }, { time: 5.223, lifetime: 2 }, { time: 7.323 }]);
  for (const step of [.5, 1, 5, 10, 30]) {
    const group = new Map([[0, { time: 8.3, lifetime: 3 }]]);
    const delta = f.context.timelineDragDelta(group, 'move', 3, 100, 0, step);
    assert.ok(Math.abs((8.3 + delta) / step - Math.round((8.3 + delta) / step)) < 1e-10);
  }
  const beyondEnd = new Map([[0, { time: 9, lifetime: 5 }]]);
  assert.equal(f.context.timelineDragDelta(beyondEnd, 'end', 3, 10, 0, 5), 1, 'ends can snap beyond level duration');
  const tight = new Map([[0, { time: 1.3, lifetime: .2 }]]);
  assert.equal(f.context.timelineDragDelta(tight, 'start', 1, 10, 0, 5), -1.3, 'uses a valid grid point rather than clamping off-grid');
  const noTick = new Map([[0, { time: 1.3, lifetime: .2 }], [1, { time: 0.1, lifetime: .2 }]]);
  assert.equal(f.context.timelineDragDelta(noTick, 'start', 1, 10, 0, 5), 0, 'leaves events unchanged when no grid point is valid');
});

test('relative drag handles are disabled in read-only mode and omit infinite end handles', () => {
  const f = fixture([{ kind: 'food', type: 'S', time: 0, lifetime: 2 }, { kind: 'enemy', type: 'mouse', time: 1 }]);
  f.context.renderList();
  const buttons = f.nodes['#event-list'].children.map(li => li.children[0]);
  assert.deepEqual(buttons.map(button => button.children.slice(3).map(handle => handle.dataset.edge)), [['start', 'end'], ['start']]);
  f.context.readOnly = () => true;
  f.context.renderList();
  assert.deepEqual(f.nodes['#event-list'].children.map(li => li.children[0].children.length), [3, 3]);
});

test('timeline pointer gestures preview without mutating data, cancel, and commit group edits', () => {
  const events = [{ time: 2, lifetime: 5 }, { time: 4, lifetime: 2 }];
  const f = fixture(events), list = f.nodes['#event-list'];
  f.context.selectedEvents = new Set([0, 1]);
  f.nodes['#event-timeline-viewport'].scrollLeft = 0;
  const entries = events.map((event, index) => {
    const badge = {};
    return { dataset: { eventIndex: String(index) }, style: {}, querySelector: () => badge, badge };
  });
  list.querySelectorAll = () => entries;
  let captured = false, changed = 0, selected;
  const button = {
    setPointerCapture() { captured = true; }, hasPointerCapture() { return captured; },
    releasePointerCapture() { captured = false; },
  };
  f.context.trackObjectAction = null;
  f.context.obstructionTool = null;
  f.context.validateDraft = candidate => candidate;
  f.context.markChanged = () => { changed++; };
  f.context.setSelection = indices => { selected = indices; };
  f.context.message = () => {};
  f.context.renderList = () => {};
  f.context.attempt = action => action();
  const down = edge => ({ button: 0, pointerId: 7, clientX: 100, currentTarget: button,
    target: { closest: () => edge ? { dataset: { edge } } : null } });
  f.context.startTimelineGesture(down('start'), { index: 0 }, 20);
  f.context.moveTimelineGesture({ pointerId: 7, clientX: 80 });
  assert.equal(entries[0].style.left, '20px');
  assert.equal(entries[0].style.width, '120px');
  assert.equal(entries[1].badge.textContent, '3');
  assert.deepEqual(f.context.level.events, events, 'preview does not mutate the level');
  f.context.finishTimelineGesture({ pointerId: 7 }, true);
  assert.equal(captured, false);
  assert.deepEqual(f.context.level.events, events);
  assert.equal(changed, 0);
  f.context.startTimelineGesture(down('start'), { index: 0 }, 20);
  f.context.moveTimelineGesture({ pointerId: 7, clientX: 80 });
  f.context.finishTimelineGesture({ pointerId: 7 });
  assert.equal(JSON.stringify(f.context.level.events), JSON.stringify([{ time: 1, lifetime: 6 }, { time: 3, lifetime: 3 }]));
  assert.equal(changed, 1);
  assert.deepEqual(Array.from(selected), [0, 1]);
});

test('relative timeline handles empty levels and bounds axis tick count for large scales', () => {
  const f = fixture([], 3600);
  f.context.renderList();
  assert.equal(f.nodes['#event-list'].children[0].className, 'empty-state');
  assert.ok(f.nodes['#event-timeline-axis'].children.length <= 151);
  f.context.level.events.push({ kind: 'food', type: 'S', time: 0, lifetime: .1 });
  f.context.renderList();
  assert.ok(f.nodes['#event-timeline-axis'].children.length <= 151);
});

test('relative view is selectable and retains existing gold and selection styling', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'editor.css'), 'utf8');
  assert.match(html, /id="event-timeline-view"><option value="compact">Detailed<\/option><option value="relative">Time Plot<\/option>/);
  assert.match(source, /\$\('#event-timeline-view'\)\.addEventListener\('change', renderList\)/);
  assert.match(css, /#event-list > \[data-preview-reached="true"\]/);
  assert.match(css, /#event-list button\[aria-pressed="true"\].*animation: event-selection-glow/);
  assert.match(css, /marker\[data-index\]\[aria-pressed="true"\].*animation: marker-selection-glow/);
  assert.match(css, /#event-timeline-cursor::after\s*\{[^}]*border-left: 1px dotted #b28b37/);
  assert.match(html, /Selected Event:/);
  assert.doesNotMatch(html, /Gold outlines mark events at or before the preview time/);
});
