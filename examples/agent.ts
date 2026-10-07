// Agent specimen — Polonium, standing in for QNTX's Pi element as a phone shows it:
// who answers, the session as a column of turns, and a box to say something in.
// The DOM and its styles (index.html, .claude) are QNTX's own, drawn the way
// claude-element.ts and transcript-element.ts draw them, so what the package does
// to that element on a phone is what it does here — with the two lines QNTX does
// not have yet: no second content-area, and the column of turns declared.

import { tray } from '../tray/tray';
import type { Element } from '../element';
import { declareScroller } from '../content/scroll';

const TURNS: [speaker: string, text: string][] = [
    ['human', 'Hello. This is a Claude Code session working on the QNTX repository, saying hello through pi say.'],
    ['assistant', 'I’m here and ready to help! Let me know what you’d like to work on.'],
    ['human', 'Talk about penguins'],
    ['assistant', 'Penguins are a fascinating group of flightless birds that have adapted perfectly to life in the water. Here are a few cool facts about them:'],
    ['assistant', '1. Aquatic Adaptations\n   – Their wings have evolved into flippers, making them excellent swimmers. Some species can reach speeds of up to 15 km/h (9 mph) underwater.\n   – Their bodies are streamlined, and they have dense waterproof feathers that provide insulation and reduce drag.'],
    ['assistant', '2. Diverse Species\n   – There are about 18 recognized species, ranging from the tiny Little Blue Penguin (≈ 33 cm tall) to the towering Emperor Penguin (≈ 1.2 m tall).\n   – Species differ in habitat: some live in icy Antarctic regions, while others, like the Galápagos Penguin, inhabit more temperate islands.'],
    ['assistant', '3. Thermoregulation\n   – Penguins have a thick layer of sub-cutaneous fat and a counter-current heat exchange system in their flippers and legs, which helps retain body heat in freezing waters.\n   – They also huddle together—especially Emperor penguins—to share warmth during harsh winter storms.'],
    ['assistant', '4. Social Behavior\n   – Many species are monogamous during a breeding season, and some keep the same mate for years.\n   – Colonies can number in the hundreds of thousands, and chicks gather in crèches while their parents fish.'],
    ['assistant', '5. Diet\n   – Krill, squid and small fish, caught on dives that for an Emperor can reach 500 m and last over 20 minutes.'],
];

function part(tag: string, className: string, text = ''): HTMLElement {
    const el = document.createElement(tag);
    el.className = className;
    if (text) el.textContent = text;
    return el;
}

function turn(speaker: string, text: string): HTMLElement {
    const row = part('div', `tr-turn tr-sp-${speaker}`);
    row.append(part('span', 'tr-speaker', `[${speaker}]`), part('span', 'tr-text', text));
    return row;
}

export function renderAgentSpecimen(): void {
    const item: Element = {
        id: 'agent-specimen',
        title: 'Polonium',
        symbol: 'Po',
        opensAs: 'window',
        renderContent: () => {
            // Not a content-area of its own: it sits in the package's body (content/body.ts).
            const body = part('div', 'claude');
            const who = part('div', 'claude-who', 'did:key:z6MkoP1H4cbfRLsh2kZN9D3Agpi8tfh7pnj8y1v7TmAU3Xqe  openai/gpt-oss-120b  low');
            const session = part('div', 'claude-session tr');
            const rows = part('div', 'tr-body');
            const column = part('div', 'tr-col');
            for (const [speaker, text] of TURNS) column.appendChild(turn(speaker, text));
            // The column of turns is this element's scroller: the body gives way to it,
            // and .claude fills the body, its box at the bottom (content/scroll.ts).
            declareScroller(column);
            rows.appendChild(column);
            session.append(part('div', 'tr-head', 'b7d7b16e  14:10  9t'), rows);

            const form = part('div', 'claude-say');
            const says = document.createElement('textarea');
            says.className = 'claude-says';
            says.rows = 2;
            says.placeholder = 'Say something to the ROOT agent';
            const send = part('button', 'claude-send', 'Say');
            form.append(says, send);

            body.append(who, session, part('div', 'claude-status'), form);
            // What was said last is what is looked at (claude-element.ts, read()).
            requestAnimationFrame(() => { column.scrollTop = column.scrollHeight; });
            return body;
        },
    };
    tray.add(item);
}
