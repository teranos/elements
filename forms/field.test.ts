// A field: one line of text with its label. The chat's field is its own (content/say.ts).
// Personas: Tim (a field and its label), Spike (what is wrong is said at it, misuse), Jenny (the chat's field).

import { describe, test, expect, beforeEach } from 'bun:test';
import { fieldFrom, type Field } from './field';
import { pressFrom, AtField } from './press';
import { sayFrom } from '../content/say';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('Tim: a field says what it asks for, above it', () => {
    test('its label is shown and points to its input', () => {
        const { element, input } = fieldFrom({ id: 'email', label: 'Email', placeholder: 'you@example.com', keyboard: 'email' });
        document.body.appendChild(element);
        const label = element.querySelector('label')!;
        expect(label.textContent).toBe('Email');
        expect(label.htmlFor).toBe(input.id);
        expect(input.type).toBe('email');
        expect(input.placeholder).toBe('you@example.com');
        expect(element.dataset.field).toBe('email');
    });

    test('two fields of one name are two inputs, each its own label\'s', () => {
        const a = fieldFrom({ id: 'name', label: 'Name' });
        const b = fieldFrom({ id: 'name', label: 'Name' });
        expect(a.input.id).not.toBe(b.input.id);
    });

    test('it is as tall as a finger', () => {
        const { input } = fieldFrom({ id: 'name', label: 'Name' });
        expect(input.style.minHeight).toBe('44px');
    });
});

describe('Spike: what is wrong is said at the field', () => {
    test('a press that throws AtField says it at the field, and the field is marked wrong', async () => {
        const email = fieldFrom({ id: 'email', label: 'Email', keyboard: 'email' });
        const send = pressFrom({ id: 'send', title: 'Send', does: () => {
            if (!email.input.value.includes('@')) throw new AtField(email.input, 'an email has an @ in it');
        } });
        document.body.append(email.element, send.element);
        send.element.click();
        await settle();
        const said = email.input.nextElementSibling as HTMLElement;
        expect(said.textContent).toBe('an email has an @ in it');
        expect(email.input.getAttribute('aria-invalid')).toBe('true');
        email.input.value = 'tim@example.com';
        send.element.click();
        await settle();
        expect(email.input.nextElementSibling).toBeNull();
        expect(email.input.hasAttribute('aria-invalid')).toBe(false);
    });

    test('a field with no label, a keyboard it has not, or a key it does not say is stopped', () => {
        const untyped = (field: unknown) => () => fieldFrom(field as Field);
        expect(untyped({ id: 'x', label: '' })).toThrow(TypeError);
        expect(untyped({ id: '', label: 'Name' })).toThrow(TypeError);
        expect(untyped({ id: 'x', label: 'Name', keyboard: 'color' })).toThrow(TypeError);
        expect(untyped({ id: 'x', label: 'Name', type: 'checkbox' })).toThrow(TypeError);
    });
});

describe('Jenny: the chat\'s field is not a field', () => {
    test('it is lines of text, named by its label, and the element\'s chat field', () => {
        const says = sayFrom({ id: 'xenon', label: 'say something' });
        expect(says.tagName).toBe('TEXTAREA');
        expect(says.getAttribute('aria-label')).toBe('say something');
        expect(says.dataset.say).toBe('');
    });

    test('a chat field with no label is stopped', () => {
        expect(() => sayFrom({ id: 'xenon', label: '' })).toThrow(TypeError);
    });
});
