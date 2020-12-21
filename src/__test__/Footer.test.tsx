import React from 'react';
import { render, screen } from '@testing-library/react';
import Footer from '../renderer/Footer';

describe('Footer', () => {
  it('should render Made by Ottomated text', () => {
    render(<Footer />);

    expect(screen.getByText('Made by Ottomated')).toBeInTheDocument();
  });
});
