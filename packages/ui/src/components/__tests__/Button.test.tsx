import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../Button';

describe('Button', () => {
  it('shows a progress indicator and disables interaction while loading', () => {
    render(<Button loading>Saving</Button>);
    const button = screen.getByRole('button', { name: /saving/i });
    expect(button).toBeDisabled();
    expect(button.querySelector('[aria-hidden]')).not.toBeNull();
  });

  it('applies the ghost tone styling', () => {
    render(<Button tone="ghost">Explore</Button>);
    const button = screen.getByRole('button', { name: /explore/i });
    expect(button.className).toContain('ring-1');
    expect(button.className).toContain('bg-transparent');
  });
});
