import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Surface } from '../Surface';

describe('Surface', () => {
  it('renders children with padding presets', () => {
    render(
      <Surface padding="lg" elevation="raised">
        <p>content</p>
      </Surface>,
    );

    const surface = screen.getByText('content').closest('section');
    expect(surface).not.toBeNull();
    expect(surface?.className).toContain('p-6');
    expect(surface?.className).toContain('shadow-xl');
  });

  it('allows custom class names to merge', () => {
    render(
      <Surface className="custom-border" padding="none">
        <span>details</span>
      </Surface>,
    );

    const surface = screen.getByText('details').closest('section');
    expect(surface?.className).toContain('custom-border');
    expect(surface?.className).toContain('p-0');
  });
});
