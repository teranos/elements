/**
 * 「[Fable 5.2] What was said in xenon: a person and an agent, drawn as QNTX-Web draws a chat (its css/components.css): what a」
 * 「[Fable 5.2] person says is a prompt line, what an agent says a ● line, what it did small between. No names, no bubbles.」
 *
 * 「[Fable 5.2] These are words only. The pull request the agent speaks of at the end is a surface of its own, a pill in the」
 * 「[Fable 5.2] field (examples/pr.ts). Examples only: none of this is a real pull request or session.」
 */

type Said = [kind: 'you' | 'said' | 'did', says: string];

const SAID: Said[] = [
    ['you', 'what runs ground on this machine right now'],
    ['did', 'Ran 2 shell commands'],
    ['said', 'The home runs ground from a branch, at 0.20. The lock names that branch.'],
    ['you', 'and the sessions'],
    ['said', 'Every session on this machine runs the machine\'s ground. A worktree that installed its own shadows it for all of them.'],
    ['you', 'that is the bug'],
    ['said', 'Yes. A session standing outside the worktree should never run the worktree\'s build.'],
    ['you', 'how did it get that way'],
    ['did', 'Read 3 files'],
    ['said', 'The install wrote its links into the home\'s bin, which every session has first on its path.'],
    ['you', 'so the last install wins'],
    ['said', 'It does. Whichever worktree installed last is what every session runs.'],
    ['you', 'what would you change'],
    ['said', 'A worktree keeps its build under its own folder, and a session finds its ground from where it stands.'],
    ['you', 'and a session outside any worktree'],
    ['said', 'It finds none on the way up, and runs the machine\'s.'],
    ['you', 'does that need a new control'],
    ['said', 'No. It is where the hook looks first, nothing else.'],
    ['you', 'ok'],
    ['you', 'the home still runs ground from a branch. move it to main'],
    ['said', 'Two things are in the way. The lock names the branch, and a ground installed in a worktree shadows the machine\'s.'],
    ['you', 'do the worktree one first'],
    ['did', 'Edited 4 files, ran 2 shell commands'],
    ['said', 'A worktree\'s ground is now that worktree\'s. PR #26 is open and its checks pass.'],
    ['you', 'merged it'],
    ['did', 'Ran 1 shell command'],
    ['said', 'Main holds. I rebuilt the home from main and checked it on this machine: 19 projects, and the 33 controls are kept beside the machine\'s sand.'],
    ['you', 'and the lock?'],
    ['said', 'The lock moves in a pull request of its own.'],
    ['you', 'why not together'],
    ['said', 'If the rebuild fails, the lock goes back in one press and the code stays.'],
    ['you', 'ok'],
    ['did', 'Ran 3 shell commands'],
    ['said', 'A session is now told which ground it runs. I checked both: a session in a worktree, and one outside it.'],
    ['you', 'show me what it is told'],
    ['said', '"ground 0.20 is active for this session: the ground installed in the worktree, which runs only for sessions standing in it."'],
    ['you', 'and outside'],
    ['said', '"ground 0.20 is active for this session: the machine\'s."'],
    ['you', 'did you start new sessions for that'],
    ['said', 'No. I fed a session start to the machine\'s hook in each place. The real sessions were on the branch build earlier.'],
    ['you', 'good. anything left?'],
    ['did', 'Created PR #27'],
    ['said', 'One PR left for you: PR #27 moves the lock to main. This machine is already applied from it.'],
];

export function exchangeFrom(): HTMLElement {
    const log = document.createElement('div');
    log.className = 'content chat-scroll';
    for (const [kind, says] of SAID) {
        const row = document.createElement('div');
        row.className = `chat-row chat-${kind}`;
        row.dataset.said = kind;
        const text = document.createElement('span');
        text.className = 'chat-text';
        text.textContent = says;
        row.appendChild(text);
        log.appendChild(row);
    }
    return log;
}
