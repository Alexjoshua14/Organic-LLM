import type { Meta, StoryObj } from '@storybook/react';
import { GlassOverlay } from './glass-overlay';
import { Button } from './button';

const meta = {
  title: 'Base/GlassOverlay',
  component: GlassOverlay,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
    children: {
      control: 'text',
      description: 'Optional content inside overlay',
    },
  },
} satisfies Meta<typeof GlassOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OverInsetButton: Story = {
  render: () => (
    <div className="relative inline-block">
      <Button variant="inset">Active</Button>
      <GlassOverlay />
    </div>
  ),
};

export const OverRegularButton: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="relative inline-block">
        <Button variant="primary">Primary with Overlay</Button>
        <GlassOverlay />
      </div>
      <div className="relative inline-block">
        <Button variant="secondary">Secondary with Overlay</Button>
        <GlassOverlay />
      </div>
    </div>
  ),
};

export const PositioningExamples: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground mb-2">Centered overlay</p>
        <div className="relative inline-block">
          <Button variant="inset" size="lg">Large Button</Button>
          <GlassOverlay />
        </div>
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-2">Small button</p>
        <div className="relative inline-block">
          <Button variant="inset" size="sm">Small</Button>
          <GlassOverlay />
        </div>
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-2">Icon button</p>
        <div className="relative inline-block">
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
          <GlassOverlay />
        </div>
      </div>
    </div>
  ),
};

export const BlurVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground mb-2">Default blur</p>
        <div className="relative inline-block">
          <Button variant="inset">Default</Button>
          <GlassOverlay />
        </div>
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-2">Custom blur (more intense)</p>
        <div className="relative inline-block">
          <Button variant="inset">More Blur</Button>
          <GlassOverlay className="backdrop-blur-md" />
        </div>
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-2">Custom blur (less intense)</p>
        <div className="relative inline-block">
          <Button variant="inset">Less Blur</Button>
          <GlassOverlay className="backdrop-blur-xs" />
        </div>
      </div>
    </div>
  ),
};

export const WithContent: Story = {
  render: () => (
    <div className="relative inline-block">
      <Button variant="inset" size="lg">Button with Content</Button>
      <GlassOverlay className="flex items-center justify-center">
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
          Active
        </span>
      </GlassOverlay>
    </div>
  ),
};

