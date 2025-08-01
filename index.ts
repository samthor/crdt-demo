import { rafRunner, randomArrayChoice, randomRange, timeout } from 'thorish';
import { buildWindowCanvas, colorForNode, splitNode } from './lib/helper.ts';

const SERVER_COUNT = 4;

const slider = document.createElement('input');
slider.type = 'range';
Object.assign(slider.style, {
  position: 'fixed',
  zIndex: 100,
});
slider.min = '100';
slider.max = '4000';
slider.value = '500';
document.body.append(slider);

const c = buildWindowCanvas();

// ----- 'game'

type Node = { id: string; parent: string; sent: number };

class Server {
  public parents = new Set<string>(['']);
  public nodes: Node[] = [{ id: '', parent: '', sent: 0 }];
  public unknownNodes: Node[] = [];
  public selfNodes: Node[] = [];

  constructor(public id: string) {
    let index = 0;

    (async () => {
      for (;;) {
        await timeout(slider.valueAsNumber);

        const sendFrom = this.nodes.slice(); // we sort

        // sendFrom.sort(() => Math.random() - 0.5);
        // sendFrom.sort((a, b) => a.sent - b.sent);
        // if (!sendFrom.length) {
        //   continue;
        // }

        // let send = sendFrom[0];
        // for (let i = 1; i < sendFrom.length; ++i) {
        //   if (Math.random() < 0.5) {
        //     break;
        //   }
        //   send = sendFrom[i];
        // }

        let send = randomArrayChoice(sendFrom)!;

        let target: Server = this;
        while (target === this) {
          target = randomArrayChoice(renderServers)!;
        }
        target.provideNode(send);

        send.sent++;
      }
    })();

    (async () => {
      for (;;) {
        await timeout(randomRange(2000, 3500));

        // choose a node but skew towards the end of the string

        const nodeChoice = Math.floor(Math.pow(Math.random(), 0.4) * this.nodes.length);
        const parentNode = this.nodes[nodeChoice];

        // const parentNode = randomArrayChoice(this.nodes)!;
        const parent = parentNode.id;

        ++index;
        const n: (typeof this.nodes)[0] = { id: this.id + index, parent, sent: 0 };
        this.insert(n);
        this.selfNodes.push(n);
      }
    })();
  }

  private insert(node: Node) {
    const { n: nv } = splitNode(node.id);

    // if we already have this do nothing
    const existing = this.nodes.find((n) => n.id === node.id);
    if (existing) {
      return;
    }

    const parentNode = this.nodes.find((n) => n.id === node.parent)!;
    const parentIndex = this.nodes.indexOf(parentNode);
    if (parentIndex === -1) {
      throw `bad parent`;
    }

    // we want to insert immediately before (or after?) our peer children

    let i: number;
    for (i = parentIndex + 1; i < this.nodes.length; ++i) {
      const cand = this.nodes[i];
      if (cand.parent !== parentNode.id) {
        const idx = this.nodes.findIndex((x) => x.id === cand.parent);
        if (idx < parentIndex) {
          break; // we've gone too far, we insert here
        }
        continue;
      }

      const { n: cv } = splitNode(cand.id);
      if (cv > nv) {
        break;
      } else if (cv === nv && cand.id.localeCompare(node.id) > 0) {
        break;
      }
    }

    this.nodes.splice(i, 0, node);
    this.parents.add(node.id);
  }

  provideNode(n: Node) {
    const i = this.nodes.findIndex((prev) => prev.id === n.id);
    if (i !== -1) {
      return;
    }

    const ui = this.unknownNodes.findIndex((prev) => prev.id === n.id);
    if (ui !== -1) {
      return;
    }
    this.unknownNodes.push(n);

    for (;;) {
      let again = false;

      this.unknownNodes = this.unknownNodes.filter((u) => {
        if (!this.parents.has(u.parent)) {
          return true;
        }
        this.insert(n);
        again = true;
        return false;
      });

      if (!again) {
        break;
      }
    }

    // if we parent properly, ...
  }
}

const renderServers: Server[] = [];
for (let i = 0; i < SERVER_COUNT; ++i) {
  renderServers.push(new Server(String.fromCharCode(97 + i)));
}

const r = rafRunner(() => {
  r();
  c.width = c.width;

  const ctx = c.getContext('2d')!;
  ctx.scale(c.width, c.height);

  ctx.fillStyle = 'white';
  // ctx.fillRect(0, 0, 1, 1);
  ctx.translate(0.5, 0.5);

  renderServers.forEach((r, index) => {
    ctx.save();

    const ratio = index / renderServers.length + 0.125 / 2;
    const x = Math.cos(ratio * Math.PI * 2);
    const y = Math.sin(ratio * Math.PI * 2);
    ctx.translate(x / 6 - 0.25, y / 3);

    ctx.scale((1 / c.width) * 2, (1 / c.height) * 2);

    ctx.fillStyle = colorForNode(r.id);
    ctx.font = '48px monospace';
    ctx.fillText(r.id, -ctx.measureText(r.id).width, 0);

    ctx.textBaseline = 'middle';
    ctx.font = '14px monospace';
    ctx.letterSpacing = '-2px';
    ctx.translate(0, 20);
    ctx.save();

    // render good nodes
    r.nodes.forEach((node, i) => {
      let textStyle = '';
      if (node.id === '') {
        ctx.fillStyle = '#0003';
        textStyle = '#0009';
      } else {
        ctx.fillStyle = colorForNode(node.id, 0.3);
        textStyle = colorForNode(node.id);
      }

      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = textStyle || ctx.fillStyle;
      const effectiveId = node.id || '0';
      ctx.fillText(effectiveId, -ctx.measureText(effectiveId).width / 2 - 0.75, 1.5);

      const parentIndex = r.nodes.findIndex(({ id }) => id === node.parent);
      const steps = i - parentIndex;
      const parentLeftBy = steps * 32;

      ctx.save();

      ctx.scale(1, Math.pow(steps, 0.75) / steps);

      ctx.beginPath();
      // we will be "parentLeftBy" height
      ctx.arc(-parentLeftBy / 2, -16, parentLeftBy / 2, -Math.PI, 0);
      ctx.stroke();

      ctx.restore();

      ctx.translate(32, 0);
    });

    ctx.restore();
    ctx.translate(0, 32);

    // render naughty nodes
    r.unknownNodes.forEach((node) => {
      ctx.save();
      ctx.translate(-10, 0);
      ctx.scale(0.8, 0.8);
      ctx.globalAlpha = 0.45;

      ctx.fillStyle = colorForNode(node.parent, 0.3);

      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = colorForNode(node.parent);
      ctx.fillText(node.parent, -ctx.measureText(node.parent).width / 2 - 0.75, 1.5);

      ctx.restore();

      ctx.save();
      ctx.translate(0, 16);

      ctx.fillStyle = colorForNode(node.id, 0.3);

      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = colorForNode(node.id);
      ctx.fillText(node.id, -ctx.measureText(node.id).width / 2 - 0.75, 1.5);

      ctx.restore();

      ctx.translate(32, 0);
    });

    ctx.restore();
  });
});
r();
