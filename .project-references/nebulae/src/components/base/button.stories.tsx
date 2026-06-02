import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { GlassOverlay } from './glass-overlay';

const meta = {
  title: 'Base/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'destructive', 'inset'],
      description: 'Button variant style',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'Button size',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
    },
    children: {
      control: 'text',
      description: 'Button content',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    size: 'default',
    children: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    size: 'default',
    children: 'Button',
  },
};

export const Small: Story = {
  args: {
    variant: 'primary',
    size: 'sm',
    children: 'Small Button',
  },
};

export const Large: Story = {
  args: {
    variant: 'primary',
    size: 'lg',
    children: 'Large Button',
  },
};

export const Icon: Story = {
  args: {
    variant: 'secondary',
    size: 'icon',
    children: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </svg>
    ),
  },
};

export const Disabled: Story = {
  args: {
    variant: 'primary',
    size: 'default',
    disabled: true,
    children: 'Disabled Button',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 items-center">
        <Button variant="primary" size="default">Primary Default</Button>
        <Button variant="primary" size="sm">Primary Small</Button>
        <Button variant="primary" size="lg">Primary Large</Button>
        <Button variant="primary" size="icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Button>
      </div>
      <div className="flex gap-4 items-center">
        <Button variant="secondary" size="default">Secondary Default</Button>
        <Button variant="secondary" size="sm">Secondary Small</Button>
        <Button variant="secondary" size="lg">Secondary Large</Button>
        <Button variant="secondary" size="icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  ),
};

export const Inset: Story = {
  args: {
    variant: 'inset',
    size: 'default',
    children: 'Inset Button',
  },
};

export const InsetWithGlassOverlay: Story = {
  render: () => (
    <div className="relative inline-block">
      <Button variant="inset">Active Button</Button>
      <GlassOverlay />
    </div>
  ),
};

export const InsetButtonGroup: Story = {
  render: () => (
    <div className="flex gap-2">
      <div className="relative">
        <Button variant="inset">Slow</Button>
        <GlassOverlay />
      </div>
      <Button variant="inset">Regular</Button>
    </div>
  ),
};

export const InsetStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 items-center">
        <Button variant="inset" size="default">Default</Button>
        <Button variant="inset" size="default" disabled>Disabled</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Hover and click the buttons above to see interactive states
      </p>
    </div>
  ),
};

export const InsetSizes: Story = {
  render: () => (
    <div className="flex gap-4 items-center">
      <Button variant="inset" size="sm">Small</Button>
      <Button variant="inset" size="default">Default</Button>
      <Button variant="inset" size="lg">Large</Button>
      <Button variant="inset" size="icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </Button>
    </div>
  ),
};

